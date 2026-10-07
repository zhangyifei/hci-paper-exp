import 'server-only'

import ExcelJS from 'exceljs'
import {
  CONSTRUCT_ITEMS, CONSTRUCT_KEYS, CONSTRUCT_NAMES, DESIGN, ITEMS, ITEM_WORDING, QUEST_CODES, REVERSE, SURVEY_CODES,
  constructScore, scoreItem,
} from './instrument'
import type { AssignmentRow, BatchExportData, EventRow } from './load-batch'
import type { ProlificSubmission } from './prolific'

type Cell = string | number | boolean | null
type Row = Record<string, Cell>

const HEADER_FILL = 'FF1B2A4A'
const BOT_PID = /BOT/i

interface ParticipantRecord {
  a: AssignmentRow
  sub: ProlificSubmission | undefined
  events: EventRow[]
  included: boolean
  exclusionReason: string
  survey: Record<string, unknown>
  quest: Record<string, unknown>
  service2Sec: number | null
  sessionSec: number | null
  bannerTapped: boolean
  reminders: number
}

const round = (x: number | null | undefined, digits = 2): number | null =>
  x == null || Number.isNaN(x) ? null : Number(x.toFixed(digits))
const cell = (v: unknown): Cell =>
  v == null ? null : typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' ? v : JSON.stringify(v)
const responsesOf = (e: EventRow | undefined): Record<string, unknown> => {
  const r = e?.payload?.responses
  return r && typeof r === 'object' ? (r as Record<string, unknown>) : {}
}

function exclusionReason(a: AssignmentRow, sub: ProlificSubmission | undefined): string {
  if (BOT_PID.test(a.prolific_pid)) return 'automated test session'
  if (a.status === 'completed') return ''
  if (a.invalid_reason) return `failed ${a.invalid_reason}`
  return sub ? `${a.status} (Prolific: ${sub.status})` : a.status
}

function toRecords(data: BatchExportData): ParticipantRecord[] {
  const submissions = data.prolific.available ? data.prolific.submissions : []
  const records = data.assignments.map((a) => {
    const events = a.exp_session_id ? data.eventsBySession.get(a.exp_session_id) ?? [] : []
    const find = (name: string) => events.find((e) => e.event_name === name)
    const sub = submissions.find((s) => s.participant_id === a.prolific_pid)
    const ts = events.map((e) => Number(e.timestamp)).filter(Number.isFinite)
    const s2 = find('service2.task.complete')
    const reason = exclusionReason(a, sub)
    return {
      a, sub, events,
      included: reason === '',
      exclusionReason: reason,
      survey: responsesOf(find('survey.completed')),
      quest: responsesOf(find('questionnaire.completed')),
      service2Sec: s2?.duration_ms != null ? s2.duration_ms / 1000 : null,
      sessionSec: ts.length ? (Math.max(...ts) - Math.min(...ts)) / 1000 : null,
      bannerTapped: events.some((e) => e.event_name === 'trip_complete.banner_tapped'),
      reminders: events.filter((e) => e.event_name === 'guidance.banner_shown').length,
    }
  })
  return records.sort(
    (x, y) => Number(y.included) - Number(x.included) || x.a.group_condition.localeCompare(y.a.group_condition),
  )
}

function addSheet(wb: ExcelJS.Workbook, name: string, columns: [string, number?][], rows: Row[]): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = columns.map(([key, width]) => ({ header: key, key, width: width ?? Math.min(Math.max(key.length + 2, 9), 28) }))
  rows.forEach((r) => ws.addRow(r))
  const header = ws.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
  if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  return ws
}

const designCols = (p: ParticipantRecord): Row => ({
  condition: p.a.group_condition,
  heterogeneity: DESIGN[p.a.group_condition].het,
  interrelatedness: DESIGN[p.a.group_condition].inter,
  second_service: DESIGN[p.a.group_condition].svc2,
})

