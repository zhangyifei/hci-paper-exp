/**
 * paper-analysis.mjs
 * ────────────────────────────────────────────────────────────────────────────
 * Runs the paper's planned analysis on all VISIBLE runs (real human anon_* + simulated
 * SIM_*, excluding BOT); real runs are segmented by sequence_id resets:
 *   1. Descriptives per 2×2 cell (G1–G4)
 *   2. Manipulation checks (interrelatedness, heterogeneity) — independent t-tests
 *   3. Two-way ANOVA (Heterogeneity × Interrelatedness) on cognitive load  → H1,H2
 *   4. Serial mediation (Model 6): Interrelatedness → CL → PU → CI, bootstrap CI → H3,H4
 *   5. Supplementary behavioural evidence (nav-lag, task duration, banner uptake)
 *
 * Emits: scripts/paper-results.json (render to HTML/PDF with build-results-pdf.mjs)
 *
 * NOTE: dataset MIXES real human runs with SYNTHETIC top-up runs. Output is a small-N
 * pilot and must be labelled as such (synthetic rows included).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
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

// ── stats primitives ────────────────────────────────────────────────────────
const sum = (a) => a.reduce((x, y) => x + y, 0)
const mean = (a) => sum(a) / a.length
const variance = (a) => {
  const m = mean(a)
  return sum(a.map((x) => (x - m) ** 2)) / (a.length - 1)
}
const sd = (a) => Math.sqrt(variance(a))

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
// two-tailed p for t
const pFromT = (t, df) => betai(df / 2, 0.5, df / (df + t * t))
// upper-tail p for F
const pFromF = (F, df1, df2) => betai(df2 / 2, df1 / 2, df2 / (df2 + df1 * F))

// independent-samples t-test (Welch)
function tTest(a, b) {
  const ma = mean(a), mb = mean(b), va = variance(a), vb = variance(b)
  const se = Math.sqrt(va / a.length + vb / b.length)
  const t = (ma - mb) / se
  const df = se ** 4 / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1))
  // Cohen's d (pooled)
  const sp = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2))
  return { ma, mb, t, df, p: pFromT(t, df), d: (ma - mb) / sp }
}

function pearson(x, y) {
  const n = x.length, mx = mean(x), my = mean(y)
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my)
    sxx += (x[i] - mx) ** 2
    syy += (y[i] - my) ** 2
  }
  const r = sxy / Math.sqrt(sxx * syy)
  const t = r * Math.sqrt((n - 2) / (1 - r * r))
  return { r, p: pFromT(t, n - 2) }
}

/**
 * Pooled within-cell (partial) correlation between two keys, removing cell membership.
 * Centers each variable within its 2×2 cell, then correlates the residuals. This isolates
 * the within-condition CL→PU relationship after partialling out the manipulations.
 * df = N − g − 1 (g = number of non-empty cells).
 */
function withinCellCorr(recs, k1, k2) {
  const cells = {}
  for (const r of recs) (cells[r.cond] ||= []).push(r)
  const rx = [], ry = []
  for (const arr of Object.values(cells)) {
    if (!arr.length) continue
    const m1 = mean(arr.map((r) => r[k1])), m2 = mean(arr.map((r) => r[k2]))
    for (const r of arr) { rx.push(r[k1] - m1); ry.push(r[k2] - m2) }
  }
  const g = Object.keys(cells).length
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < rx.length; i++) { sxy += rx[i] * ry[i]; sxx += rx[i] ** 2; syy += ry[i] ** 2 }
  const r = sxy / Math.sqrt(sxx * syy)
  const df = recs.length - g - 1
  const t = r * Math.sqrt(df / (1 - r * r))
  return { r, df, p: pFromT(t, df), n: recs.length, g }
}

