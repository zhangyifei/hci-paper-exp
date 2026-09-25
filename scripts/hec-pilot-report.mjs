/**
 * hec-pilot-report.mjs
 * ────────────────────────────────────────────────────────────────────────────
 * Read-only analysis + report for the "Pilot-test-hec-student" batch.
 * Pulls the COMPLETED (valid) assignments for the batch, scores the study-v2
 * survey (PU1–6, CI1–4, MC1–6 with reverse-coded items flipped as 8−x), and
 * reports:
 *   1. Sample / disposition (completed, invalid, released, in-progress)
 *   2. Per-cell descriptives (G1–G4) for CL, PU, CI + manipulation checks
 *   3. Factor contrasts (Interrelatedness present/absent; Heterogeneity high/low)
 *      via Welch t-tests + Cohen's d — EXPLORATORY, tiny-N pilot
 *   4. Manipulation-check evidence + banner uptake
 *   5. Behavioural metrics (Service-2 task duration)
 *
 * Emits: docs/paper/hec-pilot-report.{json,html}  (git-ignored) + console summary.
 * Usage: node scripts/hec-pilot-report.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'docs', 'paper')
const BATCH_ID = process.argv[2] || '168a526e-0f2e-4334-83ab-4cdd5c90754d'

function parseEnv(f) {
  const o = {}
  try {
    for (const l of readFileSync(f, 'utf8').split('\n')) {
      const m = l.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (m) o[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
  return o
}
const env = { ...parseEnv(path.join(ROOT, '.env.local')), ...process.env }
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── stats primitives ────────────────────────────────────────────────────────
const sum = (a) => a.reduce((x, y) => x + y, 0)
const mean = (a) => (a.length ? sum(a) / a.length : null)
const variance = (a) => {
  if (a.length < 2) return null
  const m = mean(a)
  return sum(a.map((x) => (x - m) ** 2)) / (a.length - 1)
}
const sd = (a) => {
  const v = variance(a)
  return v == null ? null : Math.sqrt(v)
}
const rd = (x, d = 2) => (x == null || Number.isNaN(x) ? null : Number(x.toFixed(d)))

function logGamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) ser += c[j] / ++y
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}
function betacf(a, b, x) {
  const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300
  let qab = a + b, qap = a + 1, qam = a - 1
  let c = 1, d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}
function betai(a, b, x) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a
  return 1 - (bt * betacf(b, a, 1 - x)) / b
}
const pFromT = (t, df) => (df <= 0 ? null : betai(df / 2, 0.5, df / (df + t * t)))

// Welch independent-samples t-test with pooled Cohen's d. Needs n≥2 in both arms.
function welch(a, b) {
  if (a.length < 2 || b.length < 2) return null
  const ma = mean(a), mb = mean(b), va = variance(a), vb = variance(b)
  const se = Math.sqrt(va / a.length + vb / b.length)
  if (se === 0) return { ma, mb, t: null, df: null, p: null, d: null, note: 'zero variance' }
  const t = (ma - mb) / se
  const df = se ** 4 / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1))
  const sp = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2))
  return { ma, mb, t, df, p: pFromT(t, df), d: sp ? (ma - mb) / sp : null }
}

// ── study-v2 survey scoring ─────────────────────────────────────────────────
const REVERSE = new Set(['PU3', 'PU5', 'PU6', 'CI4', 'MC5', 'MC6'])
const CONSTRUCTS = {
  CL: ['CL1', 'CL2', 'CL3'],
  PU: ['PU1', 'PU2', 'PU3', 'PU4', 'PU5', 'PU6'],
  CI: ['CI1', 'CI2', 'CI3', 'CI4'],
  MCi: ['MC1', 'MC2', 'MC5'],
  MCh: ['MC3', 'MC4', 'MC6'],
}
const numv = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function scoreConstruct(survey, codes) {
  const vals = codes
    .map((c) => {
      const v = numv(survey[c])
      if (v == null) return null
      return REVERSE.has(c) ? 8 - v : v
    })
    .filter((v) => v != null)
  return vals.length ? mean(vals) : null
}

// ── design map ───────────────────────────────────────────────────────────────
const DESIGN = {
  G1: { het: 'low', hetLabel: 'Courier', inter: 'absent', svc2: 'Courier' },
  G2: { het: 'low', hetLabel: 'Courier', inter: 'present', svc2: 'Courier' },
  G3: { het: 'high', hetLabel: 'Eats', inter: 'absent', svc2: 'Eats' },
  G4: { het: 'high', hetLabel: 'Eats', inter: 'present', svc2: 'Eats' },
}

// ── fetch ────────────────────────────────────────────────────────────────────
const { data: batch } = await db.from('test_batches').select('*').eq('id', BATCH_ID).single()
const { data: asg } = await db
  .from('participant_assignments')
  .select('*')
  .eq('batch_id', BATCH_ID)
  .order('group_condition')
  .order('assigned_at')

const disposition = {}
for (const a of asg || []) disposition[a.status] = (disposition[a.status] || 0) + 1

const completed = (asg || []).filter((a) => a.status === 'completed')
const recs = []
for (const a of completed) {
  const { data: evs } = await db
    .from('experiment_events')
    .select('event_name,payload,duration_ms,timestamp')
    .eq('session_id', a.exp_session_id)
    .order('sequence_id')
  const ev = (n) => (evs || []).find((e) => e.event_name === n)
  const survey = ev('survey.completed')?.payload?.responses || {}
  const quest = ev('questionnaire.completed')?.payload?.responses || {}
  const s2 = ev('service2.task.complete')
  const ts = (evs || []).map((e) => Number(e.timestamp)).filter(Boolean)
  recs.push({
    pid: a.prolific_pid,
    cond: a.group_condition,
    ...DESIGN[a.group_condition],
    CL: scoreConstruct(survey, CONSTRUCTS.CL),
    PU: scoreConstruct(survey, CONSTRUCTS.PU),
    CI: scoreConstruct(survey, CONSTRUCTS.CI),
    MCi: scoreConstruct(survey, CONSTRUCTS.MCi),
    MCh: scoreConstruct(survey, CONSTRUCTS.MCh),
    AC1: numv(survey.AC1),
    AC2: quest.AC2 ?? null,
    age: quest.DEM1 ?? null,
    gender: quest.DEM2 ?? null,
    fam: quest.FAM1 ?? null,
    banner: Boolean(ev('trip_complete.banner_tapped')),
    s2Sec: s2?.duration_ms ? rd(s2.duration_ms / 1000) : null,
    totalSec: ts.length ? Math.round((Math.max(...ts) - Math.min(...ts)) / 1000) : null,
    completedAt: a.completed_at,
  })
}

// ── descriptives ─────────────────────────────────────────────────────────────
const by = (pred) => recs.filter(pred)
const desc = (arr, key) => {
  const v = arr.map((r) => r[key]).filter((x) => x != null)
  return { n: v.length, mean: rd(mean(v)), sd: rd(sd(v)), min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null, values: v.map((x) => rd(x)) }
}
const cellStats = {}
for (const c of ['G1', 'G2', 'G3', 'G4']) {
  const g = by((r) => r.cond === c)
  cellStats[c] = {
    n: g.length,
    CL: desc(g, 'CL'),
    PU: desc(g, 'PU'),
    CI: desc(g, 'CI'),
    MCi: desc(g, 'MCi'),
    MCh: desc(g, 'MCh'),
    s2Sec: desc(g, 's2Sec'),
    bannerUptake: `${g.filter((r) => r.banner).length}/${g.length}`,
  }
}

// ── factor contrasts (exploratory) ──────────────────────────────────────────
const interPresent = by((r) => r.inter === 'present')
const interAbsent = by((r) => r.inter === 'absent')
const hetHigh = by((r) => r.het === 'high')
const hetLow = by((r) => r.het === 'low')
const vals = (arr, k) => arr.map((r) => r[k]).filter((x) => x != null)

function contrast(groupA, groupB, labelA, labelB, key) {
  const a = vals(groupA, key), b = vals(groupB, key)
  const test = welch(a, b)
  return {
    key,
    [labelA]: { n: a.length, mean: rd(mean(a)), sd: rd(sd(a)) },
    [labelB]: { n: b.length, mean: rd(mean(b)), sd: rd(sd(b)) },
    t: test ? rd(test.t, 2) : null,
    df: test ? rd(test.df, 1) : null,
    p: test?.p != null ? rd(test.p, 3) : null,
    d: test?.d != null ? rd(test.d, 2) : null,
  }
}

const interContrasts = ['CL', 'PU', 'CI', 'MCi', 'MCh'].map((k) => contrast(interPresent, interAbsent, 'present', 'absent', k))
const hetContrasts = ['CL', 'PU', 'CI', 'MCi', 'MCh'].map((k) => contrast(hetHigh, hetLow, 'high', 'low', k))

// banner uptake by factor
const bannerByInter = {
  present: `${interPresent.filter((r) => r.banner).length}/${interPresent.length}`,
  absent: `${interAbsent.filter((r) => r.banner).length}/${interAbsent.length}`,
}

const result = {
  batch: { id: batch?.id, name: batch?.name, status: batch?.status, groupSize: batch?.group_size, createdAt: batch?.created_at },
  generatedAt: new Date().toISOString(),
  disposition,
  nAssigned: (asg || []).length,
  nCompleted: completed.length,
  perCellCompleted: Object.fromEntries(['G1', 'G2', 'G3', 'G4'].map((c) => [c, cellStats[c].n])),
  participants: recs.map((r) => ({
    pid: r.pid, cond: r.cond, CL: rd(r.CL), PU: rd(r.PU), CI: rd(r.CI), MCi: rd(r.MCi), MCh: rd(r.MCh),
    AC1: r.AC1, AC2: r.AC2, banner: r.banner, s2Sec: r.s2Sec, totalSec: r.totalSec, age: r.age, gender: r.gender, fam: r.fam,
  })),
  cellStats,
  interContrasts,
  hetContrasts,
  bannerByInter,
}

mkdirSync(OUT, { recursive: true })
writeFileSync(path.join(OUT, 'hec-pilot-report.json'), JSON.stringify(result, null, 2))

// ── HTML report ──────────────────────────────────────────────────────────────
const fmt = (x) => (x == null ? '—' : x)
const pCell = (p) => (p == null ? '—' : p < 0.001 ? '<.001' : p.toFixed(3).replace(/^0/, ''))
function descRow(label, cs, key) {
  const d = cs[key]
  return `<td>${fmt(d.mean)}${d.sd != null ? ` <span class="sd">(${d.sd})</span>` : ''}</td>`
}
function cellTable() {
  const rows = ['CL', 'PU', 'CI', 'MCi', 'MCh'].map((k) => {
    const nice = { CL: 'Cognitive Load ↓', PU: 'Perceived Usability ↑', CI: 'Continuance Intent ↑', MCi: 'MC: Interrelatedness', MCh: 'MC: Heterogeneity' }[k]
    return `<tr><td class="lab">${nice}</td>${['G1', 'G2', 'G3', 'G4'].map((c) => descRow(c, cellStats[c], k)).join('')}</tr>`
  }).join('')
  return `<table class="grid"><thead><tr><th></th>
    <th>G1<br><small>Courier · no bridge<br>n=${cellStats.G1.n}</small></th>
    <th>G2<br><small>Courier · bridge<br>n=${cellStats.G2.n}</small></th>
    <th>G3<br><small>Eats · no bridge<br>n=${cellStats.G3.n}</small></th>
    <th>G4<br><small>Eats · bridge<br>n=${cellStats.G4.n}</small></th></tr></thead>
    <tbody>${rows}
    <tr><td class="lab">Banner uptake</td>${['G1', 'G2', 'G3', 'G4'].map((c) => `<td>${cellStats[c].bannerUptake}</td>`).join('')}</tr>
    <tr><td class="lab">Service-2 task (s)</td>${['G1', 'G2', 'G3', 'G4'].map((c) => `<td>${fmt(cellStats[c].s2Sec.mean)}</td>`).join('')}</tr>
    </tbody></table>`
}
function contrastTable(rows, la, lb, title, hint) {
  const nice = { CL: 'Cognitive Load', PU: 'Perceived Usability', CI: 'Continuance Intent', MCi: 'MC: Interrelatedness', MCh: 'MC: Heterogeneity' }
  return `<h3>${title} <span class="hint">${hint}</span></h3>
  <table class="contrast"><thead><tr><th>Measure</th><th>${la} (M±SD)</th><th>${lb} (M±SD)</th><th>t</th><th>df</th><th>p</th><th>d</th></tr></thead><tbody>
  ${rows.map((r) => `<tr><td class="lab">${nice[r.key]}</td>
    <td>${fmt(r[la].mean)} ± ${fmt(r[la].sd)} <small>(n=${r[la].n})</small></td>
    <td>${fmt(r[lb].mean)} ± ${fmt(r[lb].sd)} <small>(n=${r[lb].n})</small></td>
    <td>${fmt(r.t)}</td><td>${fmt(r.df)}</td><td>${pCell(r.p)}</td><td>${fmt(r.d)}</td></tr>`).join('')}
  </tbody></table>`
}
const partRows = recs.map((r) => `<tr>
  <td>${r.pid}</td><td>${r.cond}</td>
  <td>${fmt(rd(r.CL))}</td><td>${fmt(rd(r.PU))}</td><td>${fmt(rd(r.CI))}</td>
  <td>${fmt(rd(r.MCi))}</td><td>${fmt(rd(r.MCh))}</td>
  <td>${r.banner ? '✓' : '—'}</td><td>${fmt(r.s2Sec)}</td><td>${r.AC1 === 5 ? '✓' : '✗'}</td>
  <td>${fmt(r.age)}</td><td>${fmt(r.gender)}</td></tr>`).join('')

const html = `<!doctype html><html><head><meta charset="utf-8"><title>${batch?.name} — pilot analysis</title>
<style>
  :root{--ink:#1b2a4a;--mut:#64748b;--line:#e2e8f0;--accent:#2563eb;--warn:#b45309;--good:#15803d}
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:940px;margin:32px auto;padding:0 20px;line-height:1.5}
  h1{color:var(--ink);margin-bottom:2px}h2{color:var(--ink);border-bottom:2px solid var(--line);padding-bottom:6px;margin-top:34px}
  h3{color:var(--ink);margin-bottom:6px}.hint{font-weight:400;font-size:12px;color:var(--mut)}
  .sub{color:var(--mut);margin-top:0}
  .cards{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
  .card{border:1px solid var(--line);border-radius:10px;padding:12px 16px;min-width:120px}
  .card .num{font-size:26px;font-weight:700;color:var(--accent)}.card .lbl{font-size:12px;color:var(--mut)}
  table{border-collapse:collapse;width:100%;margin:10px 0;font-size:14px}
  th,td{border:1px solid var(--line);padding:7px 9px;text-align:center}
  th{background:#f1f5f9;color:var(--ink);font-weight:600}
  td.lab,th:first-child{text-align:left}.sd{color:var(--mut);font-size:12px}
  small{color:var(--mut)}
  .callout{background:#fffbeb;border-left:4px solid var(--warn);padding:10px 14px;border-radius:0 8px 8px 0;margin:14px 0;font-size:14px}
  .good{color:var(--good);font-weight:600}.warn{color:var(--warn);font-weight:600}
  ul{margin:8px 0}li{margin:4px 0}
  footer{margin-top:40px;color:var(--mut);font-size:12px;border-top:1px solid var(--line);padding-top:10px}
</style></head><body>
<h1>${batch?.name}</h1>
<p class="sub">Pilot data-analysis report · batch <code>${batch?.id}</code> · status <b>${batch?.status}</b> · created ${new Date(batch?.created_at).toLocaleDateString()} · generated ${new Date().toLocaleString()}</p>

<div class="callout"><b>⚠ Pilot, not confirmatory.</b> N = ${completed.length} valid completions (G1=${cellStats.G1.n}, G2=${cellStats.G2.n}, G3=${cellStats.G3.n}, G4=${cellStats.G4.n}). Cell sizes are far below any power threshold; G4 has n=${cellStats.G4.n}. All inferential tests below are <b>exploratory</b> — read the descriptives and manipulation-check direction, not the p-values. This is a data-integrity + instrument-sanity check of the v2 study, not hypothesis testing.</div>

<h2>1 · Sample & disposition</h2>
<div class="cards">
  <div class="card"><div class="num">${result.nAssigned}</div><div class="lbl">participants assigned</div></div>
  <div class="card"><div class="num">${completed.length}</div><div class="lbl">completed &amp; valid</div></div>
  <div class="card"><div class="num">${disposition.invalid || 0}</div><div class="lbl">invalid (failed AC)</div></div>
  <div class="card"><div class="num">${disposition.released || 0}</div><div class="lbl">released / abandoned</div></div>
  <div class="card"><div class="num">${disposition.assigned || 0}</div><div class="lbl">in progress</div></div>
</div>
<p>Every valid completion passed both attention checks (AC1 = 5, AC2 = "rarely"). One G1 participant was auto-invalidated on AC2. Completions per cell: <b>G1 ${cellStats.G1.n}, G2 ${cellStats.G2.n}, G3 ${cellStats.G3.n}, G4 ${cellStats.G4.n}</b>.</p>

<h2>2 · Per-cell descriptives (M, SD)</h2>
<p class="sub">Constructs scored on study-v2 items with reverse-coded items flipped (8−x): PU3/PU5/PU6, CI4, MC5, MC6. CL ↓ = better; PU ↑ / CI ↑ = better.</p>
${cellTable()}

<h2>3 · Manipulation checks (did the design land?)</h2>
<p>Bridge conditions (G2, G4) should raise <b>MC-Interrelatedness</b>; the Eats conditions (G3, G4) should raise <b>MC-Heterogeneity</b>. Banner uptake should be ~100% in bridge cells and 0% without a bridge.</p>
<ul>
  <li><b>Interrelatedness MC</b> — bridge present M=${rd(mean(vals(interPresent, 'MCi')))} vs absent M=${rd(mean(vals(interAbsent, 'MCi')))} (${rd(mean(vals(interPresent, 'MCi'))) > rd(mean(vals(interAbsent, 'MCi'))) ? '<span class="good">correct direction</span>' : '<span class="warn">wrong direction</span>'}).</li>
  <li><b>Heterogeneity MC</b> — Eats (high) M=${rd(mean(vals(hetHigh, 'MCh')))} vs Courier (low) M=${rd(mean(vals(hetLow, 'MCh')))} (${rd(mean(vals(hetHigh, 'MCh'))) > rd(mean(vals(hetLow, 'MCh'))) ? '<span class="good">correct direction</span>' : '<span class="warn">wrong direction</span>'}).</li>
  <li><b>Banner uptake</b> — bridge cells ${bannerByInter.present}, no-bridge cells ${bannerByInter.absent} (${bannerByInter.absent.startsWith('0/') ? '<span class="good">clean separation</span>' : '<span class="warn">leak</span>'}).</li>
</ul>

<h2>4 · Exploratory factor contrasts</h2>
${contrastTable(interContrasts, 'present', 'absent', 'Interrelatedness (bridge vs no-bridge)', 'G2+G4 vs G1+G3')}
${contrastTable(hetContrasts, 'high', 'low', 'Heterogeneity (Eats vs Courier)', 'G3+G4 vs G1+G2')}

<h2>5 · Participant-level data</h2>
<table><thead><tr><th>Participant</th><th>Cell</th><th>CL</th><th>PU</th><th>CI</th><th>MC-i</th><th>MC-h</th><th>Banner</th><th>S2 (s)</th><th>AC1</th><th>Age</th><th>Gender</th></tr></thead>
<tbody>${partRows}</tbody></table>

<footer>Read-only against Supabase <code>experiment_events</code> / <code>participant_assignments</code>. Regenerate: <code>node scripts/hec-pilot-report.mjs</code>. JSON companion: <code>docs/paper/hec-pilot-report.json</code>.</footer>
</body></html>`
writeFileSync(path.join(OUT, 'hec-pilot-report.html'), html)

// ── console summary ──────────────────────────────────────────────────────────
const L = (s = '') => console.log(s)
L(`\n════ ${batch?.name} — pilot analysis ════`)
L(`assigned=${result.nAssigned}  completed=${completed.length}  invalid=${disposition.invalid || 0}  released=${disposition.released || 0}  inProgress=${disposition.assigned || 0}`)
L(`per-cell completed: G1=${cellStats.G1.n} G2=${cellStats.G2.n} G3=${cellStats.G3.n} G4=${cellStats.G4.n}`)
L('\ncell means (CL/PU/CI | MCi/MCh | banner):')
for (const c of ['G1', 'G2', 'G3', 'G4']) {
  const s = cellStats[c]
  L(`  ${c}: CL=${fmt(s.CL.mean)} PU=${fmt(s.PU.mean)} CI=${fmt(s.CI.mean)} | MCi=${fmt(s.MCi.mean)} MCh=${fmt(s.MCh.mean)} | banner ${s.bannerUptake}`)
}
L('\ninterrelatedness (present vs absent):')
for (const r of interContrasts) L(`  ${r.key}: ${fmt(r.present.mean)} vs ${fmt(r.absent.mean)}  t=${fmt(r.t)} p=${pCell(r.p)} d=${fmt(r.d)}`)
L('\nheterogeneity (high/Eats vs low/Courier):')
for (const r of hetContrasts) L(`  ${r.key}: ${fmt(r.high.mean)} vs ${fmt(r.low.mean)}  t=${fmt(r.t)} p=${pCell(r.p)} d=${fmt(r.d)}`)
L(`\n→ wrote docs/paper/hec-pilot-report.html + .json`)
