/**
 * Export the raw data of one Prolific batch to an Excel workbook (read-only).
 * Sheets: README, Raw Responses (all Prolific participants, with inclusion flag),
 * Scored (included only, analysis-ready), Event Log, Disposition, Codebook.
 * Usage: node scripts/export-batch-xlsx.mjs [batchId] [prolificStudyId] [outBase]
 */
import path from 'node:path'
import { mkdirSync } from 'node:fs'
import ExcelJS from 'exceljs'
import {
  OUT, DEFAULT_BATCH_ID, DEFAULT_STUDY_ID, db, prolific, query,
  ITEMS, REVERSE, SURVEY_CODES, QUEST_CODES, PROLIFIC_PID, DESIGN, CONSTRUCT_NAMES, ITEM_WORDING, scored, construct,
} from './lib/batch-common.mjs'

const BATCH_ID = process.argv[2] || DEFAULT_BATCH_ID
const STUDY_ID = process.argv[3] || DEFAULT_STUDY_ID
const OUT_BASE = process.argv[4] || 'prolific-us-ca-18-50-raw-data'
const round = (x, d = 2) => (x == null || Number.isNaN(x) ? null : Number(x.toFixed(d)))
const iso = (ms) => (ms ? new Date(Number(ms)).toISOString() : null)

// ── fetch ────────────────────────────────────────────────────────────────────
const study = await prolific(`/studies/${STUDY_ID}/`)
const submissions = (await prolific(`/studies/${STUDY_ID}/submissions/?limit=500`)).results || []
const batch = await query(db.from('test_batches').select('*').eq('id', BATCH_ID).single(), 'batch')
const assignments = (await query(
  db.from('participant_assignments').select('*').eq('batch_id', BATCH_ID).order('assigned_at'), 'assignments',
)).filter((a) => PROLIFIC_PID.test(a.prolific_pid))

const people = []
for (const a of assignments) {
  const events = a.exp_session_id
    ? await query(db.from('experiment_events').select('*').eq('session_id', a.exp_session_id).order('sequence_id'), 'events')
    : []
  const find = (n) => events.find((e) => e.event_name === n)
  const sub = submissions.find((s) => s.participant_id === a.prolific_pid)
  const included = a.status === 'completed'
  const ts = events.map((e) => Number(e.timestamp))
  people.push({
    a, sub, events, included,
    exclusionReason: included ? '' : a.invalid_reason ? `failed ${a.invalid_reason}` : `${a.status} (${sub?.status ?? 'no Prolific submission'})`,
    survey: find('survey.completed')?.payload?.responses || {},
    quest: find('questionnaire.completed')?.payload?.responses || {},
    s2: find('service2.task.complete'),
    sessionSec: ts.length ? (Math.max(...ts) - Math.min(...ts)) / 1000 : null,
    banner: events.some((e) => e.event_name === 'trip_complete.banner_tapped'),
    reminders: events.filter((e) => e.event_name === 'guidance.banner_shown').length,
  })
}
people.sort((x, y) => Number(y.included) - Number(x.included) || x.a.group_condition.localeCompare(y.a.group_condition))
const included = people.filter((p) => p.included)
if (!included.length) throw new Error('No completed Prolific participants in this batch')

// ── workbook ─────────────────────────────────────────────────────────────────
const wb = new ExcelJS.Workbook()
wb.creator = 'HCI Experiment Harness'
wb.created = new Date()

function addSheet(name, columns, rows) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = columns.map(([key, width]) => ({ header: key, key, width: width ?? Math.min(Math.max(key.length + 2, 9), 28) }))
  rows.forEach((r) => ws.addRow(r))
  const header = ws.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A4A' } }
  header.alignment = { vertical: 'middle' }
  if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  return ws
}

const designCols = (p) => ({
  condition: p.a.group_condition,
  heterogeneity: DESIGN[p.a.group_condition].het,
  interrelatedness: DESIGN[p.a.group_condition].inter,
  second_service: DESIGN[p.a.group_condition].svc2,
})

// README
const readme = wb.addWorksheet('README')
readme.columns = [{ width: 30 }, { width: 110 }]
const README_ROWS = [
  ['Study', 'Super-app cross-service experience — 2 × 2 between-subjects (heterogeneity × interrelatedness), study-v2 instrument'],
  ['App batch', `${batch.name} (${BATCH_ID})`],
  ['Prolific study', `${study.name} (${STUDY_ID}) — status ${study.status}`],
  ['Eligibility', 'Country of residence US or Canada; age 18–50; Pilot-1 participants blocked'],
  ['Reward / time', `$${(study.reward / 100).toFixed(2)} · estimated ${study.estimated_completion_time} min · max ${study.maximum_allowed_time} min`],
  ['Participants', `${people.length} Prolific participants assigned in the app; ${included.length} completed and included (${['G1', 'G2', 'G3', 'G4'].map((c) => `${c}=${included.filter((p) => p.a.group_condition === c).length}`).join(', ')})`],
  ['Inclusion rule', 'App status = completed (full event trail, attention check AC1 passed). Excluded rows are kept in "Raw Responses" with included = FALSE and a reason.'],
  ['Generated', new Date().toISOString()],
  ['', ''],
  ['Sheet: Raw Responses', 'One row per Prolific participant. Survey items are RAW 1–7 answers (no reverse scoring). Background answers are stored codes (see Codebook).'],
  ['Sheet: Scored', 'Included participants only. Reverse-coded items flipped (8 − x) in *_r columns; construct scores are item means.'],
  ['Sheet: Event Log', 'Every instrumentation event for every Prolific participant in the batch (one row per event), with the payload as JSON.'],
  ['Sheet: Disposition', 'App status vs Prolific status for every participant, including Prolific submissions with no app record.'],
  ['Sheet: Codebook', 'Variable definitions and verbatim item wording.'],
  ['', ''],
  ['Privacy', 'participant_id is a pseudonymous Prolific ID. Keep this file access-controlled; do not commit or share publicly.'],
]
README_ROWS.forEach((r) => readme.addRow(r))
readme.getColumn(1).font = { bold: true }
readme.getColumn(2).alignment = { wrapText: true, vertical: 'top' }