// ── Power analysis (a-priori required N to reach 80% power) ──────────────────
// Central F critical value (upper-tail alpha) via bisection on the upper-tail p.
function fCrit(alpha, d1, d2) {
  let lo = 1e-4, hi = 1e4
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (pFromF(mid, d1, d2) > alpha) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
// Noncentral F CDF via Poisson-weighted central beta mixture.
function ncFcdf(f, d1, d2, lambda) {
  const x = (d1 * f) / (d1 * f + d2)
  const halfL = lambda / 2
  let logw = -halfL, sum = 0
  for (let j = 0; j < 400; j++) {
    const w = Math.exp(logw)
    sum += w * betai(d1 / 2 + j, d2 / 2, x)
    logw += Math.log(halfL) - Math.log(j + 1)
    if (j > 5 && w < 1e-13) break
  }
  return sum
}
// Required total N for a 1-df fixed-effects ANOVA main effect of size ηp², at given power.
function requiredNforANOVA(etaP, alpha = 0.05, power = 0.8) {
  const f2 = etaP / (1 - etaP)
  for (let N = 8; N <= 100000; N += 4) {
    const d2 = N - 4
    if (d2 < 1) continue
    const pw = 1 - ncFcdf(fCrit(alpha, 1, d2), 1, d2, f2 * N)
    if (pw >= power) return { perCell: N / 4, nTotal: N, power: pw, f: Math.sqrt(f2), etaP }
  }
  return null
}
// Required N to detect a (partial) correlation via Fisher-z; `controls` = # partialled-out vars.
function requiredNforR(r, controls = 0, alpha = 0.05, power = 0.8) {
  const Z_A = 1.959964, Z_B = 0.841621 // z_.975 and z_.80
  const q = Math.abs(0.5 * Math.log((1 + Math.abs(r)) / (1 - Math.abs(r))))
  const n = Math.ceil(((Z_A + Z_B) / q) ** 2 + 3 + controls)
  return { n, r, controls }
}

// ── linear algebra for OLS ───────────────────────────────────────────────────
function matT(A) {
  return A[0].map((_, j) => A.map((r) => r[j]))
}
function matMul(A, B) {
  const n = A.length, m = B[0].length, k = B.length
  const C = Array.from({ length: n }, () => new Array(m).fill(0))
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { let s = 0; for (let t = 0; t < k; t++) s += A[i][t] * B[t][j]; C[i][j] = s }
  return C
}
function matInv(A) {
  const n = A.length
  const M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r
    ;[M[col], M[piv]] = [M[piv], M[col]]
    const d = M[col][col]
    for (let j = 0; j < 2 * n; j++) M[col][j] /= d
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col]
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[col][j]
    }
  }
  return M.map((r) => r.slice(n))
}
/** OLS with intercept. X = array of predictor-arrays (no intercept col). Returns coefs incl intercept, se, t, p, r2. */
function ols(y, predictors, names) {
  const n = y.length
  const X = y.map((_, i) => [1, ...predictors.map((p) => p[i])])
  const Xt = matT(X)
  const XtX = matMul(Xt, X)
  const XtXinv = matInv(XtX)
  const Xty = matMul(Xt, y.map((v) => [v]))
  const beta = matMul(XtXinv, Xty).map((r) => r[0])
  const yhat = X.map((row) => sum(row.map((v, j) => v * beta[j])))
  const resid = y.map((v, i) => v - yhat[i])
  const rss = sum(resid.map((r) => r * r))
  const k = beta.length
  const dfres = n - k
  const sigma2 = rss / dfres
  const se = beta.map((_, j) => Math.sqrt(sigma2 * XtXinv[j][j]))
  const tvals = beta.map((b, j) => b / se[j])
  const pvals = tvals.map((t) => pFromT(t, dfres))
  const my = mean(y)
  const tss = sum(y.map((v) => (v - my) ** 2))
  const r2 = 1 - rss / tss
  const labels = ['(intercept)', ...names]
  const coef = {}
  labels.forEach((l, j) => (coef[l] = { b: beta[j], se: se[j], t: tvals[j], p: pvals[j] }))
  return { coef, r2, n, dfres }
}

// seedable RNG for bootstrap
function makeRng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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

