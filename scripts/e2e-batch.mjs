/**
 * End-to-end test for the batch assignment system.
 *
 * Drives the real Next.js API routes against a running dev server and a live
 * Supabase project. Verifies:
 *   1. Admin can create a batch (POST /api/admin/batches)
 *   2. Balanced assignment fills 4 groups evenly (POST /api/assign)
 *   3. A full batch turns the next participant away (outcome 'full')
 *   4. Re-entry is idempotent (outcome 'existing', same group)
 *   5. Lifecycle events sync assignment status (completed / invalid)
 *   6. Admin roster reflects tallies + statuses
 * Then cleans up all rows it created.
 *
 * Usage:
 *   node scripts/e2e-batch.mjs           # BASE_URL defaults to localhost:3000
 *   BASE_URL=https://your-app node scripts/e2e-batch.mjs
 */
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ── Env ────────────────────────────────────────────────────────────────────
function parseEnv(file) {
  const out = {}
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* ignore */
  }
  return out
}

const env = { ...parseEnv(path.join(ROOT, '.env.local')), ...process.env }
const BASE_URL = env.BASE_URL || 'http://localhost:3000'
const SECRET = env.PAPER_STATS_SECRET || env.STATS_SECRET
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
const GROUP_SIZE = 25
const CONDITIONS = ['G1', 'G2', 'G3', 'G4']

