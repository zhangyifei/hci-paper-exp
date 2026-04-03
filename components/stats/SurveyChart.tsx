'use client'

import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ErrorBar,
  Scatter,
  Cell,
} from 'recharts'

interface SurveyStat {
  n: number
  cognitiveLoad: { mean: number; sd: number; values: number[] }
  usability: { mean: number; sd: number; values: number[] }
  continuance: { mean: number; sd: number; values: number[] }
  manipCheck: { mean: number; sd: number; values: number[] }
}

interface Props {
  surveyByCondition: Record<string, SurveyStat | null>
}

interface ScatterPoint {
  x: number
  y: number
  condition: string
}

const CONDITIONS = ['G1', 'G2', 'G3', 'G4'] as const

const CONSTRUCTS = [
  { key: 'cognitiveLoad', label: 'CL', fullLabel: 'Cognitive Load', color: '#dc2626' },
  { key: 'usability', label: 'PU', fullLabel: 'Perceived Usability', color: '#16a34a' },
  { key: 'continuance', label: 'CI', fullLabel: 'Continuance Intention', color: '#2563eb' },
  { key: 'manipCheck', label: 'MC', fullLabel: 'Manipulation Check', color: '#9333ea' },
] as const

const COND_COLORS: Record<string, string> = {
  G1: '#2563eb',
  G2: '#0891b2',
  G3: '#7c3aed',
  G4: '#d97706',
}

function jitterForIndex(index: number): number {
  const offsets = [-0.24, -0.08, 0.08, 0.24]
  return offsets[index % offsets.length]
}

function buildScatterPoints(values: number[] | undefined, conditionIndex: number, condition: string) {
  return (values ?? []).map((value, valueIndex) => ({
    x: conditionIndex + 1 + jitterForIndex(valueIndex),
    y: +value.toFixed(3),
    condition,
  }))
}