function addReadme(wb: ExcelJS.Workbook, data: BatchExportData, records: ParticipantRecord[]): void {
  const included = records.filter((r) => r.included)
  const perCell = (['G1', 'G2', 'G3', 'G4'] as const).map((c) => `${c}=${included.filter((r) => r.a.group_condition === c).length}`).join(', ')
  const p = data.prolific
  const ws = wb.addWorksheet('README')
  ws.columns = [{ width: 28 }, { width: 110 }]
  const rows: [string, string][] = [
    ['Study', 'Super-app cross-service experience — 2 × 2 between-subjects (heterogeneity × interrelatedness), study-v2 instrument'],
    ['App batch', `${data.batch.name} (${data.batch.id}) — ${data.batch.status}, ${data.batch.group_size} per group, created ${data.batch.created_at}`],
    ['Prolific study', p.available
      ? `${p.study.name} (${p.studyId}) — ${p.study.status} · $${(p.study.reward / 100).toFixed(2)} · est. ${p.study.estimated_completion_time} min · max ${p.study.maximum_allowed_time} min`
      : `${p.studyId ?? '—'} — Prolific columns left blank: ${p.reason}`],
    ['Participants', `${records.length} assigned in the app; ${included.length} completed and included (${perCell})`],
    ['Inclusion rule', 'App status = completed (full event trail, attention check passed) and not an automated test session. Excluded rows stay in "Raw Responses" with included = FALSE and a reason.'],
    ['Generated', new Date().toISOString()],
    ['', ''],
    ['Sheet: Raw Responses', 'One row per participant. Survey items are RAW 1–7 answers (no reverse scoring). Background answers are stored codes (see Codebook).'],
    ['Sheet: Scored', 'Included participants only. Reverse-coded items flipped (8 − x) in *_r columns; construct scores are item means.'],
    ['Sheet: Event Log', 'Every instrumentation event for every participant in the batch, with the payload as JSON.'],
    ['Sheet: Disposition', 'App status vs Prolific status for every participant, plus Prolific submissions with no app record.'],
    ['Sheet: Codebook', 'Variable definitions and verbatim item wording.'],
    ['', ''],
    ['Privacy', 'participant_id is a pseudonymous Prolific ID. Keep this file access-controlled; do not share publicly.'],
  ]
  rows.forEach((r) => ws.addRow(r))
  ws.getColumn(1).font = { bold: true }
  ws.getColumn(2).alignment = { wrapText: true, vertical: 'top' }
}

function addRawResponses(wb: ExcelJS.Workbook, records: ParticipantRecord[]): void {
  const columns: [string, number?][] = [
    ['participant_id', 28], ['included', 10], ['exclusion_reason', 30],
    ['condition'], ['heterogeneity'], ['interrelatedness'], ['second_service'],
    ...SURVEY_CODES.map((c): [string, number] => [c, 7]), ...QUEST_CODES.map((c): [string, number] => [c, 11]),
    ['banner_tapped'], ['reminders_shown'], ['service2_task_sec'], ['session_sec'],
    ['prolific_status', 18], ['completion_code'], ['prolific_time_min'], ['prolific_started_at', 24], ['prolific_completed_at', 24],
    ['app_status'], ['app_assigned_at', 24], ['app_completed_at', 24], ['prolific_session_id', 28], ['app_session_id', 38],
  ]
  addSheet(wb, 'Raw Responses', columns, records.map((p) => ({
    participant_id: p.a.prolific_pid, included: p.included, exclusion_reason: p.exclusionReason, ...designCols(p),
    ...Object.fromEntries(SURVEY_CODES.map((c) => [c, cell(p.survey[c])])),
    ...Object.fromEntries(QUEST_CODES.map((c) => [c, cell(p.quest[c])])),
    banner_tapped: p.events.length ? p.bannerTapped : null,
    reminders_shown: p.events.length ? p.reminders : null,
    service2_task_sec: round(p.service2Sec),
    session_sec: round(p.sessionSec, 0),
    prolific_status: p.sub?.status ?? null,
    completion_code: p.sub?.study_code ?? null,
    prolific_time_min: round(p.sub?.time_taken != null ? p.sub.time_taken / 60 : null),
    prolific_started_at: p.sub?.started_at ?? null,
    prolific_completed_at: p.sub?.completed_at ?? null,
    app_status: p.a.status, app_assigned_at: p.a.assigned_at, app_completed_at: p.a.completed_at,
    prolific_session_id: p.a.prolific_session_id, app_session_id: p.a.exp_session_id,
  })))
}

