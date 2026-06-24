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
  /** Sequential participant-facing number (1, 2, 3 …). */
  displayNumber?: number
  /** Hide the internal research code and show the display number instead. */
  hideCode?: boolean
  /** Highlight as unanswered after a failed submit (accessible, not colour-only). */
  invalid?: boolean
  /** DOM id used to scroll to / focus this item. */
  fieldId?: string
}

export default function LikertScale({
  code,
  question,
  points = 7,
  anchors = ['Very Low', 'Very High'],
  pointLabels,
  onAnswer,
  value,
  displayNumber,
  hideCode = false,
  invalid = false,
  fieldId,
}: LikertScaleProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div
      id={fieldId}
      data-testid={`survey-item-${code}`}
      className={`mb-8 scroll-mt-28 transition-colors ${
        invalid ? 'rounded-[14px] border-2 border-red-400 bg-red-50/50 p-4' : ''
      }`}
    >
      {/* Number / code + Question */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          {hideCode ? (
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white text-[12px] font-bold flex items-center justify-center">
              {displayNumber}
            </span>
          ) : (
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{code}</span>
          )}
          {invalid && (
            <span
              data-testid="required-flag"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Answer required
            </span>
          )}
        </div>
        <p className="text-[15px] font-semibold text-black mt-1.5 leading-snug">{question}</p>
      </div>

      {/* Scale */}
      <div
        className="flex items-center justify-between gap-2"
        role="radiogroup"
        aria-label={hideCode ? `Question ${displayNumber}` : code}
      >
        {Array.from({ length: points }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
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
