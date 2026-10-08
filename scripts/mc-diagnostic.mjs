/**
 * Read-only manipulation-check diagnostic for one batch: item wording, reverse-coding
 * verification against the raw click log, and per-participant responses.
 * Writes docs/paper/<outBase>.{html,json} (git-ignored).
 * Usage: node scripts/mc-diagnostic.mjs [batchId] [outBase]
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { mean, sd, welch, pearson, cronbachAlpha, anova2x2 } from './lib/stats.mjs'
import { OUT, DEFAULT_BATCH_ID, db, query, PROLIFIC_PID, DESIGN, ITEMS, REVERSE, SURVEY_CODES, ITEM_WORDING, scored, construct } from './lib/batch-common.mjs'

const BATCH_ID = process.argv[2] || DEFAULT_BATCH_ID
const OUT_BASE = process.argv[3] || 'mc-diagnostic-batch2'

// Supervisor's questionnaire (Appendix D, 2026-10-06); differs from the app for MC1–MC4.
const APPENDIX_D_WORDING = {
  MC1: 'The system prompted me with the next service at the right moment.',
  MC2: 'The system automatically carried my data into the next service.',
  MC5: 'I had to enter my address again from scratch for the second service.',
  MC3: 'The second service felt different from the ride service.',
  MC4: 'The two service tasks required different kinds of actions.',
  MC6: 'The two services felt like basically the same kind of activity.',
}
const MC_ORDER = ['MC1', 'MC2', 'MC5', 'MC3', 'MC4', 'MC6']
const Q_NUMBER = { MC1: 15, MC2: 16, MC5: 17, MC3: 18, MC4: 19, MC6: 20 }
const FACTOR = { MCi: ['inter', 'present', 'absent', 'Bridge (G2, G4)', 'No bridge (G1, G3)'], MCh: ['het', 'high', 'low', 'Cinema (G3, G4)', 'Courier (G1, G2)'] }
const factorOf = (code) => (ITEMS.MCi.includes(code) ? 'MCi' : 'MCh')

const INTENT = {
  MC1: 'The bridge banner offered the next service right after the ride.',
  MC2: 'The ride destination was carried into the second service.',
  MC5: 'No-bridge participants had to type the address again.',
  MC3: 'Cinema is a different domain from rides; Courier is not.',
  MC4: 'Cinema needs different actions from a ride; Courier does not.',
  MC6: 'Courier feels like the same kind of activity as a ride; Cinema does not.',
}
const MEASURED = {
  MC1: 'Any prompt toward the next task. Every condition shows a "Task 2 of 2" indicator and an idle "Task reminder: Use Courier/Cinema…" pop-up, so no-bridge participants were prompted too.',
  MC2: 'Whether the address was effortless. No-bridge flows offer a one-tap saved place for the same address, which many read as "already filled in".',
  MC5: 'Accurate recall: almost no one actually typed an address from scratch (see behaviour column). The item works; the low-interrelatedness flow did not force re-entry.',
  MC3: 'Whether the second service is a different service from a ride at all. Courier and Cinema both are, so answers sit at the ceiling in both groups.',
  MC4: 'Similarity of the UI steps. Both flows reuse the same template as the ride (pick a place → pick from a list → confirm), so this tracks the interface, not the service domain.',
  MC6: 'Whether the two tasks form one goal. The Cinema scenario is a single outing ("meet a friend to watch a movie"); Courier is two separate errands ("after your visit, send a package"), so Cinema reads as the same activity.',
}

// ── fetch ────────────────────────────────────────────────────────────────────
const batch = await query(db.from('test_batches').select('*').eq('id', BATCH_ID).single(), 'batch')
const assignments = (await query(db.from('participant_assignments').select('*').eq('batch_id', BATCH_ID), 'assignments'))
  .filter((a) => PROLIFIC_PID.test(a.prolific_pid) && a.status === 'completed')
  .sort((a, b) => a.group_condition.localeCompare(b.group_condition) || a.assigned_at.localeCompare(b.assigned_at))
if (!assignments.length) throw new Error('No completed Prolific participants in this batch')

function addressBehaviour(events, cond) {
  const s2 = events.filter((e) => e.event_name.startsWith('service2.'))
  const typed = new Set(s2.filter((e) => e.event_name === 'service2.address_edited').map((e) => e.payload?.field))
  const saved = new Set(s2.filter((e) => e.event_name === 'service2.address_validated' && e.payload?.source === 'saved').map((e) => e.payload.field))
  if (DESIGN[cond].svc2 === 'Courier' && s2.some((e) => e.event_name === 'service2.recipient_selected')) saved.add('recipient')
  const parts = []
  if (DESIGN[cond].inter === 'present') parts.push(DESIGN[cond].svc2 === 'Courier' ? 'sender pre-filled' : 'location pre-filled')
  for (const f of saved) parts.push(`${f}: saved place (1 tap)`)
  for (const f of typed) parts.push(`${f}: typed`)
  return { text: parts.join('; ') || '—', typedAny: typed.size > 0 }
}

const recs = []
for (const [i, a] of assignments.entries()) {
  const events = await query(
    db.from('experiment_events').select('event_name,sequence_id,payload').eq('session_id', a.exp_session_id).order('sequence_id'),
    'events',
  )
  const completedEvent = events.find((e) => e.event_name === 'survey.completed')
  const survey = completedEvent?.payload?.responses || {}
  const clicks = events.filter((e) => e.event_name === 'survey.item_answered')
  const lastClick = Object.fromEntries(clicks.map((e) => [e.payload.code, e.payload.value]))
  const revisions = Object.entries(Object.groupBy(clicks, (e) => e.payload.code))
    .filter(([code, list]) => MC_ORDER.includes(code) && list.length > 1)
    .map(([code, list]) => `${code}: ${list.map((e) => e.payload.value).join('→')}`)
  const appAgg = completedEvent?.payload?.aggregates || {}
  recs.push({
    id: `P${String(i + 1).padStart(2, '0')}`, pid6: a.prolific_pid.slice(0, 6), cond: a.group_condition, ...DESIGN[a.group_condition],
    survey,
    MCi: construct(survey, 'MCi'), MCh: construct(survey, 'MCh'), PU: construct(survey, 'PU'), CL: construct(survey, 'CL'),
    MCi2: mean([survey.MC1, survey.MC2]), MCh2: mean([survey.MC3, survey.MC4]),
    storedEqualsClicks: SURVEY_CODES.every((c) => survey[c] === lastClick[c]),
    appAggMatches: Math.abs(appAgg.mc_interrelatedness_mean - construct(survey, 'MCi')) < 0.01
      && Math.abs(appAgg.mc_heterogeneity_mean - construct(survey, 'MCh')) < 0.01,
    appAgg: { MCi: appAgg.mc_interrelatedness_mean, MCh: appAgg.mc_heterogeneity_mean },
    revisions,
    banner: events.some((e) => e.event_name === 'trip_complete.banner_tapped'),
    taskReminders: events.filter((e) => e.event_name === 'guidance.banner_shown').length,
    address: addressBehaviour(events, a.group_condition),
  })
}

// ── analysis ─────────────────────────────────────────────────────────────────
const split = (k) => { const [f, hi, lo] = FACTOR[k]; return [recs.filter((r) => r[f] === hi), recs.filter((r) => r[f] === lo)] }
const contrast = (k, valueOf) => {
  const [hi, lo] = split(k)
  return { high: hi.map(valueOf), low: lo.map(valueOf), test: welch(hi.map(valueOf), lo.map(valueOf)) }
}

const itemRows = MC_ORDER.map((code) => {
  const k = factorOf(code)
  const [hi, lo] = split(k)
  const raw = (list) => list.map((r) => ({ id: r.id, cond: r.cond, v: r.survey[code] }))
  const c = contrast(k, (r) => scored(code, r.survey[code]))
  return {
    code, q: Q_NUMBER[code], factor: k, wording: ITEM_WORDING[code], docWording: APPENDIX_D_WORDING[code], reverse: REVERSE.has(code),
    high: raw(hi), low: raw(lo), highM: mean(c.high), lowM: mean(c.low), d: c.test?.d ?? null, p: c.test?.p ?? null,
    corrPU: pearson(recs.map((r) => scored(code, r.survey[code])), recs.map((r) => r.PU))?.r ?? null,
    intent: INTENT[code], measured: MEASURED[code],
  }
})

const composites = [
  ['MCi', 'MCi2', 'Interrelatedness: MC1, MC2', ['MC1', 'MC2']],
  ['MCi', 'MCi', 'Interrelatedness: MC1, MC2, MC5ʳ', ITEMS.MCi],
  ['MCh', 'MCh2', 'Heterogeneity: MC3, MC4', ['MC3', 'MC4']],
  ['MCh', 'MCh', 'Heterogeneity: MC3, MC4, MC6ʳ', ITEMS.MCh],
].map(([k, key, label, codes]) => {
  const c = contrast(k, (r) => r[key])
  const [hi, lo] = split(k)
  const diff = mean(c.high) - mean(c.low)
  const loo = recs.map((drop) => {
    const h = hi.filter((r) => r !== drop).map((r) => r[key]), l = lo.filter((r) => r !== drop).map((r) => r[key])
    return { id: drop.id, diff: mean(h) - mean(l) }
  })
  const cells = Object.fromEntries(['G1', 'G2', 'G3', 'G4'].map((g) => [g, mean(recs.filter((r) => r.cond === g).map((r) => r[key]))]))
  return {
    label, k, key, highM: mean(c.high), lowM: mean(c.low), highSd: sd(c.high), lowSd: sd(c.low), diff, test: c.test,
    alpha: cronbachAlpha(recs.map((r) => codes.map((cd) => scored(cd, r.survey[cd])))),
    highAtLeast5: c.high.filter((v) => v >= 5).length, nHigh: c.high.length,
    lowAtLeast5: c.low.filter((v) => v >= 5).length, nLow: c.low.length,
    cells, looMin: Math.min(...loo.map((x) => x.diff)), looMax: Math.max(...loo.map((x) => x.diff)),
    mostInfluential: loo.reduce((best, x) => (Math.abs(x.diff - diff) > Math.abs(best.diff - diff) ? x : best)),
  }
})

const checks = {
  storedEqualsClicks: recs.filter((r) => r.storedEqualsClicks).length,
  appAggMatches: recs.filter((r) => r.appAggMatches).length,
  n: recs.length,
}
const sharedPattern = Object.entries(Object.groupBy(recs, (r) => MC_ORDER.map((c) => r.survey[c]).join(',')))
  .filter(([, list]) => list.length > 1).map(([pattern, list]) => ({ pattern, ids: list.map((r) => `${r.id} (${r.cond})`) }))
const noBridge = recs.filter((r) => r.inter === 'absent')

const clOf = (list) => list.map((r) => r.CL)
const cl = Object.fromEntries(['G1', 'G2', 'G3', 'G4'].map((g) => {
  const list = recs.filter((r) => r.cond === g)
  return [g, { m: mean(clOf(list)), sd: sd(clOf(list)), values: list.map((r) => ({ id: r.id, cond: r.cond, v: r.CL })) }]
}))
const clMargins = {
  noBridge: mean(clOf(recs.filter((r) => r.inter === 'absent'))), bridge: mean(clOf(recs.filter((r) => r.inter === 'present'))),
  courier: mean(clOf(recs.filter((r) => r.het === 'low'))), cinema: mean(clOf(recs.filter((r) => r.het === 'high'))),
  all: mean(clOf(recs)),
}
const clAnova = anova2x2(recs, 'inter', 'het', 'CL')
// Expected pattern from the paper's interaction figure (bridge buffers the heterogeneity cost).
const clExpectations = [
  ['Bridge lowers load for Courier', 'G1 > G2', cl.G1.m - cl.G2.m],
  ['Bridge lowers load for Cinema', 'G3 > G4', cl.G3.m - cl.G4.m],
  ['Heterogeneity raises load without a bridge', 'G3 > G1', cl.G3.m - cl.G1.m],
  ['Buffer effect: bridge helps more for Cinema', '(G3 − G4) > (G1 − G2)', (cl.G3.m - cl.G4.m) - (cl.G1.m - cl.G2.m)],
]

writeFileSync(path.join(OUT, `${OUT_BASE}.json`), JSON.stringify({ batch: { id: BATCH_ID, name: batch.name }, checks, itemRows, composites, cl, clMargins, clAnova, sharedPattern, recs }, null, 2))

// ── render ───────────────────────────────────────────────────────────────────
const fx = (x, d = 2) => (x == null || Number.isNaN(x) ? '—' : Number(x).toFixed(d))
const fp = (p) => (p == null ? '—' : p < 0.001 ? '<.001' : p.toFixed(3).replace(/^0/, ''))
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch])
const chip = (x) => `<span class="chip c${x.cond}" title="${x.id} · ${x.cond}">${x.v}</span>`
const dirCell = (d, expected = 1) => (d == null ? '—' : `<span class="${Math.sign(d) === expected ? 'good' : 'bad'}">${fx(d)}</span>`)
const mch = composites.find((c) => c.key === 'MCh')
const mci = composites.find((c) => c.key === 'MCi')

// Worked examples use real values so every formula can be checked by hand.
const ex = recs[0]
const exScored = ITEMS.MCh.map((c) => scored(c, ex.survey[c]))
const [cinema, courier] = split('MCh')
const pooledSd = Math.sqrt(((mch.nHigh - 1) * mch.highSd ** 2 + (mch.nLow - 1) * mch.lowSd ** 2) / (mch.nHigh + mch.nLow - 2))
const list = (rs, key) => rs.map((r) => fx(r[key])).join(', ')
const avgFormula = (vals) => `(${vals.map((v) => fx(v)).join(' + ')}) / ${vals.length}`
const clCell = (g, label) => {
  const rs = recs.filter((r) => r.cond === g)
  const rows = rs.map((r) => `<tr><td>${chip({ id: r.id, cond: r.cond, v: r.id })}</td><td>(${ITEMS.CL.map((c) => r.survey[c]).join(' + ')}) / 3</td><td>= <b>${fx(r.CL)}</b></td></tr>`).join('')
  return `<td><div><b>${g}</b> · ${label}</div><table class="mini">${rows}</table><div class="big">${fx(cl[g].m)}</div><small>cell mean = ${avgFormula(rs.map((r) => r.CL))}<br>SD = ${fx(cl[g].sd)}</small></td>`
}
const clMargin = (rs, value) => `<td><div class="big">${fx(value)}</div><small>${avgFormula(rs.map((r) => r.CL))}</small></td>`
const methodSection = `
<h2>How the numbers are calculated</h2>
<p>Every number in this report comes from the answers participants tapped in the post-task survey. Nothing is estimated or simulated. All values are rounded to 2 decimals.</p>

<h3>Step 1 — Raw answer</h3>
<p>Each question is answered on a 1–7 scale: <b>1 = Strongly disagree … 7 = Strongly agree</b> (cognitive-load questions: 1 = Very low … 7 = Very high). The number the participant tapped is the <b>raw answer</b>. The coloured chips in the item table show raw answers.</p>

<h3>Step 2 — Reverse coding (only MC5 and MC6)</h3>
<p>MC5 and MC6 are worded the opposite way: agreeing with them means <i>low</i> interrelatedness or <i>low</i> heterogeneity. To make "higher = more" true for every item, their answers are flipped with <b>scored = 8 − raw</b> (7→1, 6→2, 5→3, 4→4, 3→5, 2→6, 1→7). All other items are used as answered.</p>

<h3>Step 3 — One score per participant (composite)</h3>
<p>A participant's construct score is the <b>average of its items after Step 2</b>.</p>
<ul>
<li><b>MCi</b> (interrelatedness) = average of MC1, MC2, scored MC5. The "2-item" version leaves MC5 out.</li>
<li><b>MCh</b> (heterogeneity) = average of MC3, MC4, scored MC6. The "2-item" version leaves MC6 out.</li>
<li><b>CL</b> (cognitive load) = average of CL1, CL2, CL3. <b>PU</b> (usability) = average of PU1–PU6 (PU3, PU5, PU6 reverse-coded).</li>
</ul>
<div class="callout"><b>Example — ${ex.id} (${ex.cond}), MCh:</b> raw MC3 = ${ex.survey.MC3}, MC4 = ${ex.survey.MC4}, MC6 = ${ex.survey.MC6} → scored MC6 = 8 − ${ex.survey.MC6} = ${exScored[2]} → MCh = (${exScored.join(' + ')}) / 3 = <b>${fx(ex.MCh)}</b>.</div>

<h3>Step 4 — Group numbers</h3>
<table><tr><th>Term</th><th>What it means</th><th>How it is calculated</th><th>Example (MCh, Cinema vs Courier)</th><th>How to read it</th></tr>
<tr><td><b>High / Low</b></td><td>The two groups being compared</td><td>Interrelatedness: High = bridge (G2 + G4), Low = no bridge (G1 + G3). Heterogeneity: High = Cinema (G3 + G4), Low = Courier (G1 + G2). 6 people each.</td><td>Cinema: ${list(cinema, 'MCh')}<br>Courier: ${list(courier, 'MCh')}</td><td>If the manipulation worked, High should score higher than Low.</td></tr>
<tr><td><b>M</b> (mean)</td><td>Group average</td><td>Sum of the participants' scores ÷ number of participants</td><td>Cinema M = ${fx(mch.highM)}; Courier M = ${fx(mch.lowM)}</td><td>The typical score in the group.</td></tr>
<tr><td><b>SD</b></td><td>How spread out the scores are</td><td>Standard deviation of the participants' scores</td><td>Cinema SD = ${fx(mch.highSd)}; Courier SD = ${fx(mch.lowSd)}</td><td>Small SD = people agree with each other; large SD = answers vary a lot.</td></tr>
<tr><td><b>Diff</b></td><td>Gap between the groups</td><td>High M − Low M</td><td>${fx(mch.highM)} − ${fx(mch.lowM)} = ${fx(mch.diff)}</td><td>Positive (green) = expected direction. Negative (red) = opposite of what we wanted.</td></tr>
<tr><td><b>d</b> (Cohen's d)</td><td>Size of the gap in a standard unit</td><td>Diff ÷ pooled SD (the two groups' SDs combined)</td><td>${fx(mch.diff)} ÷ ${fx(pooledSd)} = ${fx(mch.test?.d)}</td><td>About 0.2 = small, 0.5 = medium, 0.8 or more = large. The sign shows the direction.</td></tr>
<tr><td><b>p</b> (Welch t-test)</td><td>Could the gap be chance?</td><td>Welch's t-test comparing the two groups (does not assume equal SDs)</td><td>p = ${fp(mch.test?.p)}</td><td>Below .05 = unlikely to be chance ("significant"). With only 6 per group, even large gaps usually stay above .05.</td></tr>
<tr><td><b>α</b> (Cronbach's alpha)</td><td>Do the items in a composite agree?</td><td>Computed over all ${recs.length} participants from the item scores after Step 2</td><td>MCh α = ${fx(mch.alpha)}</td><td>0.70 or more = items measure the same thing. Below 0.50 or negative = they don't.</td></tr>
<tr><td><b>Cell mean</b></td><td>Average within one condition</td><td>Same as M, but for the 3 people in one cell (G1, G2, G3 or G4)</td><td>G3 = ${fx(mch.cells.G3)}; G4 = ${fx(mch.cells.G4)}</td><td>Shows which cell drives a group gap.</td></tr>
<tr><td><b>High ≥ 5 / Low ≥ 5</b></td><td>How many people clearly agree</td><td>Count of participants whose score is 5 ("Somewhat agree") or higher</td><td>Cinema ${mch.highAtLeast5}/${mch.nHigh}; Courier ${mch.lowAtLeast5}/${mch.nLow}</td><td>Checks whether most of a group scores high, not just the average.</td></tr>
<tr><td><b>Diff if 1 person dropped</b></td><td>Does one person drive the result?</td><td>Remove one participant, recompute Diff; repeat for each of the ${recs.length}. Shows the smallest and largest Diff.</td><td>${fx(mch.looMin)} to ${fx(mch.looMax)}</td><td>If the sign never changes, no single person causes the result.</td></tr>
<tr><td><b>r with PU</b></td><td>Does the item follow how much people liked the app?</td><td>Pearson correlation between the scored item and the participant's usability score, over all ${recs.length} people</td><td>MC6: r = ${fx(itemRows.find((r) => r.code === 'MC6').corrPU)}</td><td>Ranges from −1 to 1. Near 0 = unrelated; far from 0 = the answer moves with liking the app.</td></tr>
<tr><td><b>F, p</b> (2 × 2 ANOVA)</td><td>Cognitive-load test with both factors at once</td><td>Two-way analysis of variance on CL with interrelatedness, heterogeneity and their interaction</td><td>Heterogeneity F = ${fx(clAnova.B.F)}, p = ${fp(clAnova.B.p)}</td><td>Larger F = bigger effect relative to noise; read p as above.</td></tr>
<tr><td><b>Observed difference</b> (CL pattern)</td><td>Does CL follow the paper's predicted pattern?</td><td>Difference between the two cell means named in the row, e.g. G1 − G2</td><td>G3 − G4 = ${fx(cl.G3.m - cl.G4.m)}</td><td>Positive = matches the prediction.</td></tr>
</table>`

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Manipulation-check diagnostic — ${esc(batch.name)}</title>
<style>
body{font:14px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f2328;max-width:1180px;margin:32px auto;padding:0 24px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:32px 0 8px;border-bottom:1px solid #d0d7de;padding-bottom:4px}h3{font-size:15px;margin:16px 0 4px}
.sub{color:#59636e;margin:0 0 16px}table{border-collapse:collapse;width:100%;margin:8px 0 16px;font-size:13px}
th,td{border:1px solid #d0d7de;padding:6px 8px;vertical-align:top;text-align:left}th{background:#f6f8fa}
.num{text-align:right;white-space:nowrap}.good{color:#1a7f37;font-weight:600}.bad{color:#cf222e;font-weight:600}
.chip{display:inline-block;min-width:18px;text-align:center;border-radius:4px;padding:0 4px;margin:1px;font-weight:600;color:#fff}
.cG1{background:#6e7781}.cG2{background:#0969da}.cG3{background:#bf8700}.cG4{background:#8250df}
.callout{border-left:4px solid #0969da;background:#ddf4ff;padding:10px 14px;margin:12px 0}.warn{border-color:#bf8700;background:#fff8c5}
.grid td,.grid th{text-align:center;vertical-align:middle}.grid .big{font-size:22px;font-weight:700}.grid .rowh{text-align:left}
.mini{width:auto;margin:6px auto;font-size:12px}.mini td{border:0;padding:1px 4px;text-align:left}
.legend span{margin-right:12px}code{background:#f6f8fa;padding:0 4px;border-radius:3px}small{color:#59636e}
</style></head><body>
<h1>Manipulation-check diagnostic</h1>
<p class="sub">${esc(batch.name)} · N = ${recs.length} completed (3 per cell) · read-only analysis of raw Supabase events · generated ${new Date().toISOString().slice(0, 10)}</p>

<div class="callout"><b>Question:</b> does the High vs Low difference on the manipulation checks come from the manipulation itself, or from item wording, reverse coding, or another systematic difference?<br>
<b>Short answer:</b> <b>reverse coding is correct</b> (verified against the raw click log for ${checks.storedEqualsClicks}/${checks.n} participants). The heterogeneity result is <b>reversed on every item</b> (MC3, MC4, MC6), so recoding cannot explain it. Its root cause is <b>what the items measure</b> (wording) and <b>how the conditions were built</b> (systematic differences), not real participant perception of service heterogeneity. Interrelatedness goes in the expected direction, but its gap is small because the no-bridge flow still makes the address one tap away.</div>
<div class="callout warn">Participants saw the <b>app wording</b>. For MC1–MC4 it differs from the Appendix D questionnaire; the Appendix D version is shown under each item for comparison.</div>
${methodSection}

<h2>1. Composite check: High vs Low</h2>
<table><tr><th>Composite</th><th>High M (SD)</th><th>Low M (SD)</th><th class="num">Diff</th><th class="num">d</th><th class="num">p (Welch)</th><th class="num">α</th><th>Cell means G1 · G2 · G3 · G4</th><th>High ≥ 5</th><th>Low ≥ 5</th><th>Diff if 1 person dropped</th></tr>
${composites.map((c) => `<tr><td>${c.label}</td><td class="num">${fx(c.highM)} (${fx(c.highSd)})</td><td class="num">${fx(c.lowM)} (${fx(c.lowSd)})</td><td class="num">${dirCell(c.diff)}</td><td class="num">${dirCell(c.test?.d)}</td><td class="num">${fp(c.test?.p)}</td><td class="num">${fx(c.alpha)}</td><td>${['G1', 'G2', 'G3', 'G4'].map((g) => fx(c.cells[g])).join(' · ')}</td><td>${c.highAtLeast5}/${c.nHigh}</td><td>${c.lowAtLeast5}/${c.nLow}</td><td>${fx(c.looMin)} to ${fx(c.looMax)}<br><small>largest shift: drop ${c.mostInfluential.id}</small></td></tr>`).join('')}
</table>
<p><small>High = ${FACTOR.MCi[3]} for interrelatedness; ${FACTOR.MCh[3]} for heterogeneity. Positive diff = expected direction. "Diff if 1 person dropped" re-computes High − Low leaving out each participant in turn; if the sign never flips, no single person drives the result.</small></p>

<h2>2. Cognitive load by cell (2 × 2)</h2>
<p>Each participant answered three cognitive-load questions on a 1–7 scale (1 = Very low, 7 = Very high; none are reverse-coded):</p>
<ul>${ITEMS.CL.map((c) => `<li><b>${c}</b>: ${esc(ITEM_WORDING[c])}</li>`).join('')}</ul>
<p><b>How to read the table:</b></p>
<ol>
<li><b>Participant score</b> (small rows in each cell) = (CL1 + CL2 + CL3) / 3. Example: ${ex.id} answered ${ITEMS.CL.map((c) => ex.survey[c]).join(', ')} → (${ITEMS.CL.map((c) => ex.survey[c]).join(' + ')}) / 3 = ${fx(ex.CL)}.</li>
<li><b>Big number in a cell</b> = average of the 3 participant scores in that condition.</li>
<li><b>Row mean</b> = average of the 6 participants in that row (both services). <b>Column mean</b> = average of the 6 participants in that column (with and without bridge). Bottom-right = average of all ${recs.length}.</li>
<li><b>Lower = less mental effort.</b> The paper predicts the bridge row is lower than the no-bridge row, and Cinema is higher than Courier.</li>
</ol>
<p><small>Values are rounded to 2 decimals, so a formula written with rounded numbers can be off by 0.01.</small></p>
<table class="grid"><tr><th></th><th>Low heterogeneity<br><small>Ride → Courier</small></th><th>High heterogeneity<br><small>Ride → Cinema</small></th><th>Row mean</th></tr>
<tr><th class="rowh">Low interrelatedness<br><small>no bridge</small></th>${clCell('G1', 'Courier, no bridge')}${clCell('G3', 'Cinema, no bridge')}${clMargin(recs.filter((r) => r.inter === 'absent'), clMargins.noBridge)}</tr>
<tr><th class="rowh">High interrelatedness<br><small>bridge</small></th>${clCell('G2', 'Courier + bridge')}${clCell('G4', 'Cinema + bridge')}${clMargin(recs.filter((r) => r.inter === 'present'), clMargins.bridge)}</tr>
<tr><th class="rowh">Column mean</th>${clMargin(recs.filter((r) => r.het === 'low'), clMargins.courier)}${clMargin(recs.filter((r) => r.het === 'high'), clMargins.cinema)}<td><div class="big">${fx(clMargins.all)}</div><small>average of all ${recs.length} participants</small></td></tr>
</table>
<table><tr><th>Expected (paper figure)</th><th>Comparison</th><th class="num">Observed difference</th><th>Matches?</th></tr>
${clExpectations.map(([label, cmp, diff]) => `<tr><td>${label}</td><td>${cmp}</td><td class="num">${fx(diff)}</td><td>${diff > 0 ? '<span class="good">Yes</span>' : '<span class="bad">No</span>'}</td></tr>`).join('')}
</table>
<p><small>Observed difference = the first cell mean minus the second, e.g. G1 − G2 = ${fx(cl.G1.m)} − ${fx(cl.G2.m)} = ${fx(cl.G1.m - cl.G2.m)}. Positive = matches the prediction.</small></p>
<p><small>2 × 2 ANOVA (n = 3 per cell): interrelatedness F(1,${clAnova.dfW}) = ${fx(clAnova.A.F)}, p = ${fp(clAnova.A.p)}; heterogeneity F(1,${clAnova.dfW}) = ${fx(clAnova.B.F)}, p = ${fp(clAnova.B.p)}; interaction F(1,${clAnova.dfW}) = ${fx(clAnova.AB.F)}, p = ${fp(clAnova.AB.p)}. Read the heterogeneity column with care: the heterogeneity manipulation check failed (sections 1 and 3).</small></p>

<h2>3. Item table (one row per question, every participant's raw answer)</h2>
<p class="legend">Chip colour = cell: <span class="chip cG1">G1</span> Courier, no bridge <span class="chip cG2">G2</span> Courier + bridge <span class="chip cG3">G3</span> Cinema, no bridge <span class="chip cG4">G4</span> Cinema + bridge. Numbers are <b>raw</b> answers (1 = Strongly disagree … 7 = Strongly agree), before any reverse coding.</p>
<table><tr><th>Item</th><th>Wording shown to participants</th><th>Reverse?</th><th>High: each raw answer</th><th>Low: each raw answer</th><th class="num">High M / Low M<br><small>(scored)</small></th><th class="num">d</th><th class="num">r with PU</th><th>Intended to measure</th><th>What it seems to have measured</th></tr>
${itemRows.map((r) => `<tr><td><b>${r.code}</b><br><small>Q${r.q} · ${r.factor}</small></td><td>${esc(r.wording)}${r.wording !== r.docWording ? `<br><small>Appendix D: ${esc(r.docWording)}</small>` : ''}</td><td>${r.reverse ? 'Yes: 8 − x' : 'No'}</td><td>${r.high.map(chip).join('')}</td><td>${r.low.map(chip).join('')}</td><td class="num">${fx(r.highM)} / ${fx(r.lowM)}</td><td class="num">${dirCell(r.d)}</td><td class="num">${fx(r.corrPU)}</td><td>${esc(r.intent)}</td><td>${esc(r.measured)}</td></tr>`).join('')}
</table>
<p><small>High/Low = ${FACTOR.MCi[3]} vs ${FACTOR.MCi[4]} for MC1, MC2, MC5; ${FACTOR.MCh[3]} vs ${FACTOR.MCh[4]} for MC3, MC4, MC6. "r with PU" = correlation of the scored item with perceived usability across all ${recs.length} people; a sizeable r on a heterogeneity item means people answered by how much they liked the app.</small></p>

<h2>4. Reverse-coding verification (from raw data)</h2>
<table><tr><th>Check</th><th>Result</th></tr>
<tr><td>Scale direction on screen</td><td>Same for every item: 1 = Strongly disagree (left) … 7 = Strongly agree (right). The tapped number is stored unchanged.</td></tr>
<tr><td>Which items are reverse-coded</td><td>MC5 (Q17) and MC6 (Q20), matching Appendix D. Agreeing with them means <i>low</i> interrelatedness / <i>low</i> heterogeneity, so they are scored 8 − x (7→1, 1→7). MC1–MC4 are used as answered.</td></tr>
<tr><td>Stored answer = last tap in the event log</td><td class="${checks.storedEqualsClicks === checks.n ? 'good' : 'bad'}">${checks.storedEqualsClicks}/${checks.n} participants, all survey items</td></tr>
<tr><td>App's own composite (computed in the browser) = independent recomputation</td><td class="${checks.appAggMatches === checks.n ? 'good' : 'bad'}">${checks.appAggMatches}/${checks.n} participants, both MC composites</td></tr>
<tr><td>Does the heterogeneity reversal depend on reverse coding?</td><td>No. MC3 and MC4 are not reverse-coded and are already reversed on their own (d = ${fx(itemRows.find((r) => r.code === 'MC3').d)}, ${fx(itemRows.find((r) => r.code === 'MC4').d)}). Dropping MC6 still leaves the composite reversed (d = ${fx(composites.find((c) => c.key === 'MCh2').test?.d)}).</td></tr>
</table>

<h2>5. Every participant</h2>
<table><tr><th>ID</th><th>Cell</th><th class="num">MC1</th><th class="num">MC2</th><th class="num">MC5 raw → scored</th><th class="num">MC3</th><th class="num">MC4</th><th class="num">MC6 raw → scored</th><th class="num">MCi</th><th class="num">MCh</th><th class="num">PU</th><th>Bridge tapped</th><th>Task reminders</th><th>How the 2nd-service address was entered</th><th>Answer changes</th></tr>
${recs.map((r) => `<tr><td>${r.id}<br><small>${r.pid6}…</small></td><td>${r.cond}<br><small>${r.svc2}${r.inter === 'present' ? ' + bridge' : ''}</small></td>${['MC1', 'MC2'].map((c) => `<td class="num">${r.survey[c]}</td>`).join('')}<td class="num">${r.survey.MC5} → ${scored('MC5', r.survey.MC5)}</td>${['MC3', 'MC4'].map((c) => `<td class="num">${r.survey[c]}</td>`).join('')}<td class="num">${r.survey.MC6} → ${scored('MC6', r.survey.MC6)}</td><td class="num">${fx(r.MCi)}</td><td class="num">${fx(r.MCh)}</td><td class="num">${fx(r.PU)}</td><td>${r.banner ? 'Yes' : 'No'}</td><td class="num">${r.taskReminders}</td><td>${esc(r.address.text)}</td><td>${esc(r.revisions.join('; ') || '—')}</td></tr>`).join('')}
</table>

<h2>6. What drives the High vs Low gap</h2>
<ul>
<li><b>Heterogeneity is reversed because of one cell.</b> Cell means for MC3, MC4, MC6ʳ: G1 ${fx(mch.cells.G1)}, G2 ${fx(mch.cells.G2)}, G3 ${fx(mch.cells.G3)}, G4 ${fx(mch.cells.G4)}. G4 (Cinema + bridge) is about as high as Courier; all three G3 participants (Cinema, no bridge) score lowest. Only ${mch.highAtLeast5}/${mch.nHigh} Cinema participants score 5 or above, versus ${mch.lowAtLeast5}/${mch.nLow} Courier participants.</li>
<li><b>Two participants in different cells gave the same answer pattern.</b> ${sharedPattern.length ? sharedPattern.map((s) => `${s.ids.join(' and ')} answered MC1, MC2, MC5, MC3, MC4, MC6 = ${s.pattern}`).join('; ') : 'none'}. Strongly agreeing that the service is "a different type of task" (MC3 = 7) while also strongly agreeing it is "the same kind of activity" (MC6 = 7) is contradictory. Together with their maximum usability scores, this suggests they read the items as praise or criticism of the app (similar = consistent = good), not as a description of the services.</li>
<li><b>Interrelatedness is in the expected direction, but compressed.</b> Only ${noBridge.filter((r) => r.address.typedAny).length}/${noBridge.length} no-bridge participants typed any address in the second service; the rest tapped a saved place. Every condition also showed a "Task 2 of 2" indicator, and ${noBridge.filter((r) => r.taskReminders > 0).length}/${noBridge.length} no-bridge participants got an idle "Task reminder: Use Courier/Cinema…" pop-up. So the low-interrelatedness cells still felt prompted and pre-filled, which is why MC1 and MC2 are high there (${fx(mci.cells.G1)} and ${fx(mci.cells.G3)} for G1 and G3 on the 3-item composite).</li>
</ul>

<h2>7. Systematic differences between conditions (not the intended manipulation)</h2>
<table><tr><th>Difference</th><th>Where</th><th>Likely effect on the checks</th></tr>
<tr><td>Scenario framing: Cinema = one outing ("meeting a friend… to watch a movie together"); Courier = two errands ("after your visit, send a package")</td><td>Scenario and task instructions (experiment-config.json)</td><td>Makes Cinema feel like the <i>same</i> activity as the ride (MC6) and Courier feel separate → pushes heterogeneity in the wrong direction.</td></tr>
<tr><td>Same interaction template for ride, Courier and Cinema (choose a place → choose from a list → confirm)</td><td>Service-2 screens</td><td>MC4 ("different kinds of actions") has nothing to pick up; answers follow personal reading, not condition.</td></tr>
<tr><td>Saved one-tap places in the no-bridge flows</td><td>CourierEntryScreen, MovieEntryScreen</td><td>No one re-types an address, so MC2/MC5 can't separate bridge from no bridge well.</td></tr>
<tr><td>Idle "Task reminder" pop-ups and "Task 2 of 2" indicator in all conditions</td><td>Guidance banner (all cells)</td><td>No-bridge participants were also "prompted with the next service" → inflates MC1 in G1/G3.</td></tr>
</table>

<h2>8. Questions to decide before the main study</h2>
<ol>
<li>Should heterogeneity items name the dimension we manipulate (service domain: transport/logistics vs entertainment) instead of "different" or "kinds of actions"? The Appendix D MC3 ("felt different from the ride service") would likely still hit the ceiling for Courier.</li>
<li>Should both scenarios use the same framing (both one outing, or both separate errands) so framing doesn't stand in for heterogeneity?</li>
<li>Should the no-bridge flows remove the saved-place shortcut, and should idle task reminders be off, so that low interrelatedness is clearly low?</li>
<li>Keep MC5 and MC6 in the composite? MC6 is reversed as strongly as MC3 (d = ${fx(itemRows.find((r) => r.code === 'MC6').d)} vs ${fx(itemRows.find((r) => r.code === 'MC3').d)}); MC5 sits at the floor in both groups.</li>
</ol>
</body></html>`

mkdirSync(OUT, { recursive: true })
writeFileSync(path.join(OUT, `${OUT_BASE}.html`), html)
console.log(`Wrote ${path.join(OUT, OUT_BASE)}.{html,json}`)
console.log(JSON.stringify({ checks, composites: composites.map((c) => ({ label: c.label, high: fx(c.highM), low: fx(c.lowM), d: fx(c.test?.d), p: fp(c.test?.p), cells: c.cells, loo: [fx(c.looMin), fx(c.looMax)] })), sharedPattern, items: itemRows.map((r) => ({ code: r.code, d: fx(r.d), corrPU: fx(r.corrPU) })) }, null, 1))
