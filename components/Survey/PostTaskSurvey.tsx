'use client'

import React, { useEffect, useState, useCallback } from 'react'
import StatusBar from '../shared/StatusBar'
import LikertScale from './LikertScale'
import { logger } from '@/lib/logger'

/**
 * Post-task survey collecting subjective measures aligned with the paper's
 * Table 2 (Planned Measurement Items for Subjective Constructs):
 *
 *   Cognitive Load (CL1-CL3)  — Raw TLX adapted
 *   Usability      (PU1-PU2)  — SUS adapted
 *   Continuance    (CI1-CI2)  — willingness-to-return
 *   Manip. Checks  (MC1-MC2)  — interrelatedness perception
 */

interface PostTaskSurveyProps {
  onComplete: () => void
}

interface SurveyItem {
  code: string
  construct: string
  question: string
  anchors: [string, string]
}

const SURVEY_ITEMS: SurveyItem[] = [
  // ── Cognitive Load (Raw TLX adapted) ──────────────────────────────
  {
    code: 'CL1',
    construct: 'cognitive_load',
    question: 'How much mental activity was required to complete this task?',
    anchors: ['Very Low', 'Very High'],
  },
  {
    code: 'CL2',
    construct: 'cognitive_load',
    question: 'How hard did you have to work mentally to reach your performance?',
    anchors: ['Very Low', 'Very High'],
  },
  {
    code: 'CL3',
    construct: 'cognitive_load',
    question: 'How stressed or annoyed did you feel during the task?',
    anchors: ['Very Low', 'Very High'],
  },
  // ── Usability (SUS adapted) ───────────────────────────────────────
  {
    code: 'PU1',
    construct: 'usability',
    question: 'I found this system easy to use for these consecutive tasks.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'PU2',
    construct: 'usability',
    question: 'I felt I could efficiently complete my goal using this system.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  // ── Continuance Intention ─────────────────────────────────────────
  {
    code: 'CI1',
    construct: 'continuance',
    question: 'I would use this app again for multiple services in a single session.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'CI2',
    construct: 'continuance',
    question: 'I would recommend this app to others who need multiple services.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  // ── Manipulation Checks ──────────────────────────────────────────
  {
    code: 'MC1',
    construct: 'manipulation_check',
    question: 'The system prompted me with the next service at the right moment.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'MC2',
    construct: 'manipulation_check',
    question: 'The system automatically carried my data into the next service.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
]

export default function PostTaskSurvey({ onComplete }: PostTaskSurveyProps) {
  const [responses, setResponses] = useState<Record<string, number>>({})
  const [startedAt] = useState(() => performance.now())

  useEffect(() => {
    logger.trackEvent('survey.started', 'survey', 'survey_active', {
      payload: { itemCount: SURVEY_ITEMS.length },
    })
  }, [])

  const handleAnswer = useCallback((code: string, construct: string, value: number) => {
    setResponses((prev) => {
      const next = { ...prev, [code]: value }
      logger.trackEvent('survey.item_answered', 'survey', 'survey_active', {
        payload: { code, construct, value, responseSoFar: Object.keys(next).length },
      })
      return next
    })
  }, [])

  const allAnswered = Object.keys(responses).length === SURVEY_ITEMS.length

  const handleSubmit = () => {
    if (!allAnswered) return

    const durationMs = Math.round(performance.now() - startedAt)

    // Compute construct-level aggregates
    const constructs: Record<string, number[]> = {}
    for (const item of SURVEY_ITEMS) {
      if (!constructs[item.construct]) constructs[item.construct] = []
      constructs[item.construct].push(responses[item.code])
    }
    const aggregates: Record<string, number> = {}
    for (const [key, values] of Object.entries(constructs)) {
      aggregates[`${key}_mean`] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
    }

    logger.trackEvent('survey.completed', 'survey', 'survey_complete', {
      durationMs,
      payload: {
        responses,
        aggregates,
        durationMs,
      },
    })

    onComplete()
  }

  return (
    <div className="relative w-full min-h-full bg-white flex flex-col animate-fade-in">
      <StatusBar />

      <div className="flex-1 overflow-y-auto px-5 pt-[72px] pb-8 no-scrollbar">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[24px] font-bold tracking-tight text-black mb-2">
            Quick Feedback
          </h1>
          <p className="text-[14px] text-gray-500 leading-relaxed">
            Please answer each question based on your experience with the tasks you just completed.
            There are no right or wrong answers.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-[12px] font-bold text-gray-400 mb-2">
            <span>{Object.keys(responses).length} of {SURVEY_ITEMS.length} answered</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-black rounded-full transition-all duration-300"
              style={{ width: `${(Object.keys(responses).length / SURVEY_ITEMS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Items */}
        {SURVEY_ITEMS.map((item) => (
          <LikertScale
            key={item.code}
            code={item.code}
            question={item.question}
            anchors={item.anchors}
            value={responses[item.code]}
            onAnswer={(v) => handleAnswer(item.code, item.construct, v)}
          />
        ))}
      </div>

      {/* Submit */}
      <div className="sticky bottom-0 w-full p-4 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-50 pb-[34px]">
        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          data-testid="btn-submit-survey"
          className={`w-full h-[54px] rounded-[16px] font-bold text-[17px] shadow-lg transition-all active:scale-[0.97] flex items-center justify-center ${
            allAnswered
              ? 'bg-black text-white hover:bg-gray-900'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
          }`}
        >
          Submit Feedback
        </button>
      </div>
    </div>
  )
}
