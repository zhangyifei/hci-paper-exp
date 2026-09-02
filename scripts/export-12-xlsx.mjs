/**
 * export-12-xlsx.mjs
 * Exports the 12-record pilot dataset (5 real anon_* + 7 SIM_*, excluding BOT) to
 * docs/paper/hci-12-records.xlsx. Real runs share one browser session_id, so runs are
 * segmented by sequence_id resets — identical logic to paper-analysis.mjs.
 *
 * Sheets: Participants (one row each), Raw events (event level), Cell summary (per 2×2 cell).
 * Data mix real + synthetic; the workbook labels the source of every participant.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'

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

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN)
const sd = (a) => {
  if (a.length < 2) return NaN
  const m = mean(a)
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1))
}
const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null)

async function fetchAll() {
  const rows = []
  let off = 0
  while (true) {
    const { data, error } = await db.from('experiment_events').select('*').order('id').range(off, off + 999)
    if (error) throw new Error(error.message)
    if (!data || !data.length) break
    rows.push(...data)
    if (data.length < 1000) break
    off += 1000
  }
  return rows
}

function segment(rows) {
  const visible = rows.filter((r) => !(r.participant_id || '').includes('BOT')).slice().sort((a, b) => a.id - b.id)
  const runs = []
  let cur = null
  let prevSeq = Infinity
  for (const r of visible) {
    if (r.sequence_id <= prevSeq && (cur === null || r.sequence_id === 0 || r.sequence_id < prevSeq)) {
      if (cur && cur.length) runs.push(cur)
      cur = []
    }
    cur.push(r)
    prevSeq = r.sequence_id
  }
  if (cur && cur.length) runs.push(cur)
  return runs
}

function buildRecord(evts) {
  const done = evts.some((e) => e.event_name === 'experiment.completed')
  const invalid = evts.some((e) => e.event_name === 'experiment.invalidated' || e.event_name === 'attention_check.failed')
  const survey = evts.find((e) => e.event_name === 'survey.completed')
  if (!done || invalid || !survey?.payload?.aggregates) return null
  const cond = evts[0].condition
  const a = survey.payload.aggregates
  const resp = survey.payload.responses || {}
  const quest = evts.find((e) => e.event_name === 'questionnaire.completed')?.payload?.responses || {}
  const trip = evts.find((e) => e.event_name === 'trip_complete.viewed')
  const entry = evts.find((e) => e.event_name === 'service2.entry')
  const s2 = evts.find((e) => e.event_name === 'service2.task.complete')
  const pid = evts[0].participant_id || ''
  return {
    source: pid.startsWith('SIM_') ? 'synthetic' : 'real',
    participantId: pid,
    sessionId: evts[0].session_id,
    condition: cond,
    heterogeneity: cond === 'G3' || cond === 'G4' ? 'high' : 'low',
    interrelatedness: cond === 'G2' || cond === 'G4' ? 'present' : 'absent',
    resp,
    quest,
    aggregates: a,
    navLagS: trip && entry ? (entry.timestamp - trip.timestamp) / 1000 : null,
    s2DurS: s2?.duration_ms ? s2.duration_ms / 1000 : null,
    bannerTapped: evts.some((e) => e.event_name === 'trip_complete.banner_tapped'),
    eventCount: evts.length,
    startedAt: evts[0].created_at,
    events: [...evts].sort((x, y) => x.sequence_id - y.sequence_id),
  }
}

const SURVEY_ITEMS = ['CL1', 'CL2', 'CL3', 'PU1', 'PU2', 'PU3', 'PU4', 'CI1', 'CI2', 'CI3', 'MC1', 'MC2', 'MC3', 'MC4', 'AC1']
const QUEST_ITEMS = ['DEM1', 'DEM2', 'FAM1', 'FAM2', 'SWI1', 'SWI2', 'AC2']

async function main() {
  const rows = await fetchAll()
  const recs = segment(rows)
    .map(buildRecord)
    .filter(Boolean)
    // stable order: by cell (G1..G4), then real before synthetic, then time
    .sort((a, b) => a.condition.localeCompare(b.condition) || a.source.localeCompare(b.source) || String(a.startedAt).localeCompare(String(b.startedAt)))
  recs.forEach((r, i) => (r.pnum = `P${String(i + 1).padStart(2, '0')}`))

  const wb = new ExcelJS.Workbook()
  wb.creator = 'export-12-xlsx.mjs'
  wb.created = new Date()

  // ── Sheet 1: Participants ──
  const ws = wb.addWorksheet('Participants')
  const headers = [
    'participant', 'source', 'condition', 'heterogeneity', 'interrelatedness',
    ...SURVEY_ITEMS,
    'CL_mean', 'PU_mean', 'CI_mean', 'MC_mean',
    ...QUEST_ITEMS,
    'nav_lag_s', 'task2_dur_s', 'banner_tapped', 'event_count', 'started_at', 'participant_id', 'session_id',
  ]
  ws.addRow(headers)
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }]
  for (const r of recs) {
    ws.addRow([
      r.pnum, r.source, r.condition, r.heterogeneity, r.interrelatedness,
      ...SURVEY_ITEMS.map((k) => (r.resp[k] ?? null)),
      r2(r.aggregates.cognitive_load_mean), r2(r.aggregates.usability_mean), r2(r.aggregates.continuance_mean), r2(r.aggregates.manipulation_check_mean),
      ...QUEST_ITEMS.map((k) => (r.quest[k] ?? null)),
      r2(r.navLagS), r2(r.s2DurS), r.bannerTapped ? 'yes' : 'no', r.eventCount, r.startedAt, r.participantId, r.sessionId,
    ])
  }
  ws.columns.forEach((c) => (c.width = Math.max(10, (c.values || []).reduce((m, v) => Math.max(m, String(v ?? '').length), 0) + 2)))

  // ── Sheet 2: Raw events ──
  const we = wb.addWorksheet('Raw events')
  we.addRow(['participant', 'source', 'condition', 'sequence_id', 'event_name', 'timestamp', 'duration_ms', 'payload'])
  we.getRow(1).font = { bold: true }
  we.views = [{ state: 'frozen', ySplit: 1 }]
  for (const r of recs) {
    for (const e of r.events) {
      we.addRow([
        r.pnum, r.source, r.condition, e.sequence_id, e.event_name,
        e.timestamp ?? null, e.duration_ms ?? null, e.payload ? JSON.stringify(e.payload) : null,
      ])
    }
  }
  we.columns.forEach((c, i) => (c.width = i === 7 ? 60 : Math.max(10, (c.values || []).reduce((m, v) => Math.max(m, String(v ?? '').length), 0) + 2)))

  // ── Sheet 3: Cell summary ──
  const wc = wb.addWorksheet('Cell summary')
  wc.addRow(['condition', 'n', 'CL_mean', 'CL_sd', 'PU_mean', 'PU_sd', 'CI_mean', 'CI_sd', 'MC_mean', 'MC_sd', 'banner_rate'])
  wc.getRow(1).font = { bold: true }
  for (const c of ['G1', 'G2', 'G3', 'G4']) {
    const cell = recs.filter((r) => r.condition === c)
    const col = (key) => cell.map((r) => r.aggregates[key])
    wc.addRow([
      c, cell.length,
      r2(mean(col('cognitive_load_mean'))), r2(sd(col('cognitive_load_mean'))),
      r2(mean(col('usability_mean'))), r2(sd(col('usability_mean'))),
      r2(mean(col('continuance_mean'))), r2(sd(col('continuance_mean'))),
      r2(mean(col('manipulation_check_mean'))), r2(sd(col('manipulation_check_mean'))),
      r2(mean(cell.map((r) => (r.bannerTapped ? 1 : 0)))),
    ])
  }
  wc.columns.forEach((c) => (c.width = 12))

  const outPath = path.join(ROOT, 'docs', 'paper', 'hci-12-records.xlsx')
  await wb.xlsx.writeFile(outPath)
  const bySource = recs.reduce((m, r) => ((m[r.source] = (m[r.source] || 0) + 1), m), {})
  console.log(`Wrote ${recs.length} participants (${JSON.stringify(bySource)}) to docs/paper/hci-12-records.xlsx`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
