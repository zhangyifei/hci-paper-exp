'use client'

import { useMemo, useState } from 'react'

export interface BoxPlotItem {
  key: string
  label: string
  subLabel?: string
  color: string
  values: number[]
}

export interface BoxPlotSummary {
  min: number
  q1: number
  median: number
  q3: number
  max: number
  whiskerLow: number
  whiskerHigh: number
  outliers: number[]
}

interface Props {
  items: BoxPlotItem[]
  yLabel: string
  domain?: [number, number]
  ticks?: number[]
  height?: number
  compact?: boolean
}

function medianOfSorted(sorted: number[]): number {
  if (sorted.length === 0) {
    return 0
  }

  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

export function summarizeValues(values: number[]): BoxPlotSummary | null {
  if (values.length === 0) {
    return null
  }

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const lowerHalf = sorted.slice(0, middle)
  const upperHalf =
    sorted.length % 2 === 0 ? sorted.slice(middle) : sorted.slice(middle + 1)
  const median = medianOfSorted(sorted)
  const q1 = lowerHalf.length > 0 ? medianOfSorted(lowerHalf) : sorted[0]
  const q3 = upperHalf.length > 0 ? medianOfSorted(upperHalf) : sorted[sorted.length - 1]
  const iqr = q3 - q1
  const lowerFence = q1 - 1.5 * iqr
  const upperFence = q3 + 1.5 * iqr
  const withinFence = sorted.filter((value) => value >= lowerFence && value <= upperFence)
  const outliers = sorted.filter((value) => value < lowerFence || value > upperFence)

  return {
    min: sorted[0],
    q1,
    median,
    q3,
    max: sorted[sorted.length - 1],
    whiskerLow: withinFence[0] ?? sorted[0],
    whiskerHigh: withinFence[withinFence.length - 1] ?? sorted[sorted.length - 1],
    outliers,
  }
}

function niceStep(step: number): number {
  if (step <= 0) {
    return 1
  }

  const magnitude = 10 ** Math.floor(Math.log10(step))
  const residual = step / magnitude

  if (residual <= 1) return magnitude
  if (residual <= 2) return 2 * magnitude
  if (residual <= 5) return 5 * magnitude
  return 10 * magnitude
}

function buildTicks(min: number, max: number): number[] {
  if (max <= min) {
    return [min]
  }

  const step = niceStep((max - min) / 4)
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step
  const ticks: number[] = []

  for (let value = start; value <= end + step / 2; value += step) {
    ticks.push(+value.toFixed(6))
  }

  return ticks
}

export function BoxPlotChart({
  items,
  yLabel,
  domain,
  ticks,
  height = 280,
  compact = false,
}: Props) {
  const summaries = items.map((item) => summarizeValues(item.values))
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const allValues = summaries.flatMap((summary) =>
    summary
      ? [
          summary.min,
          summary.q1,
          summary.median,
          summary.q3,
          summary.max,
          ...summary.outliers,
        ]
      : [],
  )

  if (allValues.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center text-sm italic text-gray-400">
        No data available
      </div>
    )
  }

  const [domainMin, domainMax] =
    domain ??
    (() => {
      const min = Math.min(...allValues)
      const max = Math.max(...allValues)
      const padding = max === min ? 1 : (max - min) * 0.08
      return [Math.max(0, min - padding), max + padding] as [number, number]
    })()

  const firstAvailableKey = useMemo(
    () => items.find((item, index) => summaries[index])?.key ?? null,
    [items, summaries],
  )
  const detailKey = hoveredKey ?? selectedKey ?? firstAvailableKey
  const detailIndex = detailKey ? items.findIndex((item) => item.key === detailKey) : -1
  const detailItem = detailIndex >= 0 ? items[detailIndex] : null
  const detailSummary = detailIndex >= 0 ? summaries[detailIndex] : null

  const tickValues = ticks ?? buildTicks(domainMin, domainMax)
  const width = compact ? 260 : 540
  const viewHeight = compact ? 210 : height
  const margin = compact
    ? { top: 12, right: 12, bottom: 40, left: 30 }
    : { top: 16, right: 16, bottom: 54, left: 44 }
  const plotWidth = width - margin.left - margin.right
  const plotHeight = viewHeight - margin.top - margin.bottom
  const bandWidth = plotWidth / items.length
  const boxWidth = Math.min(compact ? 24 : 36, bandWidth * 0.42)

  const yForValue = (value: number) => {
    const ratio = (value - domainMin) / (domainMax - domainMin || 1)
    return margin.top + plotHeight - ratio * plotHeight
  }

  const xForIndex = (index: number) => margin.left + bandWidth * (index + 0.5)

  const formatNumber = (value: number) => (compact ? value.toFixed(1) : value.toFixed(2))

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${viewHeight}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label="Boxplot chart"
      >
        {tickValues.map((tick) => {
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
                fontSize={compact ? 9 : 11}
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
          y1={margin.top + plotHeight}
          y2={margin.top + plotHeight}
          stroke="#cbd5e1"
        />

        {items.map((item, index) => {
          const summary = summaries[index]
          const centerX = xForIndex(index)
          const isActive = detailKey === item.key

          if (!summary) {
            return (
              <g key={item.key}>
                <text
                  x={centerX}
                  y={viewHeight - margin.bottom + 20}
                  textAnchor="middle"
                  fontSize={compact ? 10 : 11}
                  fontWeight="700"
                  fill={item.color}
                >
                  {item.label}
                </text>
              </g>
            )
          }

          const boxTop = yForValue(summary.q3)
          const boxBottom = yForValue(summary.q1)
          const medianY = yForValue(summary.median)
          const whiskerTop = yForValue(summary.whiskerHigh)
          const whiskerBottom = yForValue(summary.whiskerLow)
          const hitAreaTop = Math.min(whiskerTop, boxTop) - 10
          const hitAreaBottom = Math.max(whiskerBottom, boxBottom) + 10

          return (
            <g
              key={item.key}
              onMouseEnter={() => setHoveredKey(item.key)}
              onMouseLeave={() => setHoveredKey(null)}
              onClick={() => setSelectedKey(item.key)}
              className="cursor-pointer"
            >
              <rect
                x={centerX - Math.max(boxWidth, compact ? 24 : 28)}
                y={hitAreaTop}
                width={Math.max(boxWidth * 2, compact ? 48 : 56)}
                height={hitAreaBottom - hitAreaTop}
                fill="transparent"
              />
              <line
                x1={centerX}
                x2={centerX}
                y1={whiskerTop}
                y2={whiskerBottom}
                stroke="#475569"
                strokeWidth={isActive ? 2 : 1.5}
              />
              <line
                x1={centerX - boxWidth * 0.28}
                x2={centerX + boxWidth * 0.28}
                y1={whiskerTop}
                y2={whiskerTop}
                stroke="#475569"
                strokeWidth={isActive ? 2 : 1.5}
              />
              <line
                x1={centerX - boxWidth * 0.28}
                x2={centerX + boxWidth * 0.28}
                y1={whiskerBottom}
                y2={whiskerBottom}
                stroke="#475569"
                strokeWidth={isActive ? 2 : 1.5}
              />
              <rect
                x={centerX - boxWidth / 2}
                y={boxTop}
                width={boxWidth}
                height={Math.max(1, boxBottom - boxTop)}
                fill={item.color}
                fillOpacity={isActive ? 0.32 : 0.24}
                stroke={item.color}
                strokeWidth={isActive ? 2.5 : 2}
                rx={2}
              />
              <line
                x1={centerX - boxWidth / 2}
                x2={centerX + boxWidth / 2}
                y1={medianY}
                y2={medianY}
                stroke={item.color}
                strokeWidth={isActive ? 3 : 2.5}
              />

              {summary.outliers.map((outlier, outlierIndex) => {
                const offset = (outlierIndex - (summary.outliers.length - 1) / 2) * 8
                return (
                  <circle
                    key={`${item.key}-${outlier}-${outlierIndex}`}
                    cx={centerX + offset}
                    cy={yForValue(outlier)}
                    r={compact ? 2.5 : 3.5}
                    fill={item.color}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                )
              })}

              <text
                x={centerX}
                y={viewHeight - margin.bottom + 20}
                textAnchor="middle"
                fontSize={compact ? 10 : 11}
                fontWeight="700"
                fill={item.color}
              >
                {item.label}
              </text>
              {item.subLabel ? (
                <text
                  x={centerX}
                  y={viewHeight - margin.bottom + 34}
                  textAnchor="middle"
                  fontSize={compact ? 8 : 9}
                  fill="#6b7280"
                >
                  {item.subLabel}
                </text>
              ) : null}
            </g>
          )
        })}

        <text
          x={compact ? 12 : 16}
          y={margin.top + plotHeight / 2}
          transform={`rotate(-90 ${compact ? 12 : 16} ${margin.top + plotHeight / 2})`}
          textAnchor="middle"
          fontSize={compact ? 9 : 11}
          fill="#9ca3af"
        >
          {yLabel}
        </text>
      </svg>

      {detailItem && detailSummary ? (
        <div
          className={`mt-3 rounded border border-gray-200 bg-gray-50 ${
            compact ? 'p-2 text-[10px]' : 'p-3 text-[12px]'
          }`}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-gray-800">{detailItem.label}</span>
            {detailItem.subLabel ? <span className="text-gray-500">{detailItem.subLabel}</span> : null}
            <span className="text-gray-500">n = {detailItem.values.length}</span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-gray-600">
            <span>Min {formatNumber(detailSummary.min)}</span>
            <span>Q1 {formatNumber(detailSummary.q1)}</span>
            <span>Median {formatNumber(detailSummary.median)}</span>
            <span>Q3 {formatNumber(detailSummary.q3)}</span>
            <span>Whisker low {formatNumber(detailSummary.whiskerLow)}</span>
            <span>Whisker high {formatNumber(detailSummary.whiskerHigh)}</span>
            <span>Max {formatNumber(detailSummary.max)}</span>
            <span>
              Outliers {detailSummary.outliers.length ? detailSummary.outliers.map(formatNumber).join(', ') : 'None'}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