if (!SECRET || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env. Need PAPER_STATS_SECRET/STATS_SECRET + Supabase URL/key in .env.local')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Tiny assert harness ─────────────────────────────────────────────────────
let passed = 0
let failed = 0
function check(label, cond, detail = '') {
  if (cond) {
    passed++
    console.log(`  \u2713 ${label}`)
  } else {
    failed++
    console.error(`  \u2717 ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

async function postJson(path, body, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}
async function getJson(path, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { headers })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

function minimalEvent(name, sessionId, pid, condition) {
  return {
    eventName: name,
    eventId: randomUUID(),
    sessionId,
    participantId: pid,
    sequenceId: 1,
    flow: 'experiment',
    state: name === 'experiment.completed' ? 'finished' : 'terminated',
    timestamp: Date.now(),
    clientMonoMs: performance.now(),
    condition,
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`E2E batch test → ${BASE_URL}\n`)
  const authHeader = { 'x-stats-password': SECRET }
  const batchName = `E2E ${new Date().toISOString()}`
  const createdSessionIds = []
  let batchId = null

  try {
    // 0. Preflight: tables/function exist?
    const { error: tblErr } = await admin.from('test_batches').select('id').limit(1)
    if (tblErr) {
      console.error(
        '\nTables not found. Run scripts/migrate-add-batches.sql first.\n' +
          `Supabase error: ${tblErr.message}`,
      )
      process.exit(2)
    }

    // 1. Admin creates a batch
    console.log('1) Admin creates a batch')
    const create = await postJson(
      '/api/admin/batches',
      { name: batchName, groupSize: GROUP_SIZE },
      authHeader,
    )
    check('POST /api/admin/batches → 201', create.status === 201, `got ${create.status}`)
    batchId = create.json?.batch?.id
    check('batch id returned', Boolean(batchId))
    check('unauthorized without secret', (await postJson('/api/admin/batches', { name: 'x' })).status === 401)

    // 2. Balanced assignment of GROUP_SIZE * 4 participants
    console.log('\n2) Balanced assignment fills all groups evenly')
    const assignedGroups = {}
    const firstPid = 'E2E_PID_0'
    let firstCondition = null
    const total = GROUP_SIZE * CONDITIONS.length
    for (let i = 0; i < total; i++) {
      const pid = `E2E_PID_${i}`
      const expSessionId = randomUUID()
      createdSessionIds.push({ pid, expSessionId })
      const r = await postJson('/api/assign', {
        pid,
        studyId: 'E2E_STUDY',
        sessionId: `PSESS_${i}`,
        expSessionId,
      })
      const cond = r.json?.condition
      if (r.json?.outcome !== 'assigned' || !cond) {
        check(`assign #${i} ok`, false, JSON.stringify(r.json))
        break
      }
      assignedGroups[cond] = (assignedGroups[cond] ?? 0) + 1
      if (i === 0) firstCondition = cond
    }
    const counts = CONDITIONS.map((c) => assignedGroups[c] ?? 0)
    check(
      `each group has exactly ${GROUP_SIZE}`,
      counts.every((c) => c === GROUP_SIZE),
      `counts = ${JSON.stringify(assignedGroups)}`,
    )

    // 3. Batch is full → next participant turned away
    console.log('\n3) Full batch turns the next participant away')
    const overflow = await postJson('/api/assign', {
      pid: 'E2E_PID_OVERFLOW',
      studyId: 'E2E_STUDY',
      sessionId: 'PSESS_OVER',
      expSessionId: randomUUID(),
    })
    check("outcome 'full'", overflow.json?.outcome === 'full', JSON.stringify(overflow.json))
    check('no condition when full', overflow.json?.condition === null)

    // 4. Idempotent re-entry
    console.log('\n4) Re-entry is idempotent')
    const reentry = await postJson('/api/assign', {
      pid: firstPid,
      studyId: 'E2E_STUDY',
      sessionId: 'PSESS_0',
      expSessionId: randomUUID(),
    })
    check("outcome 'existing'", reentry.json?.outcome === 'existing', JSON.stringify(reentry.json))
    check('same group on re-entry', reentry.json?.condition === firstCondition,
      `${reentry.json?.condition} vs ${firstCondition}`)

    // 5. Lifecycle events sync status
    console.log('\n5) Lifecycle events sync assignment status')
    const completedP = createdSessionIds[0]
    const invalidP = createdSessionIds[1]
    await postJson('/api/events', {
      events: [minimalEvent('experiment.completed', completedP.expSessionId, completedP.pid, firstCondition)],
    })
    await postJson('/api/events', {
      events: [minimalEvent('experiment.invalidated', invalidP.expSessionId, invalidP.pid, firstCondition)],
    })
    // small delay to let best-effort update land
    await new Promise((r) => setTimeout(r, 800))

    const roster = await getJson(`/api/admin/batches/${batchId}/participants`, authHeader)
    const rows = roster.json?.participants ?? []
    const completedRow = rows.find((p) => p.prolificPid === completedP.pid)
    const invalidRow = rows.find((p) => p.prolificPid === invalidP.pid)
    check('completed participant marked completed', completedRow?.status === 'completed', completedRow?.status)
    check('invalidated participant marked invalid', invalidRow?.status === 'invalid', invalidRow?.status)

    // 6. Admin summary tallies
    console.log('\n6) Admin summary reflects tallies')
    const list = await getJson('/api/admin/batches', authHeader)
    const summary = (list.json?.batches ?? []).find((b) => b.id === batchId)
    check('batch present in summary', Boolean(summary))
    check('totalAssigned = 100', summary?.totalAssigned === total, String(summary?.totalAssigned))
    check('totalCompleted = 1', summary?.totalCompleted === 1, String(summary?.totalCompleted))
    check('totalInvalid = 1', summary?.totalInvalid === 1, String(summary?.totalInvalid))
  } finally {
    // ── Cleanup ───────────────────────────────────────────────────────────
    console.log('\n7) Cleanup')
    if (batchId) {
      await admin.from('test_batches').delete().eq('id', batchId) // cascades assignments
    }
    const sessionIds = createdSessionIds.map((s) => s.expSessionId)
    if (sessionIds.length) {
      await admin.from('experiment_events').delete().in('session_id', sessionIds)
    }
    console.log('  cleaned up test batch, assignments, and events')
  }

  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('E2E crashed:', err)
  process.exit(1)
})