function main(rows) {
  // Build participant records from all VISIBLE runs: real human runs (anon_*) + simulated
  // sessions (SIM_*), excluding bots (BOT). Real manual runs all share one browser
  // session_id with sequence_id resetting to 0 per run, so segment by sequence_id resets
  // (in insertion-id order) instead of grouping by session_id.
  const visible = rows
    .filter((r) => !(r.participant_id || '').includes('BOT'))
    .slice()
    .sort((a, b) => a.id - b.id)

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

  const recs = []
  for (const evts of runs) {
    const done = evts.some((e) => e.event_name === 'experiment.completed')
    const invalid = evts.some((e) => e.event_name === 'experiment.invalidated' || e.event_name === 'attention_check.failed')
    const survey = evts.find((e) => e.event_name === 'survey.completed')
    if (!done || invalid || !survey?.payload?.aggregates) continue
    const cond = evts[0].condition
    const a = survey.payload.aggregates
    const resp = survey.payload.responses
    const trip = evts.find((e) => e.event_name === 'trip_complete.viewed')
    const entry = evts.find((e) => e.event_name === 'service2.entry')
    const s2 = evts.find((e) => e.event_name === 'service2.task.complete')
    recs.push({
      cond,
      het: cond === 'G3' || cond === 'G4' ? 1 : 0,
      inter: cond === 'G2' || cond === 'G4' ? 1 : 0,
      CL: a.cognitive_load_mean,
      PU: a.usability_mean,
      CI: a.continuance_mean,
      mcInter: (resp.MC1 + resp.MC2) / 2,
      mcHet: (resp.MC3 + resp.MC4) / 2,
      navLag: trip && entry ? (entry.timestamp - trip.timestamp) / 1000 : null,
      s2Dur: s2?.duration_ms ? s2.duration_ms / 1000 : null,
      banner: evts.some((e) => e.event_name === 'trip_complete.banner_tapped'),
    })
  }

  const N = recs.length
  const cells = { G1: [], G2: [], G3: [], G4: [] }
  for (const r of recs) cells[r.cond].push(r)
  const cellStat = (arr, key) => ({ n: arr.length, m: mean(arr.map((r) => r[key])), sd: sd(arr.map((r) => r[key])) })

  const descr = {}
  for (const c of ['G1', 'G2', 'G3', 'G4']) {
    descr[c] = {
      n: cells[c].length,
      CL: cellStat(cells[c], 'CL'),
      PU: cellStat(cells[c], 'PU'),
      CI: cellStat(cells[c], 'CI'),
      mcInter: cellStat(cells[c], 'mcInter'),
      mcHet: cellStat(cells[c], 'mcHet'),
      navLag: { m: mean(cells[c].map((r) => r.navLag)), sd: sd(cells[c].map((r) => r.navLag)) },
      s2Dur: { m: mean(cells[c].map((r) => r.s2Dur)), sd: sd(cells[c].map((r) => r.s2Dur)) },
      bannerRate: mean(cells[c].map((r) => (r.banner ? 1 : 0))),
    }
  }

  // ── Manipulation checks ──
  const interPresent = recs.filter((r) => r.inter === 1)
  const interAbsent = recs.filter((r) => r.inter === 0)
  const hetHigh = recs.filter((r) => r.het === 1)
  const hetLow = recs.filter((r) => r.het === 0)
  const mcInterTest = tTest(interPresent.map((r) => r.mcInter), interAbsent.map((r) => r.mcInter))
  const mcHetTest = tTest(hetHigh.map((r) => r.mcHet), hetLow.map((r) => r.mcHet))

  // ── Two-way ANOVA on CL ──
  const grand = mean(recs.map((r) => r.CL))
  const mHetLow = mean(hetLow.map((r) => r.CL)), mHetHigh = mean(hetHigh.map((r) => r.CL))
  const mInterAbs = mean(interAbsent.map((r) => r.CL)), mInterPres = mean(interPresent.map((r) => r.CL))
  const nPerFactorLevel = N / 2
  const nCell = N / 4
  const ssHet = nPerFactorLevel * ((mHetLow - grand) ** 2 + (mHetHigh - grand) ** 2)
  const ssInter = nPerFactorLevel * ((mInterAbs - grand) ** 2 + (mInterPres - grand) ** 2)
  let ssAB = 0, ssWithin = 0
  for (const c of ['G1', 'G2', 'G3', 'G4']) {
    const arr = cells[c].map((r) => r.CL)
    const cm = mean(arr)
    const het = c === 'G3' || c === 'G4' ? 1 : 0
    const inter = c === 'G2' || c === 'G4' ? 1 : 0
    const mA = het ? mHetHigh : mHetLow
    const mB = inter ? mInterPres : mInterAbs
    ssAB += nCell * (cm - mA - mB + grand) ** 2
    ssWithin += sum(arr.map((x) => (x - cm) ** 2))
  }
  const dfW = N - 4
  const msW = ssWithin / dfW
  const anova = {}
  for (const [k, ss] of [['het', ssHet], ['inter', ssInter], ['inter_x_het', ssAB]]) {
    const F = ss / 1 / msW
    anova[k] = { ss, df: 1, F, p: pFromF(F, 1, dfW), petaSq: ss / (ss + ssWithin) }
  }
  anova.residual = { ss: ssWithin, df: dfW }
  anova.means = { hetLow: mHetLow, hetHigh: mHetHigh, interAbsent: mInterAbs, interPresent: mInterPres, grand }

  // ── Correlations ──
  const CLv = recs.map((r) => r.CL), PUv = recs.map((r) => r.PU), CIv = recs.map((r) => r.CI)
  const cor = {
    CL_PU: pearson(CLv, PUv),
    CL_CI: pearson(CLv, CIv),
    PU_CI: pearson(PUv, CIv),
  }

  // ── Serial mediation (Model 6): X=Interrelatedness, covariate=Heterogeneity ──
  const X = recs.map((r) => r.inter)
  const HET = recs.map((r) => r.het)
  // Eq1: CL ~ inter + het
  const eq1 = ols(CLv, [X, HET], ['Interrelatedness', 'Heterogeneity'])
  // Eq2: PU ~ inter + het + CL
  const eq2 = ols(PUv, [X, HET, CLv], ['Interrelatedness', 'Heterogeneity', 'CognitiveLoad'])
  // Eq3: CI ~ inter + het + CL + PU
  const eq3 = ols(CIv, [X, HET, CLv, PUv], ['Interrelatedness', 'Heterogeneity', 'CognitiveLoad', 'Usability'])
  const a1 = eq1.coef['Interrelatedness'].b
  const d21 = eq2.coef['CognitiveLoad'].b // CL -> PU  (H3)
  const b1 = eq3.coef['CognitiveLoad'].b // CL -> CI
  const b2 = eq3.coef['Usability'].b // PU -> CI (H4)
  const a2 = eq2.coef['Interrelatedness'].b // inter -> PU (direct)
  const cPrime = eq3.coef['Interrelatedness'].b
  const indSerial = a1 * d21 * b2 // inter -> CL -> PU -> CI

  // Bootstrap the serial indirect effect
  const rng = makeRng(20260829)
  const B = 5000
  const boot = []
  for (let b = 0; b < B; b++) {
    const idx = Array.from({ length: N }, () => Math.floor(rng() * N))
    const cl = idx.map((i) => recs[i].CL)
    const pu = idx.map((i) => recs[i].PU)
    const ci = idx.map((i) => recs[i].CI)
    const xx = idx.map((i) => recs[i].inter)
    const hh = idx.map((i) => recs[i].het)
    try {
      const e1 = ols(cl, [xx, hh], ['x', 'h'])
      const e2 = ols(pu, [xx, hh, cl], ['x', 'h', 'cl'])
      const e3 = ols(ci, [xx, hh, cl, pu], ['x', 'h', 'cl', 'pu'])
      boot.push(e1.coef['x'].b * e2.coef['cl'].b * e3.coef['pu'].b)
    } catch {}
  }
  boot.sort((a, b) => a - b)
  const ciLow = boot[Math.floor(0.025 * boot.length)]
  const ciHigh = boot[Math.floor(0.975 * boot.length)]

  const mediation = {
    a1_inter_to_CL: eq1.coef['Interrelatedness'],
    het_to_CL: eq1.coef['Heterogeneity'],
    d21_CL_to_PU: eq2.coef['CognitiveLoad'],
    a2_inter_to_PU: eq2.coef['Interrelatedness'],
    b1_CL_to_CI: eq3.coef['CognitiveLoad'],
    b2_PU_to_CI: eq3.coef['Usability'],
    cPrime_inter_to_CI: eq3.coef['Interrelatedness'],
    r2: { eq1: eq1.r2, eq2: eq2.r2, eq3: eq3.r2 },
    indirectSerial: indSerial,
    bootCI: [ciLow, ciHigh],
    bootN: boot.length,
  }

  // ── Method fix: within-condition CL→PU (partial out cell membership) ──
  const within = { CL_PU: withinCellCorr(recs, 'CL', 'PU') }

  // ── A-priori power: N needed to detect the observed effects at 80% ──
  const power = {
    h2_anova: requiredNforANOVA(anova.inter.petaSq),
    h1_anova: requiredNforANOVA(anova.het.petaSq),
    h3_zeroOrder: requiredNforR(cor.CL_PU.r, 0),
    h3_within: requiredNforR(within.CL_PU.r, within.CL_PU.g - 1),
  }

  return { N, descr, mcInterTest, mcHetTest, anova, cor, within, power, mediation }
}

