'use client'

import React, { useEffect, useState, useCallback } from 'react'
import StatusBar from '../shared/StatusBar'
import LikertScale from './LikertScale'
import { logger } from '@/lib/logger'

/**
 * Post-task survey collecting subjective measures. Item wording matches the
 * post-task questionnaire (section B) of:
 *   docs/0613/Appendix_D_SuperApp_Questionnaire_HEC_06102026.docx
 *
 *   Cognitive Load (CL1-CL3)  — Raw TLX adapted, 1 (Very low) – 7 (Very high)
 *   Usability      (PU1-PU4)  — SUS adapted, 1 (Strongly disagree) – 7 (Strongly agree)
 *   Continuance    (CI1-CI3)  — future-use intent
 *   Manip. Checks  (MC1-MC4)  — prompt / data carryover / service differentiation
 *   Attention      (AC1)      — must select "Somewhat agree" (value 5). Scored
 *                              separately; never mixed into the constructs above.
 *
 * All items use a 1–7 response scale (LikertScale default points = 7).
 */

/** AC1 correct answer: "Somewhat agree" on the 1–7 scale. */
export const AC1_CODE = 'AC1'
export const AC1_CORRECT_VALUE = 5

interface PostTaskSurveyProps {
  onComplete: () => void
  onAttentionCheckFail: (code: string, expected: number, actual: number) => void
}

interface SurveyItem {
  code: string
  construct: string
  question: string
  anchors: [string, string]
  /** Optional full per-point labels (rendered as a legend under the scale). */
  pointLabels?: string[]
}

const SURVEY_ITEMS: SurveyItem[] = [
  // ── Cognitive Load (Raw TLX adapted, 1=Very low … 7=Very high) ─────
  {
    code: 'CL1',
    construct: 'cognitive_load',
    question: 'How much mental activity was required to complete these tasks?',
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
    question: 'How stressed or annoyed did you feel during the tasks?',
    anchors: ['Very Low', 'Very High'],
  },
  // ── Perceived Usability (SUS adapted) ─────────────────────────────
  {
    code: 'PU1',
    construct: 'usability',
    question: 'I found this super app easy to use for these consecutive tasks.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'PU2',
    construct: 'usability',
    question: 'I felt I could efficiently complete my goal using this super app.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'PU3',
    construct: 'usability',
    question: 'The transition between the two services in the super app felt smooth.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'PU4',
    construct: 'usability',
    question: 'The super app made it easy to continue from the first service to the second service.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  // ── Continuance Intention ─────────────────────────────────────────
  {
    code: 'CI1',
    construct: 'continuance',
    question: 'I would use this super app again for similar service tasks.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'CI2',
    construct: 'continuance',
    question: 'I intend to use this super app again if I need to complete similar tasks.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'CI3',
    construct: 'continuance',
    question: 'I would choose this super app again for similar tasks.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  // ── Manipulation Checks ──────────────────────────────────────────
  {
    code: 'MC1',
    construct: 'manipulation_check',
    question: 'The super app prompted me with the next service at the right moment.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'MC2',
    construct: 'manipulation_check',
    question: 'The super app automatically carried my data into the next service.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'MC3',
    construct: 'manipulation_check',
    question: 'The second service felt different from the ride service.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'MC4',
    construct: 'manipulation_check',
    question: 'The two service tasks required different kinds of actions.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  // ── Attention Check (scored separately, excluded from constructs) ──
  {
    code: AC1_CODE,
    construct: 'attention_check',
    question: 'To show that you are reading carefully, please select "Somewhat agree" for this statement.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
    pointLabels: [
      'Strongly disagree',
      'Disagree',
      'Somewhat disagree',
      'Neither agree nor disagree',
      'Somewhat agree',
      'Agree',
      'Strongly agree',
    ],
  },
]

export default function PostTaskSurvey({ onComplete, onAttentionCheckFail }: PostTaskSurveyProps) {
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

    // Compute construct-level aggregates, excluding the attention check so it
    // never contaminates cognitive load / usability / continuance / manip checks.
    const constructs: Record<string, number[]> = {}
    for (const item of SURVEY_ITEMS) {
      if (item.construct === 'attention_check') continue
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

    // Attention check: a wrong AC1 answer ends the test and invalidates the session.
    const ac1 = responses[AC1_CODE]
    if (ac1 !== AC1_CORRECT_VALUE) {
      onAttentionCheckFail(AC1_CODE, AC1_CORRECT_VALUE, ac1)
      return
    }

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
            pointLabels={item.pointLabels}
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
