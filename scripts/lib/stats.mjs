// Small dependency-free statistics helpers for the report scripts.

export const sum = (a) => a.reduce((x, y) => x + y, 0)
export const mean = (a) => (a.length ? sum(a) / a.length : null)
export function variance(a) {
  if (a.length < 2) return null
  const m = mean(a)
  return sum(a.map((x) => (x - m) ** 2)) / (a.length - 1)
}
export const sd = (a) => {
  const v = variance(a)
  return v == null ? null : Math.sqrt(v)
}
export const median = (a) => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
export const rd = (x, d = 2) => (x == null || Number.isNaN(x) ? null : Number(x.toFixed(d)))

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
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
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

/** Two-tailed p for a t statistic. */
export const pFromT = (t, df) => (df > 0 ? betai(df / 2, 0.5, df / (df + t * t)) : null)
/** Upper-tail p for an F statistic. */
export const pFromF = (F, d1, d2) => (d2 > 0 && F >= 0 ? betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * F)) : null)

/** Welch t-test (a − b) with pooled-SD Cohen's d. */
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return null
  const ma = mean(a), mb = mean(b), va = variance(a), vb = variance(b)
  const se = Math.sqrt(va / a.length + vb / b.length)
  if (se === 0) return { ma, mb, t: null, df: null, p: null, d: null }
  const t = (ma - mb) / se
  const df = se ** 4 / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1))
  const sp = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2))
  return { ma, mb, t, df, p: pFromT(t, df), d: sp ? (ma - mb) / sp : null }
}

/** Pearson r; `lostDf` removes extra df (e.g. condition means partialled out). */
export function pearson(x, y, lostDf = 0) {
  const n = x.length
  if (n < 3) return null
  const mx = mean(x), my = mean(y)
  const sxy = sum(x.map((v, i) => (v - mx) * (y[i] - my)))
  const sxx = sum(x.map((v) => (v - mx) ** 2))
  const syy = sum(y.map((v) => (v - my) ** 2))
  if (!sxx || !syy) return { n, r: null, p: null }
  const r = sxy / Math.sqrt(sxx * syy)
  const df = n - 2 - lostDf
  const t = r * Math.sqrt(df / Math.max(1e-12, 1 - r * r))
  return { n, r, df, p: pFromT(t, df) }
}

/** Cronbach's alpha; rows = respondents, columns = (already reverse-scored) items. */
export function cronbachAlpha(rows) {
  const k = rows[0]?.length ?? 0
  if (k < 2 || rows.length < 3) return null
  const itemVar = sum(Array.from({ length: k }, (_, j) => variance(rows.map((r) => r[j]))))
  const totalVar = variance(rows.map((r) => sum(r)))
  return totalVar ? (k / (k - 1)) * (1 - itemVar / totalVar) : null
}

/** Two-way between-subjects ANOVA (exact sums of squares when cells are balanced). */
export function anova2x2(recs, fa, fb, dv) {
  const data = recs.filter((r) => r[dv] != null)
  const gm = mean(data.map((r) => r[dv]))
  const groupBy = (keyFn) =>
    data.reduce((o, r) => ({ ...o, [keyFn(r)]: [...(o[keyFn(r)] || []), r[dv]] }), {})
  const ssBetween = (groups) => sum(Object.values(groups).map((g) => g.length * (mean(g) - gm) ** 2))
  const cells = groupBy((r) => `${r[fa]}|${r[fb]}`)
  const ssA = ssBetween(groupBy((r) => r[fa]))
  const ssB = ssBetween(groupBy((r) => r[fb]))
  const ssAB = ssBetween(cells) - ssA - ssB
  const ssW = sum(Object.values(cells).flatMap((g) => g.map((v) => (v - mean(g)) ** 2)))
  const dfW = data.length - Object.keys(cells).length
  const msW = ssW / dfW
  const effect = (ss) => {
    const F = msW ? ss / msW : null
    return { ss, df: 1, F, p: F == null ? null : pFromF(F, 1, dfW), petaSq: ss + ssW ? ss / (ss + ssW) : null }
  }
  const sizes = Object.values(cells).map((g) => g.length)
  return { A: effect(ssA), B: effect(ssB), AB: effect(ssAB), dfW, msW, balanced: new Set(sizes).size === 1 }
}

/** Approx. n per group for 80% power, two-tailed α=.05, two-group comparison of effect d. */
export const nPerGroupFor80 = (d) => (d ? Math.ceil((2 * (1.959964 + 0.841621) ** 2) / d ** 2) : null)