function addScored(wb: ExcelJS.Workbook, records: ParticipantRecord[]): void {
  const itemKey = (c: string) => (REVERSE.has(c) ? `${c}_r` : c)
  const columns: [string, number?][] = [
    ['participant_id', 28], ['condition'], ['heterogeneity'], ['interrelatedness'], ['second_service'],
    ...CONSTRUCT_ITEMS.map((c): [string, number] => [itemKey(c), 8]),
    ...CONSTRUCT_KEYS.map((k): [string, number] => [k, 8]),
    ['banner_tapped'], ['service2_task_sec'], ['session_sec'],
  ]
  addSheet(wb, 'Scored', columns, records.filter((p) => p.included).map((p) => ({
    participant_id: p.a.prolific_pid, ...designCols(p),
    ...Object.fromEntries(CONSTRUCT_ITEMS.map((c) => {
      const v = p.survey[c]
      return [itemKey(c), typeof v === 'number' ? scoreItem(c, v) : null]
    })),
    ...Object.fromEntries(CONSTRUCT_KEYS.map((k) => [k, round(constructScore(p.survey, k), 3)])),
    banner_tapped: p.bannerTapped, service2_task_sec: round(p.service2Sec), session_sec: round(p.sessionSec, 0),
  })))
}

function addEventLog(wb: ExcelJS.Workbook, records: ParticipantRecord[]): void {
  const columns: [string, number?][] = [
    ['participant_id', 28], ['included', 10], ['condition'], ['sequence_id', 11], ['event_name', 34], ['flow', 14], ['state', 26],
    ['timestamp_iso', 26], ['timestamp_ms', 15], ['client_mono_ms', 15], ['duration_ms', 12], ['payload', 70], ['error', 16],
    ['event_id', 38], ['parent_event_id', 38],
  ]
  addSheet(wb, 'Event Log', columns, records.flatMap((p) => p.events.map((e) => ({
    participant_id: p.a.prolific_pid, included: p.included, condition: e.condition, sequence_id: e.sequence_id,
    event_name: e.event_name, flow: e.flow, state: e.state,
    timestamp_iso: new Date(Number(e.timestamp)).toISOString(), timestamp_ms: Number(e.timestamp),
    client_mono_ms: round(e.client_mono_ms, 1), duration_ms: round(e.duration_ms, 1),
    payload: e.payload ? JSON.stringify(e.payload) : null, error: e.error, event_id: e.event_id, parent_event_id: e.parent_event_id,
  }))))
}

function addDisposition(wb: ExcelJS.Workbook, data: BatchExportData, records: ParticipantRecord[]): void {
  const assigned = new Set(records.map((r) => r.a.prolific_pid))
  const orphans = data.prolific.available ? data.prolific.submissions.filter((s) => !assigned.has(s.participant_id)) : []
  addSheet(wb, 'Disposition', [
    ['participant_id', 28], ['condition'], ['app_status', 12], ['invalid_reason', 20], ['prolific_status', 18],
    ['completion_code'], ['included', 10], ['exclusion_reason', 34],
  ], [
    ...records.map((p) => ({
      participant_id: p.a.prolific_pid, condition: p.a.group_condition, app_status: p.a.status, invalid_reason: p.a.invalid_reason,
      prolific_status: p.sub?.status ?? (data.prolific.available ? 'no submission' : null), completion_code: p.sub?.study_code ?? null,
      included: p.included, exclusion_reason: p.exclusionReason,
    })),
    ...orphans.map((s) => ({
      participant_id: s.participant_id, condition: null, app_status: 'not assigned', invalid_reason: null,
      prolific_status: s.status, completion_code: s.study_code ?? null, included: false,
      exclusion_reason: 'Prolific submission without an app assignment',
    })),
  ])
}

