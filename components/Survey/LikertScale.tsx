'use client'

import React, { useState } from 'react'

interface LikertScaleProps {
  /** Item code shown above the question (e.g. "CL1") */
  code: string
  /** Full question text */
  question: string
  /** Number of points on the scale (default 7) */
  points?: number
  /** Labels for scale anchors [low, high] */
  anchors?: [string, string]
  /**
   * Optional full label for every point (length should equal `points`).
   * When provided, a numbered legend is rendered below the scale so the
   * participant knows exactly what each number means (e.g. 5 = Somewhat agree).
   */
  pointLabels?: string[]
  /** Called with the selected value (1-based) */
  onAnswer: (value: number) => void
  /** Currently selected value (controlled) */
  value?: number
}

export default function LikertScale({
  code,
  question,
  points = 7,
  anchors = ['Very Low', 'Very High'],
  pointLabels,
  onAnswer,
  value,
}: LikertScaleProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div className="mb-8">
      {/* Code + Question */}
      <div className="mb-4">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{code}</span>
        <p className="text-[15px] font-semibold text-black mt-1 leading-snug">{question}</p>
      </div>

      {/* Scale */}
      <div className="flex items-center justify-between gap-2">
        {Array.from({ length: points }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            data-testid={`likert-${code}-${n}`}
            onClick={() => onAnswer(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            className={`
              w-10 h-10 rounded-full text-[14px] font-bold transition-all duration-150
              flex items-center justify-center flex-shrink-0
              ${value === n
                ? 'bg-black text-white shadow-md scale-110'
                : hovered === n
                  ? 'bg-gray-200 text-black'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }
              active:scale-95
            `}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Anchors */}
      <div className="flex justify-between mt-2 px-1">
        <span className="text-[11px] text-gray-400 font-medium">{anchors[0]}</span>
        <span className="text-[11px] text-gray-400 font-medium">{anchors[1]}</span>
      </div>

      {/* Optional full numeric legend (e.g. for attention checks) */}
      {pointLabels && pointLabels.length === points && (
        <div className="mt-3 rounded-[10px] bg-gray-50 border border-gray-100 px-3 py-2.5">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {pointLabels.map((label, i) => (
              <span key={i} className="text-[11px] text-gray-500 leading-snug">
                <span className="font-bold text-gray-800">{i + 1}</span> = {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