// Raw Responses
const rawCols = [
  ['participant_id', 28], ['included', 10], ['exclusion_reason', 30],
  ['condition'], ['heterogeneity'], ['interrelatedness'], ['second_service'],
  ...SURVEY_CODES.map((c) => [c, 7]), ...QUEST_CODES.map((c) => [c, 11]),
  ['banner_tapped'], ['reminders_shown'], ['service2_task_sec'], ['session_sec'],
  ['prolific_status', 18], ['completion_code'], ['prolific_time_min'], ['prolific_started_at', 24], ['prolific_completed_at', 24],
  ['app_assigned_at', 24], ['app_completed_at', 24], ['prolific_session_id', 28], ['app_session_id', 38],
]
addSheet('Raw Responses', rawCols, people.map((p) => ({
  participant_id: p.a.prolific_pid, included: p.included, exclusion_reason: p.exclusionReason, ...designCols(p),
  ...Object.fromEntries(SURVEY_CODES.map((c) => [c, p.survey[c] ?? null])),
  ...Object.fromEntries(QUEST_CODES.map((c) => [c, p.quest[c] ?? null])),
  banner_tapped: p.events.length ? p.banner : null,
  reminders_shown: p.events.length ? p.reminders : null,
  service2_task_sec: round(p.s2?.duration_ms ? p.s2.duration_ms / 1000 : null),
  session_sec: round(p.sessionSec, 0),
  prolific_status: p.sub?.status ?? null, completion_code: p.sub?.study_code ?? null,
  prolific_time_min: round(p.sub?.time_taken ? p.sub.time_taken / 60 : null),
  prolific_started_at: p.sub?.started_at ?? null, prolific_completed_at: p.sub?.completed_at ?? null,
  app_assigned_at: p.a.assigned_at, app_completed_at: p.a.completed_at,
  prolific_session_id: p.a.prolific_session_id ?? null, app_session_id: p.a.exp_session_id ?? null,
})))

// Scored
const allItems = Object.values(ITEMS).flat()
addSheet('Scored', [
  ['participant_id', 28], ['condition'], ['heterogeneity'], ['interrelatedness'], ['second_service'],
  ...allItems.map((c) => [REVERSE.has(c) ? `${c}_r` : c, 8]),
  ...Object.keys(ITEMS).map((k) => [k, 8]),
  ['banner_tapped'], ['service2_task_sec'], ['session_sec'],
], included.map((p) => ({
  participant_id: p.a.prolific_pid, ...designCols(p),
  ...Object.fromEntries(allItems.map((c) => [REVERSE.has(c) ? `${c}_r` : c, scored(c, p.survey[c])])),
  ...Object.fromEntries(Object.keys(ITEMS).map((k) => [k, round(construct(p.survey, k), 3)])),
  banner_tapped: p.banner, service2_task_sec: round(p.s2?.duration_ms ? p.s2.duration_ms / 1000 : null), session_sec: round(p.sessionSec, 0),
})))

// Event Log
const eventRows = people.flatMap((p) => p.events.map((e) => ({
  participant_id: p.a.prolific_pid, included: p.included, condition: e.condition, sequence_id: e.sequence_id,
  event_name: e.event_name, flow: e.flow, state: e.state,
  timestamp_iso: iso(e.timestamp), timestamp_ms: Number(e.timestamp), client_mono_ms: round(e.client_mono_ms, 1),
  duration_ms: round(e.duration_ms, 1), payload: e.payload ? JSON.stringify(e.payload) : null, error: e.error ?? null,
  event_id: e.event_id, parent_event_id: e.parent_event_id ?? null,
})))
addSheet('Event Log', [
  ['participant_id', 28], ['included', 10], ['condition'], ['sequence_id', 11], ['event_name', 34], ['flow', 14], ['state', 26],
  ['timestamp_iso', 26], ['timestamp_ms', 15], ['client_mono_ms', 15], ['duration_ms', 12], ['payload', 70], ['error', 16],
  ['event_id', 38], ['parent_event_id', 38],
], eventRows)