const rows = await fetchAll()
const results = main(rows)
writeFileSync(path.join(ROOT, 'scripts', 'paper-results.json'), JSON.stringify(results, null, 2))

// console sanity summary
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—')
console.log(`N = ${results.N}`)
for (const c of ['G1', 'G2', 'G3', 'G4']) {
  const d = results.descr[c]
  console.log(`${c} n=${d.n} CL=${f(d.CL.m)}(${f(d.CL.sd)}) PU=${f(d.PU.m)}(${f(d.PU.sd)}) CI=${f(d.CI.m)}(${f(d.CI.sd)}) banner=${(d.bannerRate * 100).toFixed(0)}%`)
}
console.log('MC interrelatedness:', `t=${f(results.mcInterTest.t)} p=${results.mcInterTest.p.toExponential(2)} d=${f(results.mcInterTest.d)}`)
console.log('MC heterogeneity:', `t=${f(results.mcHetTest.t)} p=${results.mcHetTest.p.toExponential(2)} d=${f(results.mcHetTest.d)}`)
console.log('ANOVA het:', `F=${f(results.anova.het.F)} p=${results.anova.het.p.toExponential(2)} ηp²=${f(results.anova.het.petaSq)}`)
console.log('ANOVA inter:', `F=${f(results.anova.inter.F)} p=${results.anova.inter.p.toExponential(2)} ηp²=${f(results.anova.inter.petaSq)}`)
console.log('ANOVA inter×het:', `F=${f(results.anova.inter_x_het.F)} p=${results.anova.inter_x_het.p.toExponential(2)} ηp²=${f(results.anova.inter_x_het.petaSq)}`)
console.log('H3 CL→PU:', `b=${f(results.mediation.d21_CL_to_PU.b)} p=${results.mediation.d21_CL_to_PU.p.toExponential(2)}`)
console.log('H4 PU→CI:', `b=${f(results.mediation.b2_PU_to_CI.b)} p=${results.mediation.b2_PU_to_CI.p.toExponential(2)}`)
console.log('Serial indirect (inter→CL→PU→CI):', `${f(results.mediation.indirectSerial, 3)} 95%CI[${f(results.mediation.bootCI[0], 3)}, ${f(results.mediation.bootCI[1], 3)}]`)
const w = results.within.CL_PU
console.log('H3 within-condition CL→PU (cell-centered):', `r=${f(w.r)} p=${w.p.toExponential(2)} df=${w.df}`)
const pw = results.power
console.log('Power → N needed @80%:',
  `H2 main effect ${pw.h2_anova ? pw.h2_anova.perCell + '/cell (' + pw.h2_anova.nTotal + ' total)' : '—'}`,
  `| H3 zero-order r n=${pw.h3_zeroOrder.n}`,
  `| H3 within r n=${pw.h3_within.n}`)
console.log('\nWrote scripts/paper-results.json')