function addCodebook(wb: ExcelJS.Workbook): void {
  const constructOf = (code: string) => CONSTRUCT_KEYS.find((k) => (ITEMS[k] as readonly string[]).includes(code))
  const defs: [string, string, string, string][] = [
    ['participant_id', 'Prolific participant ID (pseudonymous key linking app ↔ Prolific)', 'string', ''],
    ['included', 'Included in analysis (completed, full event trail, attention check passed, not a test session)', 'TRUE/FALSE', ''],
    ['condition', 'Assigned experimental cell', 'G1 / G2 / G3 / G4', ''],
    ['heterogeneity', 'Service-pair dissimilarity factor', 'low (Courier) / high (Cinema)', ''],
    ['interrelatedness', 'Cross-service bridge (banner + auto-filled details)', 'absent / present', ''],
    ['second_service', 'Second service in the episode', 'Courier / Cinema', ''],
    ...SURVEY_CODES.map((c): [string, string, string, string] => {
      const k = constructOf(c)
      const description = k
        ? `${CONSTRUCT_NAMES[k]}${REVERSE.has(c) ? ' (reverse-coded: scored 8 − x)' : ''}`
        : 'Attention check (correct = 5 "Somewhat agree")'
      return [c, description, '1–7', ITEM_WORDING[c]]
    }),
    ['DEM1', 'Age group', '18-24 · 25-34 · 35-44 · 45-54 · 55-64 · 65+ · prefer-not-to-say', ITEM_WORDING.DEM1],
    ['DEM2', 'Gender', 'female (Woman) · male (Man) · non-binary · prefer-not-to-say', ITEM_WORDING.DEM2],
    ['FAM1', 'Mobile service app use frequency', 'never · rarely · monthly · weekly · daily', ITEM_WORDING.FAM1],
    ['FAM2', 'Familiarity with super / multi-service apps', '1 Not familiar at all … 5 Extremely familiar', ITEM_WORDING.FAM2],
    ['SWI2', 'Frequency of switching services/features within an app', 'never · rarely · sometimes · often · always', ITEM_WORDING.SWI2],
    ['CL / PU / CI / MCi / MCh', 'Construct score = mean of items after reverse scoring (Scored sheet)', '1–7',
      'CL: CL1–3 · PU: PU1, PU2, PU7, PU4 · CI: CI1, CI3, CI2 · MCi: MC1, MC2, MC5r · MCh: MC3, MC4, MC6r'],
    ['*_r', 'Reverse-scored item (8 − raw)', '1–7', ''],
    ['banner_tapped', 'Tapped the cross-service bridge banner (trip_complete.banner_tapped)', 'TRUE/FALSE', 'Only possible in G2/G4'],
    ['reminders_shown', 'Idle "Task reminder" pop-ups (guidance.banner_shown) — all conditions, not the bridge', 'count', ''],
    ['service2_task_sec', 'Service-2 task time: Service-2 entry → task completion', 'seconds', ''],
    ['session_sec', 'Wall-clock span from first to last app event', 'seconds', ''],
    ['prolific_time_min', 'Prolific-recorded time taken', 'minutes', ''],
    ['prolific_status', 'Prolific submission status at export time', 'AWAITING REVIEW / APPROVED / REJECTED / TIMED-OUT / RETURNED', ''],
    ['completion_code', 'Code returned to Prolific by the app', 'VALID12 (valid) / FAILAC12 (failed attention check)', ''],
  ]
  const ws = addSheet(wb, 'Codebook', [['variable', 26], ['description', 70], ['values', 46], ['item wording', 90]],
    defs.map(([variable, description, values, wording]) => ({ variable, description, values, 'item wording': wording })))
  ws.getColumn(2).alignment = { wrapText: true, vertical: 'top' }
  ws.getColumn(4).alignment = { wrapText: true, vertical: 'top' }
}

/** Builds the raw-data workbook for one batch and returns the .xlsx bytes. */
export async function buildBatchWorkbook(data: BatchExportData): Promise<ArrayBuffer> {
  const records = toRecords(data)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'HCI Experiment Harness'
  wb.created = new Date()
  addReadme(wb, data, records)
  addRawResponses(wb, records)
  addScored(wb, records)
  addEventLog(wb, records)
  addDisposition(wb, data, records)
  addCodebook(wb)
  return wb.xlsx.writeBuffer()
}
