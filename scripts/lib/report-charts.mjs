// Inline-SVG charts for the HTML batch report (no external dependencies).

export const CELL_COLORS = { G1: '#93c5fd', G2: '#1d4ed8', G3: '#fdba74', G4: '#c2410c' }
const CELLS = ['G1', 'G2', 'G3', 'G4']
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null)
const stdev = (a) => {
  if (a.length < 2) return 0
  const m = avg(a)
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1))
}

function niceDomain(values, fixed) {
  if (fixed) return { lo: fixed[0], hi: fixed[1], step: 1 }
  const hi = Math.max(10, Math.ceil(Math.max(...values) / 10) * 10)
  return { lo: 0, hi, step: hi / 5 }
}

function axis(W, L, R, y, dom) {
  const out = []
  for (let v = dom.lo; v <= dom.hi + 1e-9; v += dom.step) {
    out.push(`<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#eef2f7"/>`)
    out.push(`<text x="${L - 6}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="#64748b">${Math.round(v * 10) / 10}</text>`)
  }
  return out.join('')
}

/** Individual dots + cell mean (bar) ± 1 SD per G1–G4. */
export function dotPlot(recs, key, title, fixedDomain) {
  const W = 330, H = 220, L = 34, R = 10, T = 28, B = 40
  const all = recs.map((r) => r[key]).filter((v) => v != null)
  const dom = niceDomain(all, fixedDomain)
  const y = (v) => T + (H - T - B) * (1 - (v - dom.lo) / (dom.hi - dom.lo))
  const x = (i) => L + ((W - L - R) * (i + 0.5)) / 4
  const marks = CELLS.map((c, i) => {
    const v = recs.filter((r) => r.cond === c).map((r) => r[key]).filter((n) => n != null)
    if (!v.length) return ''
    const m = avg(v), s = stdev(v), cx = x(i)
    const dots = v
      .map((val, j) => `<circle cx="${cx + (j - (v.length - 1) / 2) * 7}" cy="${y(val)}" r="3.6" fill="${CELL_COLORS[c]}" stroke="#0f172a" stroke-width=".6" opacity=".9"/>`)
      .join('')
    return `<line x1="${cx}" x2="${cx}" y1="${y(Math.min(dom.hi, m + s))}" y2="${y(Math.max(dom.lo, m - s))}" stroke="#334155" stroke-width="1.2"/>
      <line x1="${cx - 15}" x2="${cx + 15}" y1="${y(m)}" y2="${y(m)}" stroke="#0f172a" stroke-width="2.4"/>${dots}
      <text x="${cx}" y="${H - B + 15}" font-size="11" text-anchor="middle" fill="#0f172a" font-weight="600">${c}</text>
      <text x="${cx}" y="${H - B + 28}" font-size="10" text-anchor="middle" fill="#64748b">M=${m.toFixed(2)}</text>`
  }).join('')
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${title}">
    <text x="${L}" y="16" font-size="12" font-weight="700" fill="#1b2a4a">${title}</text>${axis(W, L, R, y, dom)}${marks}</svg>`
}

/** 2×2 interaction plot: x = heterogeneity, one line per interrelatedness level. */
export function interactionPlot(recs, key, title, fixedDomain) {
  const W = 330, H = 220, L = 34, R = 86, T = 28, B = 34
  const all = recs.map((r) => r[key]).filter((v) => v != null)
  const dom = niceDomain(all, fixedDomain)
  const y = (v) => T + (H - T - B) * (1 - (v - dom.lo) / (dom.hi - dom.lo))
  const xs = { low: L + 40, high: W - R - 30 }
  const cellMean = (inter, het) => avg(recs.filter((r) => r.inter === inter && r.het === het).map((r) => r[key]).filter((v) => v != null))
  const line = (inter, color, dash) => {
    const a = cellMean(inter, 'low'), b = cellMean(inter, 'high')
    if (a == null || b == null) return ''
    const other = cellMean(inter === 'present' ? 'absent' : 'present', 'high')
    // Push the label away from the other line's end point so close means don't overlap.
    const labelY = y(b) + (other != null && other > b ? 12 : other != null && other < b ? -4 : 4)
    return `<line x1="${xs.low}" y1="${y(a)}" x2="${xs.high}" y2="${y(b)}" stroke="${color}" stroke-width="2.4" ${dash ? 'stroke-dasharray="6 4"' : ''}/>
      <circle cx="${xs.low}" cy="${y(a)}" r="4.5" fill="${color}"/><circle cx="${xs.high}" cy="${y(b)}" r="4.5" fill="${color}"/>
      <text x="${xs.high + 9}" y="${labelY}" font-size="10.5" fill="${color}" font-weight="600">${inter === 'present' ? 'Bridge' : 'No bridge'}</text>`
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${title}">
    <text x="${L}" y="16" font-size="12" font-weight="700" fill="#1b2a4a">${title}</text>${axis(W, L, R, y, dom)}
    ${line('absent', '#94a3b8', true)}${line('present', '#1d4ed8', false)}
    <text x="${xs.low}" y="${H - B + 16}" font-size="11" text-anchor="middle" fill="#0f172a">Courier (low)</text>
    <text x="${xs.high}" y="${H - B + 16}" font-size="11" text-anchor="middle" fill="#0f172a">Cinema (high)</text></svg>`
}
