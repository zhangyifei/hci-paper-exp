/**
 * simulate-sessions.mjs
 * ────────────────────────────────────────────────────────────────────────────
 * Orchestrates the four condition agents (G1–G4) to generate pattern-faithful
 * synthetic participant sessions and insert them into Supabase, matching the
 * real data pattern collected this week (scripts/week-pattern.json).
 *
 * All synthetic data is UNMISTAKABLY tagged (default participant tag "SIMBOT"),
 * which the paper-stats pipeline already excludes as bots — so it never
 * contaminates real results. Use --clean to remove it again.
 *
 * Usage:
 *   node scripts/simulate-sessions.mjs                 # dry run, 10/group, no writes
 *   node scripts/simulate-sessions.mjs --write         # insert 10/group
 *   node scripts/simulate-sessions.mjs --write -n 25   # insert 25/group (all 4 groups)
 *   node scripts/simulate-sessions.mjs --write -n 25 --spread-days 7
 *   SEED=42 node scripts/simulate-sessions.mjs --write # reproducible
 *   node scripts/simulate-sessions.mjs --clean         # delete all rows for the tag
 *   node scripts/simulate-sessions.mjs --write --tag SIM   # VISIBLE to paper stats
 *
 * Flags:
 *   --write            actually insert (default: dry run)
 *   -n, --per-group N  sessions per condition (default 10)
 *   --tag TAG          participant tag (default SIMBOT; must contain BOT to stay
 *                      excluded from paper stats). Use with care.
 *   --spread-days D    spread run end-times across the past D days (default 3)
 *   --clean            delete every row whose participant_id starts with TAG_
 *   --seed N           RNG seed (or env SEED) for reproducibility
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { CONDITION_AGENTS, buildSessionEvents, eventToRow, makeRng } from './lib/sim-agents.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
function parseEnv(file) {
  const out = {}
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
  return out
}
const env = { ...parseEnv(path.join(ROOT, '.env.local')), ...process.env }
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}
const db = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

// ── args ──
const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (names, def) => {
  for (const n of names) {
    const i = argv.indexOf(n)
    if (i !== -1 && argv[i + 1]) return argv[i + 1]
  }
  return def
}
const WRITE = has('--write')
const CLEAN = has('--clean')
const PER_GROUP = Number(val(['-n', '--per-group'], 10))
const TAG = val(['--tag'], 'SIMBOT')
const SPREAD_DAYS = Number(val(['--spread-days'], 3))
const SEED = Number(val(['--seed'], env.SEED ?? Date.now())) >>> 0
const CONDITIONS = ['G1', 'G2', 'G3', 'G4']
// Optional per-group counts, e.g. --counts G1=2,G2=2,G3=2,G4=1 (overrides PER_GROUP).
const COUNTS = (() => {
  const raw = val(['--counts'], null)
  if (!raw) return null
  const out = {}
  for (const part of raw.split(',')) {
    const [g, n] = part.split('=')
    if (CONDITIONS.includes(g) && Number.isFinite(Number(n))) out[g] = Number(n)
  }
  return out
})()
const countFor = (cond) => (COUNTS && cond in COUNTS ? COUNTS[cond] : PER_GROUP)

async function clean() {
  const prefix = `${TAG}_`
  const { data, error } = await db
    .from('experiment_events')
    .select('id', { count: 'exact', head: false })
    .like('participant_id', `${prefix}%`)
  if (error) throw new Error(error.message)
  const n = data?.length ?? 0
  console.log(`Rows matching participant_id LIKE '${prefix}%': ${n}`)
  if (n === 0) return
  const { error: delErr } = await db.from('experiment_events').delete().like('participant_id', `${prefix}%`)
  if (delErr) throw new Error(delErr.message)
  console.log(`Deleted ${n} rows for tag ${TAG}.`)
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN)
const sd = (a) => {
  if (a.length < 2) return NaN
  const m = mean(a)
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1))
}
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—')

async function insertRows(rows) {
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from('experiment_events').insert(rows.slice(i, i + CHUNK))
    if (error) throw new Error(`Insert failed: ${error.message}`)
  }
}

async function main() {
  if (!TAG.includes('BOT') && !CLEAN) {
    console.log(
      `\n⚠  WARNING: tag "${TAG}" does not contain "BOT". This data will be VISIBLE to\n` +
        `   paper-stats (treated as real). Only do this to test the analysis pipeline.\n`,
    )
  }
  if (CLEAN) {
    await clean()
    return
  }

  const rng = makeRng(SEED)
  const totalSessions = CONDITIONS.reduce((s, c) => s + countFor(c), 0)
  const perGroupLabel = COUNTS ? CONDITIONS.map((c) => `${c}=${countFor(c)}`).join(' ') : String(PER_GROUP)
  console.log(`\nSimulator — seed=${SEED} tag=${TAG} perGroup=${perGroupLabel} write=${WRITE}`)
  console.log(`Groups: ${CONDITIONS.join(', ')} | total sessions: ${totalSessions}\n`)

  const allRows = []
  const summary = {}
  const now = Date.now()

  for (const cond of CONDITIONS) {
    const agent = CONDITION_AGENTS[cond]
    const nCond = countFor(cond)
    const cl = [], pu = [], ci = [], mc = [], navs = [], durs = []
    let banners = 0
    for (let i = 0; i < nCond; i++) {
      // spread run end-times across the past SPREAD_DAYS days
      const endWallMs = now - Math.floor(rng() * SPREAD_DAYS * 864e5)
      const { events } = buildSessionEvents(agent, rng, { tag: TAG, endWallMs })
      const survey = events.find((e) => e.eventName === 'survey.completed').payload.aggregates
      const trip = events.find((e) => e.eventName === 'trip_complete.viewed')
      const entry = events.find((e) => e.eventName === 'service2.entry')
      const done = events.find((e) => e.eventName === 'service2.task.complete')
      cl.push(survey.cognitive_load_mean)
      pu.push(survey.usability_mean)
      ci.push(survey.continuance_mean)
      mc.push(survey.manipulation_check_mean)
      navs.push((entry.timestamp - trip.timestamp) / 1000)
      durs.push(done.durationMs / 1000)
      if (events.some((e) => e.eventName === 'trip_complete.banner_tapped')) banners++
      for (const e of events) allRows.push(eventToRow(e))
    }
    summary[cond] = { cl, pu, ci, mc, navs, durs, banners }
    console.log(
      `${cond}: CL ${f(mean(cl))}±${f(sd(cl))} | PU ${f(mean(pu))}±${f(sd(pu))} | CI ${f(mean(ci))}±${f(
        sd(ci),
      )} | MC ${f(mean(mc))}±${f(sd(mc))} | navLag ${f(mean(navs), 1)}s | s2dur ${f(mean(durs), 1)}s | banner ${(
        (banners / nCond) *
        100
      ).toFixed(0)}%`,
    )
  }

  console.log(`\nGenerated ${allRows.length} event rows across ${totalSessions} sessions.`)

  if (!WRITE) {
    console.log('\nDRY RUN — nothing written. Re-run with --write to insert.')
    return
  }
  console.log('Inserting into Supabase ...')
  await insertRows(allRows)
  console.log(`Inserted ${allRows.length} rows. Tag=${TAG}. Remove later with:`)
  console.log(`  node scripts/simulate-sessions.mjs --clean --tag ${TAG}`)
  if (TAG.includes('BOT')) {
    console.log('\nNote: this tagged data is EXCLUDED from paper-stats (bot filter).')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
