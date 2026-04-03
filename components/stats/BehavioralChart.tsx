'use client'

import {
  ComposedChart,
  Bar,
  ErrorBar,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface NumericStat {
  mean: number
  sd: number
  median?: number
  min?: number
  max?: number
  n: number
  values: number[]
}

interface ConditionStat {
  total: number
  completed: number
  navLag: NumericStat | null
  s2Dur: NumericStat | null
}

interface Props {
  conditionStats: Record<string, ConditionStat>
}

interface ScatterPoint {
  x: number
  y: number
  condition: string
}

const COND_COLORS: Record<string, string> = {
  G1: '#2563eb',
  G2: '#0891b2',
  G3: '#7c3aed',
  G4: '#d97706',
}

const CONDITIONS = ['G1', 'G2', 'G3', 'G4'] as const

function jitterForIndex(index: number): number {
  const offsets = [-0.24, -0.08, 0.08, 0.24]
  return offsets[index % offsets.length]
}

function buildScatterPoints(
  values: number[] | undefined,
  condition: string,
  conditionIndex: number,
): ScatterPoint[] {
  return (values ?? []).map((value, valueIndex) => ({
    x: conditionIndex + 1 + jitterForIndex(valueIndex),
    y: +value.toFixed(3),
    condition,
  }))
}

// Custom tick that renders multi-line condition labels
function ConditionTick(props: {
  x?: number
  y?: number
  payload?: { value: string }
}) {
  const { x = 0, y = 0, payload } = props
  const cond = payload?.value ?? ''
  const color = COND_COLORS[cond] ?? '#374151'
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={12}
        textAnchor="middle"
        fill={color}
        fontSize={11}
        fontWeight="700"
      >
        {cond}
      </text>
      <text x={0} y={0} dy={24} textAnchor="middle" fill="#6b7280" fontSize={10}>
        {{ G1: 'Courier · No Bridge', G2: 'Courier · Bridge', G3: 'Eats · No Bridge', G4: 'Eats · Bridge' }[cond]}
      </text>
    </g>
  )
}

// Custom tooltip
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{
    name?: string
    value?: number
    payload?: { condition?: string }
  }>
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  const conditionFromPayload = payload.find((entry) => entry.payload?.condition)?.payload?.condition
  const cond =
    conditionFromPayload ?? (typeof label === 'string' ? label : '')

  const metricRows = payload.filter((entry) => entry.name !== 'SD Range' && entry.value != null)
  return (
    <div className="bg-white border border-gray-200 rounded shadow-md p-3 text-[12px]">
      <p
        className="font-bold mb-2"
        style={{ color: COND_COLORS[cond] ?? '#374151' }}
      >
        {cond || 'Observation'}
      </p>
      {metricRows.map((entry) => {
        return (
          <div key={`${entry.name ?? 'value'}-${entry.value ?? 'unknown'}`} className="flex justify-between gap-4">
            <span className="text-gray-500">{entry.name}</span>
            <span className="font-mono font-semibold text-gray-800">
              {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
              {entry.name ? ' s' : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function BehavioralChart({ conditionStats }: Props) {
  // Build nav latency dataset
  const navData = CONDITIONS.map((cond, conditionIndex) => {
    const s = conditionStats[cond]?.navLag
    return {
      condition: cond,
      mean: s ? +s.mean.toFixed(3) : null,
      sd: s ? +s.sd.toFixed(3) : 0,
      points: buildScatterPoints(s?.values, cond, conditionIndex),
    }
  })

  const s2Data = CONDITIONS.map((cond, conditionIndex) => {
    const s = conditionStats[cond]?.s2Dur
    return {
      condition: cond,
      mean: s ? +s.mean.toFixed(3) : null,
      sd: s ? +s.sd.toFixed(3) : 0,
      points: buildScatterPoints(s?.values, cond, conditionIndex),
    }
  })

  // Flatten individual points for scatter (recharts needs flat array with x-category)
  const navPoints = navData.flatMap((d) => d.points)
  const s2Points = s2Data.flatMap((d) => d.points)

  return (
    <div className="grid lg:grid-cols-2 gap-8 mt-6">
      {/* Nav Latency */}
      <ChartPanel
        title="Figure 1. Navigation Latency by Condition"
        note="Bars = M; error bars = ±1 SD; dots = individual observations."
        yLabel="Time (s)"
        barData={navData}
        scatterPoints={navPoints}
        yDomain={[0, 'auto']}
      />

      {/* S2 Task Time */}
      <ChartPanel
        title="Figure 2. Service-2 Task Completion Time by Condition"
        note="Bars = M; error bars = ±1 SD; dots = individual observations."
        yLabel="Time (s)"
        barData={s2Data}
        scatterPoints={s2Points}
        yDomain={[0, 'auto']}
      />
    </div>
  )
}

function ChartPanel({
  title,
  note,
  yLabel,
  barData,
  scatterPoints,
  yDomain,
}: {
  title: string
  note: string
  yLabel: string
  barData: Array<{ condition: string; mean: number | null; sd: number }>
  scatterPoints: ScatterPoint[]
  yDomain: [number | string, number | string]
}) {
  const hasData = barData.some((d) => d.mean !== null)
  if (!hasData) {
    return (
      <div className="bg-white border border-gray-200 rounded p-6 flex items-center justify-center text-gray-400 text-sm italic h-64">
        No data available
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded p-5">
      <p className="text-[13px] font-semibold text-gray-800 mb-0.5 italic">{title}</p>
      <p className="text-[11px] text-gray-400 mb-4">
        <span className="font-semibold not-italic">Note.</span> {note}
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          data={barData}
          margin={{ top: 16, right: 16, bottom: 56, left: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="condition"
            tick={<ConditionTick />}
            interval={0}
            allowDuplicatedCategory={false}
            tickLine={false}
            axisLine={{ stroke: '#d1d5db' }}
            height={66}
          />
          <XAxis xAxisId="scatter" type="number" dataKey="x" domain={[0.5, 4.5]} hide />
          <YAxis
            domain={yDomain}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            label={{
              value: yLabel,
              angle: -90,
              position: 'insideLeft',
              offset: -25,
              style: { fontSize: 11, fill: '#9ca3af' },
            }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />

          {/* Mean bars */}
          <Bar dataKey="mean" name="Mean" barSize={40} radius={[3, 3, 0, 0]}>
            {barData.map((entry) => (
              <Cell
                key={entry.condition}
                fill={COND_COLORS[entry.condition] ?? '#94a3b8'}
                fillOpacity={0.75}
              />
            ))}
            <ErrorBar
              dataKey="sd"
              width={6}
              strokeWidth={2}
              stroke="#374151"
              direction="y"
            />
          </Bar>

          {/* Individual data points overlay */}
          {scatterPoints.length > 0 && (
            <Scatter
              name="Individual"
              data={scatterPoints}
              xAxisId="scatter"
              dataKey="y"
              fill="#1f2937"
              opacity={0.6}
              shape={(props: {
                cx?: number
                cy?: number
                payload?: { condition: string }
              }) => (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={4}
                  fill={COND_COLORS[props.payload?.condition ?? ''] ?? '#374151'}
                  fillOpacity={0.85}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              )}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
