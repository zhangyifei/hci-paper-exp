/**
 * Read-only data-analysis report for one Prolific batch (study-v2 instrument).
 * Joins Supabase (assignments + events) with the Prolific study/submissions and
 * writes a self-contained HTML report + JSON companion to docs/paper/ (git-ignored).
 * Usage: node scripts/batch-report.mjs [batchId] [prolificStudyId] [outBase]
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { mean, sd, median, rd, welch, pearson, cronbachAlpha, anova2x2, nPerGroupFor80 } from './lib/stats.mjs'
import { dotPlot, interactionPlot, CELL_COLORS } from './lib/report-charts.mjs'
import {
  OUT, DEFAULT_BATCH_ID, DEFAULT_STUDY_ID, db, prolific, query,
  ITEMS, REVERSE, SURVEY_CODES, QUEST_CODES, PROLIFIC_PID, CELLS, DESIGN, CONSTRUCT_NAMES, ITEM_TEXT, scored, construct,
} from './lib/batch-common.mjs'

const BATCH_ID = process.argv[2] || DEFAULT_BATCH_ID
const STUDY_ID = process.argv[3] || DEFAULT_STUDY_ID
const OUT_BASE = process.argv[4] || 'prolific-batch2-report'

const REQUIRED_EVENTS = ['experiment.completed', 'service2.task.complete', 'survey.completed', 'questionnaire.completed']
const FAILURE_EVENTS = ['attention_check.failed', 'experiment.invalidated']
const AC1_CORRECT = 5
const STRAIGHTLINE_SD = 0.5
const SPEEDER_FRACTION = 1 / 3

// ── fetch ────────────────────────────────────────────────────────────────────
const study = await prolific(`/studies/${STUDY_ID}/`)
const submissions = (await prolific(`/studies/${STUDY_ID}/submissions/?limit=500`)).results || []
const blocklist = new Set((study.filters || []).find((f) => f.filter_id === 'custom_blocklist')?.selected_values || [])
const batch = await query(db.from('test_batches').select('*').eq('id', BATCH_ID).single(), 'batch')
const assignments = await query(db.from('participant_assignments').select('*').eq('batch_id', BATCH_ID).order('assigned_at'), 'assignments')
const realAssignments = assignments.filter((a) => PROLIFIC_PID.test(a.prolific_pid))
const completed = realAssignments.filter((a) => a.status === 'completed')

const recs = []
for (const a of completed) {
  const events = await query(
    db.from('experiment_events')
      .select('event_name,sequence_id,timestamp,duration_ms,payload,condition,participant_id')
      .eq('session_id', a.exp_session_id).order('sequence_id'),
    'events',
  )
  const { count: otherSessionEvents } = await db.from('experiment_events')
    .select('id', { count: 'exact', head: true })
    .eq('participant_id', a.prolific_pid).neq('session_id', a.exp_session_id)
  const names = new Set(events.map((e) => e.event_name))
  const find = (n) => events.find((e) => e.event_name === n)
  const survey = find('survey.completed')?.payload?.responses || {}
  const quest = find('questionnaire.completed')?.payload?.responses || {}
  const seqs = events.map((e) => e.sequence_id)
  const ts = events.map((e) => Number(e.timestamp))
  const sub = submissions.find((s) => s.participant_id === a.prolific_pid)
  const answers = Object.values(ITEMS).flat().map((c) => survey[c])
  const d = DESIGN[a.group_condition]
  recs.push({
    pid: a.prolific_pid, cond: a.group_condition, ...d,
    survey, quest,
    CL: construct(survey, 'CL'), PU: construct(survey, 'PU'), CI: construct(survey, 'CI'),
    MCi: construct(survey, 'MCi'), MCh: construct(survey, 'MCh'),
    banner: names.has('trip_complete.banner_tapped'),
    reminders: events.filter((e) => e.event_name === 'guidance.banner_shown').length,
    s2Sec: find('service2.task.complete')?.duration_ms ? find('service2.task.complete').duration_ms / 1000 : null,
    totalSec: ts.length ? (Math.max(...ts) - Math.min(...ts)) / 1000 : null,
    prolificMin: sub?.time_taken ? sub.time_taken / 60 : null,
    prolificStatus: sub?.status ?? 'none', prolificCode: sub?.study_code ?? null,
    answerSd: sd(answers.filter(Number.isFinite)),
    checks: {
      prolificMatch: Boolean(sub) && sub.study_code === 'VALID12',
      fullTrail: REQUIRED_EVENTS.every((n) => names.has(n)) && !FAILURE_EVENTS.some((n) => names.has(n)),
      eventIntegrity: events.every((e) => e.condition === a.group_condition && e.participant_id === a.prolific_pid)
        && new Set(seqs).size === seqs.length && seqs.every((s, i) => i === 0 || s > seqs[i - 1]),
      surveyComplete: SURVEY_CODES.every((c) => Number.isInteger(survey[c]) && survey[c] >= 1 && survey[c] <= 7),
      questComplete: QUEST_CODES.every((c) => quest[c] != null && quest[c] !== ''),
      attention: survey.AC1 === AC1_CORRECT,
      unique: !otherSessionEvents && !blocklist.has(a.prolific_pid),
      fidelity: d.inter === 'present' || !names.has('trip_complete.banner_tapped'),
    },
    soft: [
      survey.MC3 >= 6 && survey.MC6 >= 6 ? 'agrees with both MC3 & MC6' : null,
      survey.MC2 >= 6 && survey.MC5 >= 6 ? 'agrees with both MC2 & MC5' : null,
      mean(['PU1', 'PU2', 'PU4'].map((c) => survey[c])) >= 6 && mean(['PU3', 'PU5', 'PU6'].map((c) => survey[c])) >= 6 ? 'PU acquiescence' : null,
    ].filter(Boolean),
  })
}
if (!recs.length) throw new Error('No completed Prolific participants in this batch')

const medianTotal = median(recs.map((r) => r.totalSec))
for (const r of recs) {
  r.checks.notStraightlining = r.answerSd >= STRAIGHTLINE_SD
  r.checks.notSpeeder = r.totalSec >= medianTotal * SPEEDER_FRACTION
  r.validAll = Object.values(r.checks).every(Boolean)
}

// ── analysis ─────────────────────────────────────────────────────────────────
const N = recs.length
const vals = (arr, k) => arr.map((r) => r[k]).filter((v) => v != null)
const ofCell = (c) => recs.filter((r) => r.cond === c)
const bridge = recs.filter((r) => r.inter === 'present'), noBridge = recs.filter((r) => r.inter === 'absent')
const hetHigh = recs.filter((r) => r.het === 'high'), hetLow = recs.filter((r) => r.het === 'low')
const MEASURES = ['CL', 'PU', 'CI', 'MCi', 'MCh', 's2Sec', 'totalSec']

const cellDesc = Object.fromEntries(CELLS.map((c) => [c, Object.fromEntries(MEASURES.map((k) => [k, { m: mean(vals(ofCell(c), k)), sd: sd(vals(ofCell(c), k)) }]))]))
const contrast = (a, b, k) => ({ k, a: { n: vals(a, k).length, m: mean(vals(a, k)), sd: sd(vals(a, k)) }, b: { n: vals(b, k).length, m: mean(vals(b, k)), sd: sd(vals(b, k)) }, test: welch(vals(a, k), vals(b, k)) })
const interContrasts = MEASURES.map((k) => contrast(bridge, noBridge, k))
const hetContrasts = MEASURES.map((k) => contrast(hetHigh, hetLow, k))
const anovas = Object.fromEntries(['CL', 'PU', 'CI', 's2Sec'].map((k) => [k, anova2x2(recs, 'inter', 'het', k)]))

const alphas = Object.fromEntries(Object.entries(ITEMS).map(([k, codes]) => [k, cronbachAlpha(recs.map((r) => codes.map((c) => scored(c, r.survey[c]))))]))
const itemStats = Object.entries(ITEMS).flatMap(([k, codes]) => codes.map((c) => {
  const raw = recs.map((r) => r.survey[c])
  const restTotals = recs.map((r) => codes.filter((o) => o !== c).reduce((s, o) => s + scored(o, r.survey[o]), 0))
  return { code: c, construct: k, reverse: REVERSE.has(c), m: mean(raw), sd: sd(raw), itemRest: pearson(raw.map((v) => scored(c, v)), restTotals)?.r ?? null, low: mean(vals(hetLow.map((r) => ({ v: r.survey[c] })), 'v')), high: mean(vals(hetHigh.map((r) => ({ v: r.survey[c] })), 'v')) }
}))

const CORR_KEYS = ['CL', 'PU', 'CI', 'MCi', 'MCh']
const corr = Object.fromEntries(CORR_KEYS.map((a) => [a, Object.fromEntries(CORR_KEYS.map((b) => [b, a === b ? null : pearson(vals(recs, a), vals(recs, b))]))]))
const centered = (k) => recs.map((r) => r[k] - cellDesc[r.cond][k].m)
const withinCL_PU = pearson(centered('CL'), centered('PU'), 3)
const withinPU_CI = pearson(centered('PU'), centered('CI'), 3)

// `effect` is a signed d (negligible < .2) or r (negligible < .1).
function verdict(expectedSign, effect, p, negligible) {
  if (effect == null || p == null) return { label: 'n/a', cls: '' }
  if (p >= 0.05 && Math.abs(effect) < negligible) return { label: 'No meaningful difference', cls: '' }
  if (Math.sign(effect) !== expectedSign) return { label: 'Not supported — opposite direction', cls: 'bad' }
  return p < 0.05 ? { label: 'Supported (p < .05)', cls: 'good' } : { label: 'Expected direction, not significant', cls: 'warn' }
}
const D_SMALL = 0.2, R_SMALL = 0.1
const dOf = (list, k) => list.find((c) => c.k === k).test?.d ?? null
const hypotheses = [
  { id: 'H1', text: 'Higher heterogeneity (Cinema) increases cognitive load', stat: `F(1,${anovas.CL.dfW}) = ${fx(anovas.CL.B.F)}, p ${pe(anovas.CL.B.p)}, η²p = ${fx(anovas.CL.B.petaSq)}`, means: `Cinema ${fx(mean(vals(hetHigh, 'CL')))} vs Courier ${fx(mean(vals(hetLow, 'CL')))} (d = ${fx(dOf(hetContrasts, 'CL'))})`, v: verdict(1, dOf(hetContrasts, 'CL'), anovas.CL.B.p, D_SMALL) },
  { id: 'H2', text: 'Interrelatedness (bridge) reduces cognitive load', stat: `F(1,${anovas.CL.dfW}) = ${fx(anovas.CL.A.F)}, p ${pe(anovas.CL.A.p)}, η²p = ${fx(anovas.CL.A.petaSq)}`, means: `Bridge ${fx(mean(vals(bridge, 'CL')))} vs none ${fx(mean(vals(noBridge, 'CL')))} (d = ${fx(dOf(interContrasts, 'CL'))})`, v: verdict(-1, dOf(interContrasts, 'CL'), anovas.CL.A.p, D_SMALL) },
  { id: 'H3', text: 'Cognitive load is negatively related to perceived usability', stat: `r = ${fx(corr.CL.PU?.r)}, p ${pe(corr.CL.PU?.p)} (within-cell r = ${fx(withinCL_PU?.r)}, p ${pe(withinCL_PU?.p)})`, means: `n = ${N}`, v: verdict(-1, corr.CL.PU?.r, corr.CL.PU?.p, R_SMALL) },
  { id: 'H4', text: 'Perceived usability is positively related to continuance intention', stat: `r = ${fx(corr.PU.CI?.r)}, p ${pe(corr.PU.CI?.p)} (within-cell r = ${fx(withinPU_CI?.r)}, p ${pe(withinPU_CI?.p)})`, means: `n = ${N}`, v: verdict(1, corr.PU.CI?.r, corr.PU.CI?.p, R_SMALL) },
]
const mcInter = interContrasts.find((c) => c.k === 'MCi'), mcHet = hetContrasts.find((c) => c.k === 'MCh')
const manipulation = [
  { name: 'Interrelatedness (MC1, MC2, MC5ʳ)', a: 'Bridge', b: 'No bridge', c: mcInter, v: verdict(1, mcInter.test?.d, mcInter.test?.p, D_SMALL) },
  { name: 'Heterogeneity (MC3, MC4, MC6ʳ)', a: 'Cinema', b: 'Courier', c: mcHet, v: verdict(1, mcHet.test?.d, mcHet.test?.p, D_SMALL) },
]

// ── formatting helpers ───────────────────────────────────────────────────────
function fx(x, d = 2) { return x == null || Number.isNaN(x) ? '—' : Number(x).toFixed(d) }
function fp(p) { return p == null ? '—' : p < 0.001 ? '<.001' : p.toFixed(3).replace(/^0/, '') }
function pe(p) { return p == null ? '= —' : p < 0.001 ? '< .001' : `= ${fp(p)}` }
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const short = (pid) => esc(pid.slice(0, 8)) + '…'
const ms = (o) => `${fx(o.m)} <span class="sd">(${fx(o.sd)})</span>`
const countBy = (arr) => arr.reduce((o, v) => ({ ...o, [v]: (o[v] || 0) + 1 }), {})
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '—')

const subStatus = countBy(submissions.map((s) => s.status))
const appStatus = countBy(realAssignments.map((a) => a.status))
const nonCompleted = realAssignments.filter((a) => a.status !== 'completed')
const testRows = assignments.length - realAssignments.length
const CHECK_LABELS = {
  prolificMatch: 'Matched to a Prolific submission with completion code VALID12',
  fullTrail: 'Full event trail (completion, Service-2, survey, questionnaire) and no failure events',
  eventIntegrity: 'Event integrity — single condition + participant ID, monotonic unique sequence IDs',
  surveyComplete: 'All 20 post-task items answered with integers 1–7',
  questComplete: 'All 6 background questions answered',
  attention: 'Attention check AC1 answered correctly ("Somewhat agree")',
  unique: 'Unique participant — no other sessions, not a Pilot-1 participant',
  fidelity: 'Condition fidelity — no bridge-banner tap recorded in no-bridge cells',
  notStraightlining: `Not straight-lining (SD of the 19 construct items ≥ ${STRAIGHTLINE_SD})`,
  notSpeeder: `Not a speeder (session ≥ ⅓ of the median ${fx(medianTotal, 0)} s)`,
}
const prolificMins = recs.map((r) => r.prolificMin).filter((v) => v != null)
const rewardUsd = study.reward / 100
const hourly = median(prolificMins) ? (rewardUsd / median(prolificMins)) * 60 : null
const softFlags = recs.filter((r) => r.soft.length)
const ageFilter = (study.filters || []).find((f) => f.filter_id === 'age')?.selected_range

function distTable(title, code, order, labels = {}) {
  const counts = countBy(recs.map((r) => r.quest[code]))
  const rows = order.filter((v) => counts[v]).map((v) => `<tr><td class="lab">${esc(labels[v] ?? v)}</td><td>${counts[v]}</td><td>${pct(counts[v], N)}</td></tr>`).join('')
  return `<div class="mini"><h4>${title}</h4><table><thead><tr><th>Response</th><th>n</th><th>%</th></tr></thead><tbody>${rows}</tbody></table></div>`
}
function contrastRows(list, la, lb) {
  return list.map((c) => `<tr><td class="lab">${CONSTRUCT_NAMES[c.k] ?? (c.k === 's2Sec' ? 'Service-2 task time (s)' : 'Session duration (s)')}</td>
    <td>${fx(c.a.m)} ± ${fx(c.a.sd)}</td><td>${fx(c.b.m)} ± ${fx(c.b.sd)}</td><td>${fx(c.test?.t)}</td><td>${fx(c.test?.df, 1)}</td><td>${fp(c.test?.p)}</td><td>${fx(c.test?.d)}</td></tr>`).join('')
    .replace(/^/, `<table><thead><tr><th>Measure</th><th>${la} M ± SD</th><th>${lb} M ± SD</th><th>t</th><th>df</th><th>p</th><th>d</th></tr></thead><tbody>`) + '</tbody></table>'
}
function anovaTable(k, label) {
  const a = anovas[k]
  const row = (name, e) => `<tr><td class="lab">${name}</td><td>${fx(e.ss)}</td><td>1</td><td>${fx(e.F)}</td><td>${fp(e.p)}</td><td>${fx(e.petaSq)}</td></tr>`
  return `<h4>${label}</h4><table><thead><tr><th>Source</th><th>SS</th><th>df</th><th>F</th><th>p</th><th style="text-transform:none">η²p</th></tr></thead><tbody>
    ${row('Interrelatedness (bridge)', a.A)}${row('Heterogeneity (service)', a.B)}${row('Interaction', a.AB)}
    <tr><td class="lab">Residual</td><td>${fx(a.msW * a.dfW)}</td><td>${a.dfW}</td><td colspan="3"></td></tr></tbody></table>`
}

// ── HTML ─────────────────────────────────────────────────────────────────────
const generated = new Date()
const verdictCell = (v) => `<span class="pill ${v.cls}">${v.label}</span>`
const cellHeader = CELLS.map((c) => `<th><span class="sw" style="background:${CELL_COLORS[c]}"></span>${c}<br><small>${DESIGN[c].svc2} · ${DESIGN[c].inter === 'present' ? 'bridge' : 'no bridge'} · n=${ofCell(c).length}</small></th>`).join('')
const descRows = MEASURES.map((k) => `<tr><td class="lab">${CONSTRUCT_NAMES[k] ?? (k === 's2Sec' ? 'Service-2 task time (s)' : 'Session duration (s)')}</td>${CELLS.map((c) => `<td>${ms(cellDesc[c][k])}</td>`).join('')}<td>${fx(mean(vals(recs, k)))} <span class="sd">(${fx(sd(vals(recs, k)))})</span></td></tr>`).join('')
const qcRows = Object.entries(CHECK_LABELS).map(([k, label]) => {
  const pass = recs.filter((r) => r.checks[k]).length
  return `<tr><td class="lab">${label}</td><td>${pass}/${N}</td><td>${pass === N ? '<span class="pill good">Pass</span>' : '<span class="pill bad">Review</span>'}</td></tr>`
}).join('')
const itemRows = itemStats.map((i) => `<tr${i.itemRest != null && i.itemRest < 0.2 ? ' class="hl"' : ''}><td><code>${i.code}</code>${i.reverse ? 'ʳ' : ''}</td><td class="lab">${esc(ITEM_TEXT[i.code])}</td><td>${CONSTRUCT_NAMES[i.construct]}</td><td>${fx(i.m)}</td><td>${fx(i.sd)}</td><td>${fx(i.low)}</td><td>${fx(i.high)}</td><td>${fx(i.itemRest)}</td></tr>`).join('')
const corrRows = CORR_KEYS.map((a) => `<tr><td class="lab">${CONSTRUCT_NAMES[a]}</td>${CORR_KEYS.map((b) => {
  const c = corr[a][b]
  if (!c) return '<td class="muted">—</td>'
  return `<td${c.p < 0.05 ? ' class="sig"' : ''}>${fx(c.r)}<br><small>p ${fp(c.p)}</small></td>`
}).join('')}</tr>`).join('')
const participantRows = [...recs].sort((x, y) => x.cond.localeCompare(y.cond)).map((r) => `<tr>
  <td><code>${short(r.pid)}</code></td><td><span class="sw" style="background:${CELL_COLORS[r.cond]}"></span>${r.cond}</td>
  <td>${fx(r.CL)}</td><td>${fx(r.PU)}</td><td>${fx(r.CI)}</td><td>${fx(r.MCi)}</td><td>${fx(r.MCh)}</td>
  <td>${r.banner ? '✓' : '—'}</td><td>${r.reminders}</td><td>${fx(r.s2Sec, 1)}</td><td>${fx(r.totalSec, 0)}</td><td>${fx(r.prolificMin, 1)}</td>
  <td>${fx(r.answerSd)}</td><td>${esc(r.quest.DEM1)}</td><td>${esc(r.quest.DEM2)}</td>
  <td>${r.validAll ? '<span class="pill good">OK</span>' : '<span class="pill bad">Review</span>'}${r.soft.length ? `<br><small>${esc(r.soft.join('; '))}</small>` : ''}</td></tr>`).join('')
const attritionRows = nonCompleted.map((a) => `<tr><td><code>${short(a.prolific_pid)}</code></td><td>${a.group_condition}</td><td>${esc(a.status)}</td><td>${esc(a.invalid_reason || '—')}</td><td>${esc(submissions.find((s) => s.participant_id === a.prolific_pid)?.status || '—')}</td></tr>`).join('')
const allValid = recs.every((r) => r.validAll)
const mcHetReversed = mcHet.a.m < mcHet.b.m
const cellSizes = CELLS.map((c) => ofCell(c).length)
const cellRange = Math.min(...cellSizes) === Math.max(...cellSizes) ? `${cellSizes[0]}` : `${Math.min(...cellSizes)}–${Math.max(...cellSizes)}`
const weakItems = itemStats.filter((i) => i.itemRest != null && i.itemRest < 0.2)
const POWER_EFFECTS = [
  ['Bridge → cognitive load (H2)', dOf(interContrasts, 'CL')],
  ['Cinema → cognitive load (H1)', dOf(hetContrasts, 'CL')],
  ['Bridge → Service-2 task time', dOf(interContrasts, 's2Sec')],
  ['Manipulation check · interrelatedness', mcInter.test?.d],
  ['Manipulation check · heterogeneity', mcHet.test?.d],
]
// A 2×2 main effect compares two levels of two cells each, so per-cell n = per-level n / 2.
const powerItems = POWER_EFFECTS.map(([label, d]) => {
  if (d == null) return `<li>${label}: —</li>`
  if (Math.abs(d) < D_SMALL) return `<li>${label}: d = ${fx(d)} — effectively zero; no realistic sample would detect it.</li>`
  const perLevel = nPerGroupFor80(d)
  return `<li>${label}: |d| = ${fx(Math.abs(d))} → ≈ ${Math.ceil(perLevel / 2)} per cell (${perLevel * 2} total).</li>`
}).join('')
const CEILING = 5.5
const ceilingKeys = ['PU', 'CI'].filter((k) => mean(vals(recs, k)) >= CEILING)
const ceilingNote = ceilingKeys.length
  ? `<li><b>Ceiling effects.</b> ${ceilingKeys.map((k) => `${CONSTRUCT_NAMES[k]} averages ${fx(mean(vals(recs, k)))}`).join(' and ')} on a 1–7 scale, which leaves little room for condition differences.</li>`
  : ''

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(batch.name)} — data analysis report</title>
<style>
:root{--ink:#1b2a4a;--mut:#64748b;--line:#e2e8f0;--accent:#1d4ed8;--good:#15803d;--warn:#b45309;--bad:#b91c1c}
*{box-sizing:border-box}body{margin:0;background:#f6f7f9;color:#0f172a;font:14.5px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:32px 22px 80px}
header{background:linear-gradient(135deg,#0f2b46,#1d4ed8);color:#fff;border-radius:16px;padding:28px 32px;margin-bottom:22px}
header h1{margin:0 0 6px;font-size:24px}header p{margin:2px 0;opacity:.92;font-size:13.5px}
nav{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 16px;margin-bottom:18px;font-size:13px}
nav a{color:var(--accent);text-decoration:none;margin-right:14px;white-space:nowrap}
section{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px 26px;margin-bottom:18px;box-shadow:0 1px 3px rgba(16,24,40,.06)}
h2{font-size:18px;margin:0 0 12px;color:var(--ink)}h3{font-size:15px;margin:18px 0 6px;color:var(--ink)}h4{font-size:13px;margin:12px 0 4px;color:var(--ink)}
p{margin:0 0 10px}ul{margin:4px 0 10px;padding-left:20px}li{margin:3px 0}
table{border-collapse:collapse;width:100%;margin:8px 0 12px;font-size:13px}
th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:center;vertical-align:top}
th{background:#f8fafc;color:var(--mut);font-size:11.5px;text-transform:uppercase;letter-spacing:.3px}
td.lab,th:first-child{text-align:left}td.muted{color:#cbd5e1}td.sig{background:#eef6ff;font-weight:600}tr.hl td{background:#fff7ed}
.sd,small{color:var(--mut);font-size:11.5px}code{background:#f1f5f9;padding:1px 5px;border-radius:4px;font:12px ui-monospace,Menlo,monospace}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:6px 0 16px}
.card{border:1px solid var(--line);border-radius:10px;padding:12px 14px}.card .num{font-size:24px;font-weight:700;color:var(--accent)}.card .lbl{font-size:12px;color:var(--mut)}
.pill{display:inline-block;padding:1px 9px;border-radius:999px;font-size:12px;font-weight:600;background:#f1f5f9;color:var(--mut)}
.pill.good{background:#dcfce7;color:var(--good)}.pill.warn{background:#fef3c7;color:var(--warn)}.pill.bad{background:#fee2e2;color:var(--bad)}
.callout{border-radius:10px;padding:11px 15px;margin:10px 0;font-size:13.5px;border:1px solid}
.callout.info{background:#eef4ff;border-color:#cfe0ff;color:#1b3a7a}.callout.warn{background:#fff8ec;border-color:#f4e2bf;color:#7c4a03}.callout.good{background:#eefaf1;border-color:#c7ecd3;color:#14532d}
.charts{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}.charts svg{width:100%;height:auto;background:#fff;border:1px solid var(--line);border-radius:10px}
.minis{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:middle}
.kv{display:grid;grid-template-columns:230px 1fr;gap:4px 14px;font-size:13.5px}.kv div:nth-child(odd){color:var(--mut);font-weight:600}
footer{text-align:center;color:var(--mut);font-size:12px;margin-top:26px}
@media print{body{background:#fff}section{box-shadow:none;break-inside:avoid}nav{display:none}}
</style></head><body><div class="wrap">
<header><h1>${esc(batch.name)} — Data Analysis Report</h1>
<p>Super-app cross-service study · 2 × 2 between-subjects (heterogeneity × interrelatedness) · study-v2 instrument</p>
<p>Prolific study <code style="color:#fff;background:rgba(255,255,255,.15)">${esc(STUDY_ID)}</code> · app batch <code style="color:#fff;background:rgba(255,255,255,.15)">${esc(BATCH_ID)}</code> · generated ${generated.toISOString().slice(0, 16).replace('T', ' ')} UTC</p></header>
<nav><a href="#s1">1 Summary</a><a href="#s2">2 Recruitment</a><a href="#s3">3 Data quality</a><a href="#s4">4 Sample</a><a href="#s5">5 Measurement</a><a href="#s6">6 Manipulation checks</a><a href="#s7">7 Descriptives</a><a href="#s8">8 Hypotheses</a><a href="#s9">9 Behaviour</a><a href="#s10">10 Participants</a><a href="#s11">11 Limitations</a></nav>

<section id="s1"><h2>1 · Executive summary</h2>
<div class="cards">
<div class="card"><div class="num">${N}</div><div class="lbl">valid completions (${CELLS.map((c) => `${c}=${ofCell(c).length}`).join(' · ')})</div></div>
<div class="card"><div class="num">${recs.filter((r) => r.validAll).length}/${N}</div><div class="lbl">pass every data-quality check</div></div>
<div class="card"><div class="num">${fx(median(prolificMins), 1)} min</div><div class="lbl">median Prolific completion time (est. ${study.estimated_completion_time} min)</div></div>
<div class="card"><div class="num">${bridge.filter((r) => r.banner).length}/${bridge.length}</div><div class="lbl">bridge-banner uptake (no-bridge: ${noBridge.filter((r) => r.banner).length}/${noBridge.length})</div></div>
</div>
<div class="callout ${allValid ? 'good' : 'warn'}"><b>Data quality:</b> ${allValid ? `all ${N} records pass every integrity, completeness, attention, uniqueness and speed check — the dataset is usable as-is.` : 'some records need review — see §3.'}</div>
<table><thead><tr><th>Hypothesis / check</th><th>Test</th><th>Means</th><th>Result</th></tr></thead><tbody>
${manipulation.map((m) => `<tr><td class="lab"><b>Manipulation check</b> — ${m.name}</td><td>t(${fx(m.c.test?.df, 1)}) = ${fx(m.c.test?.t)}, p ${pe(m.c.test?.p)}, d = ${fx(m.c.test?.d)}</td><td>${m.a} ${fx(m.c.a.m)} vs ${m.b} ${fx(m.c.b.m)}</td><td>${verdictCell(m.v)}</td></tr>`).join('')}
${hypotheses.map((h) => `<tr><td class="lab"><b>${h.id}</b> — ${h.text}</td><td>${h.stat}</td><td>${h.means}</td><td>${verdictCell(h.v)}</td></tr>`).join('')}
</tbody></table>
<div class="callout warn"><b>Read as a pilot.</b> With n = ${cellRange} per cell, the study can only detect very large effects. p-values are reported for completeness; effect directions and sizes are the informative part.${mcHetReversed ? ' <b>The heterogeneity manipulation check came out in the opposite direction</b>, so H1 cannot be interpreted until the manipulation (or its measure) is fixed — see §6.' : ''}</div>
</section>

<section id="s2"><h2>2 · Recruitment &amp; disposition</h2>
<div class="kv">
<div>Prolific study</div><div>${esc(study.name)} · status <b>${esc(study.status)}</b></div>
<div>Eligibility</div><div>Country of residence US or Canada · age ${ageFilter ? `${ageFilter.lower}–${ageFilter.upper}` : '18–50'} · Pilot-1 participants blocked (${blocklist.size} IDs)</div>
<div>Places / reward</div><div>${study.total_available_places} places · $${fx(rewardUsd)} · est. ${study.estimated_completion_time} min · max ${study.maximum_allowed_time} min</div>
<div>Effective pay</div><div>${hourly ? `≈ $${fx(hourly)}/h at the median completion time` : '—'}</div>
<div>Allocation</div><div>Server-side balanced assignment, ${batch.group_size} per cell; invalid and released places refill the same cell</div>
</div>
<h3>Prolific submissions (${submissions.length})</h3>
<table><thead><tr>${Object.keys(subStatus).map((s) => `<th>${esc(s)}</th>`).join('')}</tr></thead><tbody><tr>${Object.values(subStatus).map((n) => `<td>${n}</td>`).join('')}</tr></tbody></table>
<h3>App assignments — Prolific participants (${realAssignments.length})</h3>
<table><thead><tr>${Object.keys(appStatus).map((s) => `<th>${esc(s)}</th>`).join('')}</tr></thead><tbody><tr>${Object.values(appStatus).map((n) => `<td>${n}</td>`).join('')}</tr></tbody></table>
<p class="sd">${testRows} researcher/automated pre-flight sessions in this batch (IDs starting <code>BOT_</code> / <code>anon_</code>) were released and are excluded from every analysis.</p>
${attritionRows ? `<h3>Non-completed Prolific participants</h3><table><thead><tr><th>Participant</th><th>Cell</th><th>App status</th><th>Reason</th><th>Prolific status</th></tr></thead><tbody>${attritionRows}</tbody></table>
<p>Attrition: ${nonCompleted.length} of ${realAssignments.length} Prolific starters (${pct(nonCompleted.length, realAssignments.length)}). Each lost place was refilled in the same cell, so the final design stays balanced.</p>` : ''}
</section>

<section id="s3"><h2>3 · Data-quality audit</h2>
<table><thead><tr><th>Check</th><th>Passed</th><th>Status</th></tr></thead><tbody>${qcRows}</tbody></table>
<h3>Soft flags (kept in the data)</h3>
${softFlags.length ? `<ul>${softFlags.map((r) => `<li><code>${short(r.pid)}</code> (${r.cond}) — ${esc(r.soft.join('; '))}</li>`).join('')}</ul>
<p>These are contradictory answers to an item and its reverse-worded partner.${softFlags.every((r) => r.soft.every((s) => s.includes('MC3'))) ? ' They occur only on the heterogeneity items, and' : ''} ${softFlags.every((r) => r.validAll) ? 'every flagged participant passed all hard checks, including the attention check and the answer-variance check, so this looks like an <b>item-wording problem rather than careless responding</b> (see §5–6). No exclusions are recommended.' : 'Some flagged participants also fail a hard check — review them individually.'}</p>` : '<p>None.</p>'}
<p class="sd">Idle "Task reminder" pop-ups (<code>guidance.banner_shown</code>) appear in every condition and are not the experimental bridge banner; bridge uptake is measured only by <code>trip_complete.banner_tapped</code>.</p>
</section>

<section id="s4"><h2>4 · Sample characteristics</h2>
<p>Self-reported in the background questionnaire (N = ${N}).</p>
<div class="minis">
${distTable('Age', 'DEM1', ['18-24', '25-34', '35-44', '45-54', '55+'])}
${distTable('Gender', 'DEM2', ['female', 'male', 'non-binary', 'prefer-not-to-say'], { female: 'Female', male: 'Male', 'non-binary': 'Non-binary', 'prefer-not-to-say': 'Prefer not to say' })}
${distTable('Multi-service app use', 'FAM1', ['never', 'rarely', 'monthly', 'weekly', 'daily'], { never: 'Never', rarely: 'A few times a year', monthly: 'A few times a month', weekly: 'A few times a week', daily: 'Daily' })}
${distTable('Familiarity with switching services', 'FAM2', ['1', '2', '3', '4', '5'], { 1: 'Not at all', 2: 'Slightly', 3: 'Moderately', 4: 'Very', 5: 'Extremely' })}
${distTable('Services used per session', 'SWI1', ['1', '2', '3', '4+', 'single-app'], { 1: 'Just one', 2: '2', 3: '3', '4+': '4 or more', 'single-app': 'Single-service apps only' })}
${distTable('Switching mid-session', 'SWI2', ['never', 'rarely', 'sometimes', 'often', 'always'])}
</div>
<p>Gender by cell: ${CELLS.map((c) => `${c} ${ofCell(c).filter((r) => r.quest.DEM2 === 'female').length}F/${ofCell(c).filter((r) => r.quest.DEM2 === 'male').length}M`).join(' · ')}. With 3 people per cell, demographic imbalance between cells is unavoidable and cannot be statistically controlled.</p>
</section>

<section id="s5"><h2>5 · Measurement quality</h2>
<p>All items use a 1–7 scale; reverse-worded items (ʳ) are scored 8 − x before averaging. Cronbach's α with N = ${N} is unstable and indicative only.</p>
<table><thead><tr><th>Construct</th><th>Items</th><th>α</th><th>Reading</th></tr></thead><tbody>
${Object.entries(ITEMS).map(([k, codes]) => { const a = alphas[k]; const read = a == null ? '—' : a >= 0.8 ? '<span class="pill good">good</span>' : a >= 0.7 ? '<span class="pill good">acceptable</span>' : a >= 0.5 ? '<span class="pill warn">weak</span>' : '<span class="pill bad">poor</span>'; return `<tr><td class="lab">${CONSTRUCT_NAMES[k]}</td><td>${codes.map((c) => c + (REVERSE.has(c) ? 'ʳ' : '')).join(', ')}</td><td>${fx(a)}</td><td>${read}</td></tr>` }).join('')}
</tbody></table>
<h3>Item-level statistics</h3>
<p class="sd">Means are raw responses (before reverse scoring). Item–rest r = correlation of the (reverse-scored) item with the sum of the other items in its construct; rows below .20 are highlighted.</p>
<table><thead><tr><th>Item</th><th>Wording (abridged)</th><th>Construct</th><th>M</th><th>SD</th><th>Courier M</th><th>Cinema M</th><th>Item–rest r</th></tr></thead><tbody>${itemRows}</tbody></table>
${weakItems.length ? `<div class="callout warn"><b>Weak items.</b> ${weakItems.map((i) => `<code>${i.code}</code> (${esc(ITEM_TEXT[i.code])}, r = ${fx(i.itemRest)})`).join('; ')} ${weakItems.length === 1 ? 'does' : 'do'} not move with the rest of ${weakItems.length === 1 ? 'its' : 'their'} construct${weakItems.length === 1 ? '' : 's'}. A negative value means respondents answered it in the opposite way to its partner items, which usually signals ambiguous wording or a reverse-coding misunderstanding. Consider rewording, or report the construct with and without the item.</div>` : ''}
</section>

<section id="s6"><h2>6 · Manipulation checks</h2>
${contrastRows([mcInter], 'Bridge', 'No bridge')}
${contrastRows([mcHet], 'Cinema', 'Courier')}
<ul>
<li><b>Interrelatedness</b> — ${mcInter.a.m > mcInter.b.m ? 'bridge participants rated the experience as more connected, in the expected direction' : 'no expected separation'} (d = ${fx(mcInter.test?.d)}). Bridge uptake: ${bridge.filter((r) => r.banner).length}/${bridge.length} tapped the banner; ${noBridge.filter((r) => r.banner).length}/${noBridge.length} in no-bridge cells (the banner is not shown there).</li>
<li><b>Heterogeneity</b> — ${mcHetReversed ? `<b>reversed</b>: Cinema participants rated the second service as <i>less</i> different from the ride than Courier participants (${fx(mcHet.a.m)} vs ${fx(mcHet.b.m)}). See the item-level Courier/Cinema columns in §5 to see which items drive this, and the soft flags in §3 for respondents who agreed with both MC3 and MC6.` : `in the expected direction (${fx(mcHet.a.m)} vs ${fx(mcHet.b.m)}).`}</li>
</ul>
${mcHetReversed ? `<div class="callout warn"><b>Implication.</b> Courier (send a package) may be seen as "a different kind of task" from booking a ride as much as, or more than, Cinema. The MC items also ask about "type of task" versus "steps", which participants may read differently. Before scaling up: (a) reword MC3/MC6 to name the dimension explicitly (for example, the domain of the service rather than the steps), and (b) check whether the Courier flow should be made closer to ride-hailing (same addresses, map, vehicle) so the low-heterogeneity cell is clearly low.</div>` : ''}
</section>

<section id="s7"><h2>7 · Descriptives by cell</h2>
<table><thead><tr><th>Measure</th>${cellHeader}<th>All<br><small>n=${N}</small></th></tr></thead><tbody>${descRows}</tbody></table>
<p class="sd">Values are M (SD). Cognitive load: lower = better. Usability and continuance: higher = better.</p>
<div class="charts">
${dotPlot(recs, 'CL', 'Cognitive load (1–7)', [1, 7])}${dotPlot(recs, 'PU', 'Perceived usability (1–7)', [1, 7])}${dotPlot(recs, 'CI', 'Continuance intention (1–7)', [1, 7])}
${dotPlot(recs, 'MCi', 'MC · interrelatedness (1–7)', [1, 7])}${dotPlot(recs, 'MCh', 'MC · heterogeneity (1–7)', [1, 7])}${dotPlot(recs, 's2Sec', 'Service-2 task time (s)')}
</div>
<p class="sd">Dots = participants; black bar = cell mean; whisker = ± 1 SD.</p>
</section>

<section id="s8"><h2>8 · Hypothesis tests</h2>
<h3>H1 &amp; H2 — 2 × 2 ANOVA on the outcomes</h3>
<p>Between-subjects factors: interrelatedness (bridge / no bridge) × heterogeneity (Courier / Cinema). ${anovas.CL.balanced ? 'Cells are balanced, so Type I and Type III sums of squares are identical.' : 'Cells are unbalanced; sums of squares are sequential.'}</p>
<div class="charts">${interactionPlot(recs, 'CL', 'Cognitive load', [1, 7])}${interactionPlot(recs, 'PU', 'Perceived usability', [1, 7])}${interactionPlot(recs, 'CI', 'Continuance intention', [1, 7])}</div>
${anovaTable('CL', 'Cognitive load')}${anovaTable('PU', 'Perceived usability')}${anovaTable('CI', 'Continuance intention')}
<h3>Factor contrasts (Welch t-tests)</h3>
<h4>Interrelatedness: bridge (G2+G4) vs no bridge (G1+G3)</h4>${contrastRows(interContrasts.filter((c) => ['CL', 'PU', 'CI'].includes(c.k)), 'Bridge', 'No bridge')}
<h4>Heterogeneity: Cinema (G3+G4) vs Courier (G1+G2)</h4>${contrastRows(hetContrasts.filter((c) => ['CL', 'PU', 'CI'].includes(c.k)), 'Cinema', 'Courier')}
<h3>H3 &amp; H4 — correlations between constructs</h3>
<table><thead><tr><th></th>${CORR_KEYS.map((k) => `<th>${k}</th>`).join('')}</tr></thead><tbody>${corrRows}</tbody></table>
<p>Pearson r (N = ${N}); shaded cells p &lt; .05. Within-cell correlations remove the four cell means first, so they reflect individual differences rather than the manipulation: CL–PU r = ${fx(withinCL_PU?.r)} (p ${fp(withinCL_PU?.p)}), PU–CI r = ${fx(withinPU_CI?.r)} (p ${fp(withinPU_CI?.p)}), df = ${withinCL_PU?.df}.</p>
<p class="sd">A serial mediation test (heterogeneity/interrelatedness → CL → PU → CI) is not reported: with N = ${N} the indirect-effect estimates would be unreliable.</p>
</section>

<section id="s9"><h2>9 · Behavioural measures</h2>
${contrastRows(interContrasts.filter((c) => ['s2Sec', 'totalSec'].includes(c.k)), 'Bridge', 'No bridge')}
${contrastRows(hetContrasts.filter((c) => ['s2Sec', 'totalSec'].includes(c.k)), 'Cinema', 'Courier')}
${anovaTable('s2Sec', 'Service-2 task time — 2 × 2 ANOVA')}
<ul>
<li>Service-2 time is measured from Service-2 entry to task completion. The bridge pre-fills details, so a shorter time in bridge cells is the expected direction.</li>
<li>Bridge uptake: ${ofCell('G2').filter((r) => r.banner).length}/${ofCell('G2').length} in G2 and ${ofCell('G4').filter((r) => r.banner).length}/${ofCell('G4').length} in G4. Participants who did not tap the banner reached Service 2 through the tab bar.</li>
<li>Idle task reminders shown: ${CELLS.map((c) => `${c} ${ofCell(c).reduce((s, r) => s + r.reminders, 0)}`).join(' · ')} (shown after inactivity, in every condition).</li>
<li>Prolific time: median ${fx(median(prolificMins), 1)} min (range ${fx(Math.min(...prolificMins), 1)}–${fx(Math.max(...prolificMins), 1)}). In-app session: median ${fx(medianTotal, 0)} s (range ${fx(Math.min(...recs.map((r) => r.totalSec)), 0)}–${fx(Math.max(...recs.map((r) => r.totalSec)), 0)}).</li>
</ul>
</section>

<section id="s10"><h2>10 · Participant-level data</h2>
<p class="sd">Prolific IDs truncated. Scores are construct means after reverse scoring.</p>
<div style="overflow-x:auto"><table><thead><tr><th>Participant</th><th>Cell</th><th>CL</th><th>PU</th><th>CI</th><th>MC-i</th><th>MC-h</th><th>Banner</th><th>Reminders</th><th>S2 (s)</th><th>Session (s)</th><th>Prolific (min)</th><th>Item SD</th><th>Age</th><th>Gender</th><th>Quality</th></tr></thead>
<tbody>${participantRows}</tbody></table></div>
</section>

<section id="s11"><h2>11 · Limitations &amp; recommendations</h2>
<ul>
<li><b>Power.</b> n = ${cellRange} per cell, so every p-value here is exploratory. Approximate sample needed for 80% power (two-tailed α = .05) if the observed effect sizes were the true ones:<ul>${powerItems}</ul></li>
<li><b>Heterogeneity manipulation.</b> ${mcHetReversed ? 'The manipulation check is reversed, so the heterogeneity factor is not validated in this sample. Fix the MC wording and/or the Courier vs Cinema contrast and re-pilot before the main study.' : 'Manipulation check in the expected direction.'}</li>
${ceilingNote}
<li><b>Single attention check.</b> One instructed-response item (AC1). It removed ${appStatus.invalid || 0} of ${N + (appStatus.invalid || 0)} participants who reached the survey; no other careless-responding indicators fired among the ${N} retained.</li>
<li><b>Sample.</b> US/Canada Prolific panel, eligibility age ${ageFilter ? `${ageFilter.lower}–${ageFilter.upper}` : '18–50'}; self-reported age bands: ${[...new Set(recs.map((r) => r.quest.DEM1))].sort().map(esc).join(', ')}. Results may not generalise to older users or other markets.</li>
<li><b>Next steps.</b> Approve the ${submissions.filter((s) => s.status === 'AWAITING REVIEW').length} submissions awaiting review on Prolific, close the app batch, then decide whether to pool this batch with earlier pilots (only if the instrument and app version are identical).</li>
</ul>
</section>

<footer>Read-only against Supabase (<code>participant_assignments</code>, <code>experiment_events</code>) and the Prolific API. Regenerate with <code>node scripts/batch-report.mjs ${esc(BATCH_ID)} ${esc(STUDY_ID)} ${esc(OUT_BASE)}</code>. Contains pseudonymous IDs — keep access-controlled.</footer>
</div></body></html>`

mkdirSync(OUT, { recursive: true })
writeFileSync(path.join(OUT, `${OUT_BASE}.html`), html)
writeFileSync(path.join(OUT, `${OUT_BASE}.json`), JSON.stringify({
  generatedAt: generated.toISOString(), batchId: BATCH_ID, studyId: STUDY_ID, n: N,
  submissions: subStatus, assignments: appStatus, cellDesc, alphas, anovas,
  hypotheses: hypotheses.map((h) => ({ id: h.id, stat: h.stat, verdict: h.v.label })),
  manipulation: manipulation.map((m) => ({ name: m.name, a: m.c.a, b: m.c.b, test: m.c.test, verdict: m.v.label })),
  participants: recs.map((r) => ({ pid: r.pid, cond: r.cond, CL: rd(r.CL), PU: rd(r.PU), CI: rd(r.CI), MCi: rd(r.MCi), MCh: rd(r.MCh), banner: r.banner, s2Sec: rd(r.s2Sec), totalSec: rd(r.totalSec, 0), checks: r.checks, soft: r.soft })),
}, null, 2))

console.log(`N=${N} (${CELLS.map((c) => `${c}=${ofCell(c).length}`).join(' ')})  all-checks-pass=${recs.filter((r) => r.validAll).length}/${N}`)
for (const m of manipulation) console.log(`MC ${m.name}: ${fx(m.c.a.m)} vs ${fx(m.c.b.m)} p=${fp(m.c.test?.p)} d=${fx(m.c.test?.d)} → ${m.v.label}`)
for (const h of hypotheses) console.log(`${h.id}: ${h.stat} → ${h.v.label}`)
console.log(`alpha: ${Object.entries(alphas).map(([k, a]) => `${k}=${fx(a)}`).join(' ')}`)
console.log(`→ docs/paper/${OUT_BASE}.html (+ .json)`)
