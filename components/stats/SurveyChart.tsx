'use client'

import { useMemo, useState } from 'react'

import { BoxPlotChart, summarizeValues, type BoxPlotSummary } from './BoxPlotChart'

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

const CONDITIONS = ['G1', 'G2', 'G3', 'G4'] as const

const CONSTRUCTS = [
  { key: 'cognitiveLoad', label: 'CL', fullLabel: 'Cognitive Load', color: '#dc2626' },
  { key: 'usability', label: 'PU', fullLabel: 'Perceived Usability', color: '#16a34a' },
  { key: 'continuance', label: 'CI', fullLabel: 'Continuance Intention', color: '#2563eb' },
  { key: 'manipCheck', label: 'MC', fullLabel: 'Manipulation Check', color: '#9333ea' },
] as const

const CONDITION_COLORS: Record<string, string> = {
  G1: '#2563eb',
  G2: '#0891b2',
  G3: '#7c3aed',
  G4: '#d97706',
}

interface GroupedBoxItem {
  id: string
  condition: string
  construct: string
  color: string
  values: number[]
  summary: BoxPlotSummary
}

type SurveyConstructKey = 'cognitiveLoad' | 'usability' | 'continuance' | 'manipCheck'

function GroupedSurveyBoxPlotChart({
  surveyByCondition,
}: {
  surveyByCondition: Record<string, SurveyStat | null>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const width = 940
  const height = 360
  const margin = { top: 16, right: 24, bottom: 64, left: 46 }
  const plotWidth = width - margin.left - margin.right
  const plotHeight = height - margin.top - margin.bottom
  const yMin = 1
  const yMax = 7
  const ticks = [1, 2, 3, 4, 5, 6, 7]
  const bandWidth = plotWidth / CONDITIONS.length
  const offsets = [-30, -10, 10, 30]
  const boxWidth = 14

  const yForValue = (value: number) => {
    const ratio = (value - yMin) / (yMax - yMin)
    return margin.top + plotHeight - ratio * plotHeight
  }

  const detailItems = useMemo(
    () =>
      CONDITIONS.flatMap((condition) =>
        CONSTRUCTS.flatMap((construct) => {
          const survey = surveyByCondition[condition]
          const key = construct.key as SurveyConstructKey
          const stat = survey?.[key]

          if (!stat) {
            return []
          }

          const summary = summarizeValues(stat.values)
          if (!summary) {
            return []
          }

          return [
            {
              id: `${condition}-${construct.key}`,
              condition,
              construct: construct.fullLabel,
              color: construct.color,
              values: stat.values,
              summary,
            },
          ]
        }),
      ),
    [surveyByCondition],
  )

  const fallbackId = detailItems[0]?.id ?? null
  const detail = detailItems.find((item) => item.id === (hoveredId ?? selectedId ?? fallbackId)) ?? null

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label="Survey construct boxplots by condition"
      >
        {ticks.map((tick) => {
          const y = yForValue(tick)
          return (
            <g key={tick}>
              <line
                x1={margin.left}
                x2={width - margin.right}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
                strokeDasharray="3 3"
              />
              <text
                x={margin.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize={11}
                fill="#6b7280"
              >
                {tick}
              </text>
            </g>
          )
        })}

        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={yForValue(4)}
          y2={yForValue(4)}
          stroke="#9ca3af"
          strokeDasharray="4 3"
          strokeWidth={1.5}
        />

        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={margin.top + plotHeight}
          y2={margin.top + plotHeight}
          stroke="#cbd5e1"
        />

        {CONDITIONS.map((condition, rowIndex) => {
          const centerX = margin.left + bandWidth * (rowIndex + 0.5)

          return (
            <g key={condition}>
              {CONSTRUCTS.map((construct, constructIndex) => {
                const itemId = `${condition}-${construct.key}`
                const item = detailItems.find((entry) => entry.id === itemId)

                if (!item) {
                  return null
                }

                const summary = item.summary
                const isActive = itemId === (hoveredId ?? selectedId ?? fallbackId)
                const x = centerX + offsets[constructIndex]
                const boxTop = yForValue(summary.q3)
                const boxBottom = yForValue(summary.q1)
                const medianY = yForValue(summary.median)
                const whiskerTop = yForValue(summary.whiskerHigh)
                const whiskerBottom = yForValue(summary.whiskerLow)
                const hitAreaTop = Math.min(whiskerTop, boxTop) - 10
                const hitAreaBottom = Math.max(whiskerBottom, boxBottom) + 10

                return (
                  <g
                    key={itemId}
                    onMouseEnter={() => setHoveredId(itemId)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => setSelectedId(itemId)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={x - 14}
                      y={hitAreaTop}
                      width={28}
                      height={hitAreaBottom - hitAreaTop}
                      fill="transparent"
                    />
                    <line
                      x1={x}
                      x2={x}
                      y1={whiskerTop}
                      y2={whiskerBottom}
                      stroke={construct.color}
                      strokeWidth={isActive ? 2.25 : 1.75}
                    />
                    <line
                      x1={x - 5.5}
                      x2={x + 5.5}
                      y1={whiskerTop}
                      y2={whiskerTop}
                      stroke={construct.color}
                      strokeWidth={isActive ? 2.25 : 1.75}
                    />
                    <line
                      x1={x - 5.5}
                      x2={x + 5.5}
                      y1={whiskerBottom}
                      y2={whiskerBottom}
                      stroke={construct.color}
                      strokeWidth={isActive ? 2.25 : 1.75}
                    />
                    <rect
                      x={x - boxWidth / 2}
                      y={boxTop}
                      width={boxWidth}
                      height={Math.max(1, boxBottom - boxTop)}
                      fill={construct.color}
                      fillOpacity={isActive ? 0.34 : 0.24}
                      stroke={construct.color}
                      strokeWidth={isActive ? 2.25 : 1.75}
                      rx={2}
                    />
                    <line
                      x1={x - boxWidth / 2}
                      x2={x + boxWidth / 2}
                      y1={medianY}
                      y2={medianY}
                      stroke={construct.color}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    {summary.outliers.map((outlier, outlierIndex) => {
                      const offset = (outlierIndex - (summary.outliers.length - 1) / 2) * 7
                      return (
                        <circle
                          key={`${item.id}-${outlier}-${outlierIndex}`}
                          cx={x + offset}
                          cy={yForValue(outlier)}
                          r={2.5}
                          fill={construct.color}
                          stroke="#fff"
                          strokeWidth={1}
                        />
                      )
                    })}
                  </g>
                )
              })}

              <text
                x={centerX}
                y={height - 18}
                textAnchor="middle"
                fontSize={12}
                fontWeight="700"
                fill="#374151"
              >
                {condition}
              </text>
            </g>
          )
        })}

        <text
          x={16}
          y={margin.top + plotHeight / 2}
          transform={`rotate(-90 16 ${margin.top + plotHeight / 2})`}
          textAnchor="middle"
          fontSize={11}
          fill="#9ca3af"
        >
          Scale Score
        </text>
      </svg>

      {detail ? (
        <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3 text-[12px] text-gray-600">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-gray-800">{detail.condition}</span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: detail.color }}
              />
              {detail.construct}
            </span>
            <span className="text-gray-500">n = {detail.values.length}</span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
            <span>Min {detail.summary.min.toFixed(2)}</span>
            <span>Q1 {detail.summary.q1.toFixed(2)}</span>
            <span>Median {detail.summary.median.toFixed(2)}</span>
            <span>Q3 {detail.summary.q3.toFixed(2)}</span>
            <span>Whisker low {detail.summary.whiskerLow.toFixed(2)}</span>
            <span>Whisker high {detail.summary.whiskerHigh.toFixed(2)}</span>
            <span>Max {detail.summary.max.toFixed(2)}</span>
            <span>
              Outliers{' '}
              {detail.summary.outliers.length
                ? detail.summary.outliers.map((value) => value.toFixed(2)).join(', ')
                : 'None'}
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px]">
        {CONSTRUCTS.map((construct) => (
          <div key={construct.key} className="flex items-center gap-1.5 text-gray-600">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: construct.color }}
            />
            <span>{construct.fullLabel}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SurveyChart({ surveyByCondition }: Props) {
  const hasData = CONDITIONS.some((condition) => surveyByCondition[condition] !== null)
  if (!hasData) {
    return (
      <div className="bg-white border border-gray-200 rounded p-6 flex items-center justify-center text-gray-400 text-sm italic h-48">
        No survey data available
      </div>
    )
  }

  return (
    <div className="space-y-8 mt-6">
      <div className="bg-white border border-gray-200 rounded p-5">
        <p className="text-[13px] font-semibold text-gray-800 mb-0.5 italic">
          Figure 3. Survey Construct Distributions by Condition (All Constructs)
        </p>
        <p className="text-[11px] text-gray-400 mb-4">
          <span className="font-semibold not-italic">Note.</span> Colored boxes show the interquartile range (Q1-Q3) for each construct within each condition; center line = median; whiskers extend to the most extreme non-outlier values within 1.5×IQR; dots indicate outliers. Dashed line marks the 7-point scale midpoint (4.0).
        </p>
        <GroupedSurveyBoxPlotChart surveyByCondition={surveyByCondition} />
        <p className="mt-2 text-[11px] text-gray-400">Hover or click a box to inspect exact values.</p>
      </div>

      <div>
        <p className="text-[13px] font-semibold text-gray-800 mb-0.5 italic">
          Figure 4. Individual Construct Distributions by Condition
        </p>
        <p className="text-[11px] text-gray-400 mb-4">
          <span className="font-semibold not-italic">Note.</span> Boxes show the interquartile range (Q1-Q3); center line = median; whiskers extend to the most extreme non-outlier values within 1.5×IQR; dots indicate outliers. The 7-point scale midpoint is 4.0.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CONSTRUCTS.map((construct) => {
            const items = CONDITIONS.map((condition) => ({
              key: `${construct.key}-${condition}`,
              label: condition,
              color: CONDITION_COLORS[condition],
              values: surveyByCondition[condition]?.[construct.key]?.values ?? [],
            }))

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
                <BoxPlotChart
                  items={items}
                  yLabel="Score"
                  domain={[1, 7]}
                  ticks={[1, 4, 7]}
                  compact
                />
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-gray-400">Hover or click a box to inspect quartiles, whiskers, and outliers.</p>
      </div>
    </div>
  )
}
