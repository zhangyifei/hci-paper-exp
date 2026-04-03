'use client'

import { BoxPlotChart } from './BoxPlotChart'

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

const CONDITIONS = ['G1', 'G2', 'G3', 'G4'] as const

const COND_COLORS: Record<string, string> = {
  G1: '#2563eb',
  G2: '#0891b2',
  G3: '#7c3aed',
  G4: '#d97706',
}

const COND_SUBLABELS: Record<string, string> = {
  G1: 'Courier · No Bridge',
  G2: 'Courier · Bridge',
  G3: 'Eats · No Bridge',
  G4: 'Eats · Bridge',
}

export function BehavioralChart({ conditionStats }: Props) {
  const navItems = CONDITIONS.map((condition) => ({
    key: `${condition}-nav`,
    label: condition,
    subLabel: COND_SUBLABELS[condition],
    color: COND_COLORS[condition],
    values: conditionStats[condition]?.navLag?.values ?? [],
  }))

  const durationItems = CONDITIONS.map((condition) => ({
    key: `${condition}-duration`,
    label: condition,
    subLabel: COND_SUBLABELS[condition],
    color: COND_COLORS[condition],
    values: conditionStats[condition]?.s2Dur?.values ?? [],
  }))

  return (
    <div className="grid lg:grid-cols-2 gap-8 mt-6">
      <ChartPanel
        title="Figure 1. Navigation Latency by Condition"
        note="Boxes show the interquartile range (Q1-Q3); center line = median; whiskers extend to the most extreme non-outlier values within 1.5×IQR; dots indicate outliers."
        yLabel="Time (s)"
        items={navItems}
      />
      <ChartPanel
        title="Figure 2. Service-2 Task Completion Time by Condition"
        note="Boxes show the interquartile range (Q1-Q3); center line = median; whiskers extend to the most extreme non-outlier values within 1.5×IQR; dots indicate outliers."
        yLabel="Time (s)"
        items={durationItems}
      />
    </div>
  )
}

function ChartPanel({
  title,
  note,
  yLabel,
  items,
}: {
  title: string
  note: string
  yLabel: string
  items: Array<{
    key: string
    label: string
    subLabel: string
    color: string
    values: number[]
  }>
}) {
  const hasData = items.some((item) => item.values.length > 0)

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
      <BoxPlotChart items={items} yLabel={yLabel} />
    </div>
  )
}