// ── Survey grouped bar: one row per construct, columns = conditions ───────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{
    name?: string
    value?: number
    color?: string
    payload?: { condition?: string }
  }>
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  const conditionFromPayload = payload.find((entry) => entry.payload?.condition)?.payload?.condition
  const heading =
    conditionFromPayload ?? (typeof label === 'string' ? label : 'Observation')

  return (
    <div className="bg-white border border-gray-200 rounded shadow-md p-3 text-[12px]">
      <p className="font-bold text-gray-700 mb-2">{heading}</p>
      {payload.map((entry) => (
        <div
          key={`${entry.name ?? 'value'}-${entry.value ?? 'unknown'}`}
          className="flex justify-between gap-4 items-center"
        >
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ background: entry.color ?? '#374151' }}
            />
            <span className="text-gray-500">{entry.name ?? 'Individual'}</span>
          </span>
          <span className="font-mono font-semibold text-gray-800">
            {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// Constructs-as-rows chart: each group on x-axis = one construct, bars = conditions
export function SurveyChart({ surveyByCondition }: Props) {
  // Build data: one entry per construct
  const byConstruct = CONSTRUCTS.map((construct) => {
    const entry: Record<string, number | string | null> = {
      construct: construct.fullLabel,
      constructLabel: construct.label,
    }
    for (const cond of CONDITIONS) {
      const s = surveyByCondition[cond]
      const stat = s?.[construct.key]
      entry[cond] = stat ? +stat.mean.toFixed(3) : null
      entry[`${cond}_sd`] = stat ? +stat.sd.toFixed(3) : 0
    }
    return entry
  })

  // Build data: one entry per condition (for the dot-plot per-construct panels)
  const byCondition = CONDITIONS.map((cond) => {
    const s = surveyByCondition[cond]
    return {
      condition: cond,
      CL: s ? +s.cognitiveLoad.mean.toFixed(3) : null,
      CL_sd: s ? +s.cognitiveLoad.sd.toFixed(3) : 0,
      PU: s ? +s.usability.mean.toFixed(3) : null,
      PU_sd: s ? +s.usability.sd.toFixed(3) : 0,
      CI: s ? +s.continuance.mean.toFixed(3) : null,
      CI_sd: s ? +s.continuance.sd.toFixed(3) : 0,
      MC: s ? +s.manipCheck.mean.toFixed(3) : null,
      MC_sd: s ? +s.manipCheck.sd.toFixed(3) : 0,
    }
  })

  const hasData = CONDITIONS.some((c) => surveyByCondition[c] !== null)
  if (!hasData) {
    return (
      <div className="bg-white border border-gray-200 rounded p-6 flex items-center justify-center text-gray-400 text-sm italic h-48">
        No survey data available
      </div>
    )
  }

  return (
    <div className="space-y-8 mt-6">
      {/* Panel 1: grouped bar — all conditions per construct */}
      <div className="bg-white border border-gray-200 rounded p-5">
        <p className="text-[13px] font-semibold text-gray-800 mb-0.5 italic">
          Figure 3. Survey Scale Means by Condition (All Constructs)
        </p>
        <p className="text-[11px] text-gray-400 mb-4">
          <span className="font-semibold not-italic">Note.</span> Grouped bars show condition means per construct; dashed line marks scale midpoint (4.0). 7-point Likert scale.
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={byCondition} margin={{ top: 16, right: 20, bottom: 8, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="condition"
              tick={{ fontSize: 12, fontWeight: 700, fill: '#374151' }}
              tickLine={false}
              axisLine={{ stroke: '#d1d5db' }}
            />
            <YAxis
              domain={[1, 7]}
              ticks={[1, 2, 3, 4, 5, 6, 7]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              label={{
                value: 'Scale Score',
                angle: -90,
                position: 'insideLeft',
                offset: -25,
                style: { fontSize: 11, fill: '#9ca3af' },
              }}
            />
            <ReferenceLine y={4} stroke="#9ca3af" strokeDasharray="4 3" strokeWidth={1.5} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
            <Legend
              iconType="square"
              iconSize={10}
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            />

            {CONSTRUCTS.map((c) => (
              <Bar
                key={c.key}
                dataKey={c.label}
                name={c.fullLabel}
                fill={c.color}
                fillOpacity={0.75}
                barSize={22}
                radius={[2, 2, 0, 0]}
              >
                <ErrorBar
                  dataKey={`${c.label}_sd`}
                  width={4}
                  strokeWidth={1.5}
                  stroke={c.color}
                  direction="y"
                />
              </Bar>
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Panel 2: 4-panel small multiples — one construct per panel, bars = conditions + dots */}
      <div>
        <p className="text-[13px] font-semibold text-gray-800 mb-0.5 italic">
          Figure 4. Individual Construct Comparisons with Data Points
        </p>
        <p className="text-[11px] text-gray-400 mb-4">
          <span className="font-semibold not-italic">Note.</span> Bars = M ± 1 SD; colored dots = individual participant responses; dashed line = scale midpoint (4.0).
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CONSTRUCTS.map((construct) => {
            // Individual raw values for scatter
            const scatterPoints = CONDITIONS.flatMap((cond, conditionIndex) => {
              const s = surveyByCondition[cond]
              const vals = s?.[construct.key]?.values ?? []
              return buildScatterPoints(vals, conditionIndex, cond)
            })

            return (
              <div key={construct.key} className="bg-white border border-gray-200 rounded p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <span
                    className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ background: construct.color }}
                  />
                  <span className="text-[12px] font-semibold text-gray-700">
                    {construct.label} — {construct.fullLabel}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart
                    data={byCondition}
                    margin={{ top: 8, right: 8, bottom: 16, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                    <XAxis
                      dataKey="condition"
                      interval={0}
                      allowDuplicatedCategory={false}
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#374151' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <XAxis
                      xAxisId="scatter"
                      type="number"
                      dataKey="x"
                      domain={[0.5, 4.5]}
                      hide
                    />
                    <YAxis
                      domain={[1, 7]}
                      ticks={[1, 4, 7]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      width={20}
                    />
                    <ReferenceLine
                      y={4}
                      stroke="#d1d5db"
                      strokeDasharray="3 2"
                      strokeWidth={1}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const p = payload[0]
                        if (!p) return null
                        const heading =
                          (typeof p.payload === 'object' &&
                          p.payload !== null &&
                          'condition' in p.payload &&
                          typeof p.payload.condition === 'string'
                            ? p.payload.condition
                            : typeof label === 'string'
                              ? label
                              : 'Observation')
                        return (
                          <div className="bg-white border border-gray-200 rounded shadow-sm p-2 text-[11px]">
                            <span className="font-bold" style={{ color: COND_COLORS[heading] ?? '#374151' }}>
                              {heading}
                            </span>
                            <div className="text-gray-600 mt-0.5">
                              M = {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
                            </div>
                          </div>
                        )
                      }}
                      cursor={{ fill: '#f9fafb' }}
                    />

                    <Bar
                      dataKey={construct.label}
                      barSize={28}
                      radius={[2, 2, 0, 0]}
                    >
                      {byCondition.map((entry) => (
                        <Cell
                          key={entry.condition}
                          fill={COND_COLORS[entry.condition] ?? '#94a3b8'}
                          fillOpacity={0.65}
                        />
                      ))}
                      <ErrorBar
                        dataKey={`${construct.label}_sd`}
                        width={5}
                        strokeWidth={1.5}
                        stroke="#374151"
                        direction="y"
                      />
                    </Bar>

                    {scatterPoints.length > 0 && (
                      <Scatter
                        data={scatterPoints}
                        xAxisId="scatter"
                        dataKey="y"
                        shape={(props: {
                          cx?: number
                          cy?: number
                          payload?: { condition: string }
                        }) => (
                          <circle
                            cx={props.cx}
                            cy={props.cy}
                            r={3.5}
                            fill={COND_COLORS[props.payload?.condition ?? ''] ?? '#374151'}
                            fillOpacity={0.85}
                            stroke="#fff"
                            strokeWidth={1}
                          />
                        )}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
