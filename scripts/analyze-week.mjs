/**
 * analyze-week.mjs
 * One-off: read this week's real sessions and characterize the data pattern
 * per condition (G1–G4) so we can build a pattern-faithful simulator.
 *
 * Usage:
 *   node scripts/analyze-week.mjs            # last 7 days
 *   DAYS=14 node scripts/analyze-week.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

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
  console.error('Missing Supabase URL/key in .env.local')
  process.exit(1)
}
const db = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const DAYS = Number(env.DAYS || 7)

const CONDITIONS = ['G1', 'G2', 'G3', 'G4']
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN)
const sd = (a) => {
  if (a.length < 2) return NaN
  const m = mean(a)
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1))
}
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—')

async function fetchAll(sinceISO) {
  const rows = []
  let offset = 0
  const page = 1000
  while (true) {
    let q = db.from('experiment_events').select('*').order('created_at').range(offset, offset + page - 1)
    if (sinceISO) q = q.gte('created_at', sinceISO)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < page) break
    offset += page
  }
  return rows
}

function groupBy(rows, key) {
  const m = new Map()
  for (const r of rows) {
    const k = r[key]
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(r)
  }
  return m
}

const isBot = (evts) =>
  evts.some(
    (e) =>
      e.prolific_study_id?.includes('BOT') ||
      e.prolific_session_id?.includes('BOT') ||
      e.participant_id?.includes('BOT') ||
      e.participant_id?.includes('SIM') ||
      e.prolific_study_id?.includes('SIM'),
  )
const isInvalid = (evts) =>
  evts.some((e) => e.event_name === 'experiment.invalidated' || e.event_name === 'attention_check.failed')
const isCompleted = (evts) =>
  evts.some((e) => e.event_name === 'experiment.completed' || e.state === 'finished')

function surveyAgg(payload) {
  const a = payload?.aggregates
  if (!a) return null
  return a
}

async function main() {
  const since = new Date(Date.now() - DAYS * 864e5).toISOString()
  let rows = await fetchAll(since)
  console.log(`\nWindow: last ${DAYS} days (since ${since})`)
  console.log(`Rows in window: ${rows.length}`)
  if (rows.length === 0) {
    console.log('No rows this week — falling back to ALL data.')
    rows = await fetchAll(null)
    console.log(`Rows (all): ${rows.length}`)
  }
  if (rows.length === 0) {
    console.log('DB empty.')
    return
  }

  const created = rows.map((r) => new Date(r.created_at).getTime())
  console.log(`created_at range: ${new Date(Math.min(...created)).toISOString()} → ${new Date(Math.max(...created)).toISOString()}`)

  const bySession = groupBy(rows, 'session_id')
  console.log(`Sessions: ${bySession.size}`)

  // Per-session characterization
  const sessions = []
  for (const [sid, evtsRaw] of bySession) {
    const evts = [...evtsRaw].sort((a, b) => a.sequence_id - b.sequence_id)
    const cond = evts[0].condition
    const bot = isBot(evts)
    const invalid = isInvalid(evts)
    const completed = isCompleted(evts)
    const trip = evts.find((e) => e.event_name === 'trip_complete.viewed')
    const s2entry = evts.find((e) => e.event_name === 'service2.entry')
    const s2done = evts.find((e) => e.event_name === 'service2.task.complete')
    const bannerTap = evts.find((e) => e.event_name === 'trip_complete.banner_tapped')
    const survey = evts.find((e) => e.event_name === 'survey.completed')
    const quest = evts.find((e) => e.event_name === 'questionnaire.completed')
    sessions.push({
      sid,
      cond,
      bot,
      invalid,
      completed,
      eventCount: evts.length,
      navLagS: trip && s2entry ? (s2entry.timestamp - trip.timestamp) / 1000 : null,
      s2DurS: s2done?.duration_ms ? s2done.duration_ms / 1000 : null,
      bannerTapped: !!bannerTap,
      surveyAgg: survey ? surveyAgg(survey.payload) : null,
      surveyResp: survey?.payload?.responses ?? null,
      surveyDurMs: survey?.duration_ms ?? null,
      questResp: quest?.payload?.responses ?? null,
      questDurMs: quest?.duration_ms ?? null,
      eventNames: evts.map((e) => e.event_name),
    })
  }

  // Distinguish real vs synthetic
  const real = sessions.filter((s) => !s.bot)
  const synth = sessions.filter((s) => s.bot)
  console.log(`Real (human) sessions: ${real.length} | Synthetic/bot sessions: ${synth.length}`)

  // Focus analysis on REAL, non-invalid sessions
  const analysisSet = real.filter((s) => !s.invalid)
  console.log(`Real & valid sessions used for pattern: ${analysisSet.length}\n`)

  // ── Per-condition summary ──────────────────────────────────────────────
  console.log('=== PER-CONDITION (real, valid) ===')
  const perCond = {}
  for (const c of CONDITIONS) {
    const ss = analysisSet.filter((s) => s.cond === c)
    const comp = ss.filter((s) => s.completed)
    const navLags = comp.map((s) => s.navLagS).filter((x) => x != null && x > 0)
    const durs = comp.map((s) => s.s2DurS).filter((x) => x != null && x > 0)
    const surveys = ss.map((s) => s.surveyAgg).filter(Boolean)
    const cl = surveys.map((a) => a.cognitive_load_mean).filter(Number.isFinite)
    const pu = surveys.map((a) => a.usability_mean).filter(Number.isFinite)
    const ci = surveys.map((a) => a.continuance_mean).filter(Number.isFinite)
    const mc = surveys.map((a) => a.manipulation_check_mean).filter(Number.isFinite)
    const bannerUsers = comp.filter((s) => s.bannerTapped).length
    perCond[c] = {
      n: ss.length,
      completed: comp.length,
      navLag: { mean: mean(navLags), sd: sd(navLags), n: navLags.length },
      s2Dur: { mean: mean(durs), sd: sd(durs), n: durs.length },
      cl: { mean: mean(cl), sd: sd(cl), n: cl.length },
      pu: { mean: mean(pu), sd: sd(pu), n: pu.length },
      ci: { mean: mean(ci), sd: sd(ci), n: ci.length },
      mc: { mean: mean(mc), sd: sd(mc), n: mc.length },
      bannerRate: comp.length ? bannerUsers / comp.length : null,
      surveyDurMs: { mean: mean(ss.map((s) => s.surveyDurMs).filter(Number.isFinite)) },
      questDurMs: { mean: mean(ss.map((s) => s.questDurMs).filter(Number.isFinite)) },
      eventCount: { mean: mean(ss.map((s) => s.eventCount)) },
    }
    const p = perCond[c]
    console.log(
      `${c}: n=${p.n} completed=${p.completed} | navLag ${f(p.navLag.mean, 1)}±${f(p.navLag.sd, 1)}s (n=${p.navLag.n}) | s2dur ${f(
        p.s2Dur.mean,
        1,
      )}±${f(p.s2Dur.sd, 1)}s (n=${p.s2Dur.n}) | banner ${p.bannerRate == null ? '—' : (p.bannerRate * 100).toFixed(0) + '%'}`,
    )
    console.log(
      `    CL ${f(p.cl.mean)}±${f(p.cl.sd)} | PU ${f(p.pu.mean)}±${f(p.pu.sd)} | CI ${f(p.ci.mean)}±${f(p.ci.sd)} | MC ${f(
        p.mc.mean,
      )}±${f(p.mc.sd)}  (survey n=${p.cl.n}) | evts~${f(p.eventCount.mean, 0)} | surveyDur~${f(
        p.surveyDurMs.mean / 1000,
        0,
      )}s questDur~${f(p.questDurMs.mean / 1000, 0)}s`,
    )
  }

  // ── Raw per-session dump (real & valid) ────────────────────────────────
  console.log('\n=== REAL & VALID SESSION DETAIL ===')
  for (const s of analysisSet.sort((a, b) => a.cond.localeCompare(b.cond))) {
    console.log(
      `${s.cond} | ${s.sid.slice(0, 8)} | evts=${s.eventCount} | navLag=${f(s.navLagS, 1)}s | s2dur=${f(
        s.s2DurS,
        1,
      )}s | banner=${s.bannerTapped ? 'Y' : 'n'} | done=${s.completed}`,
    )
    if (s.surveyResp)
      console.log(`      survey: ${JSON.stringify(s.surveyResp)}`)
    if (s.questResp) console.log(`      quest : ${JSON.stringify(s.questResp)}`)
  }

  // ── Event-name frequency (real & valid) ────────────────────────────────
  console.log('\n=== EVENT-NAME FREQUENCY (real & valid) ===')
  const freq = {}
  for (const s of analysisSet) for (const n of s.eventNames) freq[n] = (freq[n] || 0) + 1
  for (const [k, v] of Object.entries(freq).sort((a, b) => b[1] - a[1])) console.log(`  ${v}\t${k}`)

  // ── Canonical event sequence (most complete real session per condition) ─
  console.log('\n=== CANONICAL EVENT SEQUENCE (longest completed real session per condition) ===')
  for (const c of CONDITIONS) {
    const cand = analysisSet
      .filter((s) => s.cond === c && s.completed)
      .sort((a, b) => b.eventCount - a.eventCount)[0]
    if (!cand) {
      console.log(`${c}: (no completed real session)`)
      continue
    }
    console.log(`${c} (${cand.eventCount} events):`)
    console.log('  ' + cand.eventNames.join(' → '))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
