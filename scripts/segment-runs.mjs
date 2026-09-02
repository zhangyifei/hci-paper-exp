/**
 * segment-runs.mjs
 * The week's tests were all recorded under ONE browser session_id, with the
 * per-session sequence_id resetting to 0 at the start of each run. Split those
 * concatenated runs back into individual "virtual sessions", then characterize
 * the real data pattern per condition (G1–G4) for the simulator.
 */
import { readFileSync, writeFileSync } from 'node:fs'
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
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
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
    let q = db.from('experiment_events').select('*').order('id').range(offset, offset + page - 1)
    if (sinceISO) q = q.gte('created_at', sinceISO)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    if (!data || !data.length) break
    rows.push(...data)
    if (data.length < page) break
    offset += page
  }
  return rows
}

const since = new Date(Date.now() - 7 * 864e5).toISOString()
const rows = await fetchAll(since)
// Sort by insertion id (monotonic with write order), then segment on seq reset.
rows.sort((a, b) => a.id - b.id)

const runs = []
let cur = null
let prevSeq = Infinity
for (const r of rows) {
  if (r.sequence_id <= prevSeq && (cur === null || r.sequence_id === 0 || r.sequence_id < prevSeq)) {
    // boundary: start of a new run
    if (cur && cur.length) runs.push(cur)
    cur = []
  }
  cur.push(r)
  prevSeq = r.sequence_id
}
if (cur && cur.length) runs.push(cur)

console.log(`Segmented ${rows.length} rows into ${runs.length} runs.\n`)

function analyzeRun(evts) {
  const e = [...evts].sort((a, b) => a.sequence_id - b.sequence_id)
  const names = e.map((x) => x.event_name)
  const cond = e[0].condition
  const trip = e.find((x) => x.event_name === 'trip_complete.viewed')
  const s2entry = e.find((x) => x.event_name === 'service2.entry')
  const s2done = e.find((x) => x.event_name === 'service2.task.complete')
  const banner = e.find((x) => x.event_name === 'trip_complete.banner_tapped')
  const survey = e.find((x) => x.event_name === 'survey.completed')
  const quest = e.find((x) => x.event_name === 'questionnaire.completed')
  return {
    cond,
    completed: names.includes('experiment.completed'),
    invalid: names.includes('experiment.invalidated') || names.includes('attention_check.failed'),
    eventCount: e.length,
    navLagS: trip && s2entry ? (s2entry.timestamp - trip.timestamp) / 1000 : null,
    s2DurS: s2done?.duration_ms ? s2done.duration_ms / 1000 : null,
    bannerTapped: !!banner,
    survey: survey?.payload?.aggregates ?? null,
    surveyResp: survey?.payload?.responses ?? null,
    surveyDurMs: survey?.duration_ms ?? null,
    questResp: quest?.payload?.responses ?? null,
    questDurMs: quest?.duration_ms ?? null,
    names,
  }
}

const parsed = runs.map(analyzeRun)
console.log('=== RUN-BY-RUN ===')
parsed.forEach((r, i) => {
  console.log(
    `#${i} ${r.cond} | evts=${r.eventCount} done=${r.completed} invalid=${r.invalid} | navLag=${f(r.navLagS, 1)}s s2dur=${f(
      r.s2DurS,
      1,
    )}s banner=${r.bannerTapped ? 'Y' : 'n'}` + (r.survey ? ` | CL=${r.survey.cognitive_load_mean} PU=${r.survey.usability_mean} CI=${r.survey.continuance_mean} MC=${r.survey.manipulation_check_mean}` : ''),
  )
  if (r.surveyResp) console.log('     survey:', JSON.stringify(r.surveyResp))
  if (r.questResp) console.log('     quest :', JSON.stringify(r.questResp))
})

// Valid runs = has survey (completed a real pass). Keep completed & not invalid.
const valid = parsed.filter((r) => r.survey && r.completed && !r.invalid)
console.log(`\nValid completed runs (with survey): ${valid.length}`)

console.log('\n=== PER-CONDITION PATTERN (valid runs) ===')
const model = {}
for (const c of CONDITIONS) {
  const ss = valid.filter((r) => r.cond === c)
  const navs = ss.map((r) => r.navLagS).filter((x) => x != null && x > 0)
  const durs = ss.map((r) => r.s2DurS).filter((x) => x != null && x > 0)
  const cl = ss.map((r) => r.survey.cognitive_load_mean).filter(Number.isFinite)
  const pu = ss.map((r) => r.survey.usability_mean).filter(Number.isFinite)
  const ci = ss.map((r) => r.survey.continuance_mean).filter(Number.isFinite)
  const mc = ss.map((r) => r.survey.manipulation_check_mean).filter(Number.isFinite)
  const bannerRate = ss.length ? ss.filter((r) => r.bannerTapped).length / ss.length : null
  model[c] = {
    n: ss.length,
    navLag: { mean: mean(navs), sd: sd(navs) },
    s2Dur: { mean: mean(durs), sd: sd(durs) },
    cl: { mean: mean(cl), sd: sd(cl), values: cl },
    pu: { mean: mean(pu), sd: sd(pu), values: pu },
    ci: { mean: mean(ci), sd: sd(ci), values: ci },
    mc: { mean: mean(mc), sd: sd(mc), values: mc },
    bannerRate,
    surveyDurMs: mean(ss.map((r) => r.surveyDurMs).filter(Number.isFinite)),
    questDurMs: mean(ss.map((r) => r.questDurMs).filter(Number.isFinite)),
    eventCount: mean(ss.map((r) => r.eventCount)),
  }
  const m = model[c]
  console.log(
    `${c}: n=${m.n} | navLag ${f(m.navLag.mean, 1)}±${f(m.navLag.sd, 1)}s | s2dur ${f(m.s2Dur.mean, 1)}±${f(
      m.s2Dur.sd,
      1,
    )}s | banner ${m.bannerRate == null ? '—' : (m.bannerRate * 100).toFixed(0) + '%'}`,
  )
  console.log(
    `    CL ${f(m.cl.mean)}±${f(m.cl.sd)} ${JSON.stringify(m.cl.values)} | PU ${f(m.pu.mean)}±${f(m.pu.sd)} ${JSON.stringify(
      m.pu.values,
    )}`,
  )
  console.log(`    CI ${f(m.ci.mean)}±${f(m.ci.sd)} ${JSON.stringify(m.ci.values)} | MC ${f(m.mc.mean)}±${f(m.mc.sd)} ${JSON.stringify(m.mc.values)}`)
}

// Canonical event sequence per condition (longest valid run)
console.log('\n=== CANONICAL SEQUENCE (per condition) ===')
const canon = {}
for (const c of CONDITIONS) {
  const cand = valid.filter((r) => r.cond === c).sort((a, b) => b.eventCount - a.eventCount)[0]
  if (cand) {
    canon[c] = cand.names
    console.log(`${c} (${cand.eventCount}): ${cand.names.join(' → ')}`)
  } else {
    console.log(`${c}: none`)
  }
}

writeFileSync(
  path.join(ROOT, 'scripts', 'week-pattern.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), nValidRuns: valid.length, model, canon }, null, 2),
)
console.log('\nWrote scripts/week-pattern.json')