// Disposition
const assignedPids = new Set(people.map((p) => p.a.prolific_pid))
addSheet('Disposition', [
  ['participant_id', 28], ['condition'], ['app_status', 12], ['invalid_reason', 20], ['prolific_status', 18], ['completion_code'], ['included', 10], ['note', 50],
], [
  ...people.map((p) => ({
    participant_id: p.a.prolific_pid, condition: p.a.group_condition, app_status: p.a.status, invalid_reason: p.a.invalid_reason ?? null,
    prolific_status: p.sub?.status ?? 'no submission', completion_code: p.sub?.study_code ?? null, included: p.included,
    note: p.included ? '' : 'Place released/invalidated in the app and refilled in the same cell',
  })),
  ...submissions.filter((s) => !assignedPids.has(s.participant_id)).map((s) => ({
    participant_id: s.participant_id, condition: null, app_status: 'not assigned', invalid_reason: null,
    prolific_status: s.status, completion_code: s.study_code ?? null, included: false, note: 'Prolific submission without an app assignment',
  })),
])

// Codebook
const designDefs = [
  ['participant_id', 'Prolific participant ID (pseudonymous key linking app ↔ Prolific)', 'string', ''],
  ['included', 'Included in analysis (app status completed, AC1 passed, full event trail)', 'TRUE/FALSE', ''],
  ['condition', 'Assigned experimental cell', 'G1 / G2 / G3 / G4', ''],
  ['heterogeneity', 'Service-pair dissimilarity factor', 'low (Courier) / high (Cinema)', ''],
  ['interrelatedness', 'Cross-service bridge (banner + auto-filled details)', 'absent / present', ''],
  ['second_service', 'Second service in the episode', 'Courier / Cinema', ''],
]
const itemDefs = SURVEY_CODES.map((c) => {
  const k = Object.keys(ITEMS).find((key) => ITEMS[key].includes(c))
  return [c, k ? `${CONSTRUCT_NAMES[k]}${REVERSE.has(c) ? ' (reverse-coded: scored 8 − x)' : ''}` : 'Attention check (correct = 5 "Somewhat agree")', '1–7', ITEM_WORDING[c]]
})
const questDefs = [
  ['DEM1', 'Age range', '18-24 · 25-34 · 35-44 · 45-54 · 55+', ITEM_WORDING.DEM1],
  ['DEM2', 'Gender', 'male · female · non-binary · prefer-not-to-say', ITEM_WORDING.DEM2],
  ['FAM1', 'Multi-service app use frequency', 'never · rarely (few times a year) · monthly · weekly · daily', ITEM_WORDING.FAM1],
  ['FAM2', 'Familiarity with switching services', '1 Not at all … 5 Extremely familiar', ITEM_WORDING.FAM2],
  ['SWI1', 'Services used per session', '1 · 2 · 3 · 4+ · single-app', ITEM_WORDING.SWI1],
  ['SWI2', 'Mid-session switching frequency', 'never · rarely · sometimes · often · always', ITEM_WORDING.SWI2],
]
const derivedDefs = [
  ['CL / PU / CI / MCi / MCh', 'Construct score = mean of items after reverse scoring (Scored sheet)', '1–7', 'CL: CL1–3 · PU: PU1–6 (PU3, PU5, PU6 reversed) · CI: CI1–4 (CI4 reversed) · MCi: MC1, MC2, MC5r · MCh: MC3, MC4, MC6r'],
  ['*_r', 'Reverse-scored item (8 − raw)', '1–7', ''],
  ['banner_tapped', 'Tapped the cross-service bridge banner (event trip_complete.banner_tapped)', 'TRUE/FALSE', 'Only possible in G2/G4'],
  ['reminders_shown', 'Idle "Task reminder" pop-ups shown (guidance.banner_shown) — all conditions, not the bridge', 'count', ''],
  ['service2_task_sec', 'Service-2 task time: performance.measure from Service-2 entry to task completion', 'seconds', ''],
  ['session_sec', 'Wall-clock span from first to last app event', 'seconds', ''],
  ['prolific_time_min', 'Prolific-recorded time taken', 'minutes', ''],
  ['prolific_status', 'Prolific submission status at export time', 'AWAITING REVIEW / APPROVED / REJECTED / TIMED-OUT / RETURNED', ''],
  ['completion_code', 'Code returned to Prolific by the app', 'VALID12 (valid) / FAILAC12 (failed attention check)', ''],
]
const cb = addSheet('Codebook', [['variable', 26], ['description', 70], ['values', 46], ['item wording', 90]],
  [...designDefs, ...itemDefs, ...questDefs, ...derivedDefs].map(([variable, description, values, wording]) => ({ variable, description, values, 'item wording': wording })))
cb.getColumn(2).alignment = { wrapText: true, vertical: 'top' }
cb.getColumn(4).alignment = { wrapText: true, vertical: 'top' }

mkdirSync(OUT, { recursive: true })
const file = path.join(OUT, `${OUT_BASE}.xlsx`)
await wb.xlsx.writeFile(file)
console.log(`Wrote ${file}`)
console.log(`Participants: ${people.length} (included ${included.length}) · events: ${eventRows.length} · Prolific submissions: ${submissions.length}`)
