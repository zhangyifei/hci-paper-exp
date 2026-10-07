'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import ResearchPage from '../shared/ResearchPage'
import LikertScale from './LikertScale'
import { logger } from '@/lib/logger'

/**
 * Post-task survey. Item wording, order and scale anchors are VERBATIM from
 * section C of the Appendix D questionnaire (Manipulation Checks_2026-10-06.docx).
 * Do not rephrase.
 *
 *   Cognitive Load  (CL1-CL3)          — 1 (Very low / Not at all) – 7 (Very high / Very much)
 *   Usability       (PU1,PU2,PU7,PU4)  — PU7 is a new code so old reverse-coded PU3 data is never mis-scored
 *   Continuance     (CI1,CI3,CI2)      — codes kept by meaning (use / choose / intend), shown in doc order
 *   MC interrelated (MC1,MC2,MC5)      — MC5 reverse-coded
 *   MC heterogeneity(MC3,MC4,MC6)      — MC6 reverse-coded
 *   Attention       (AC1)              — NOT a doc item; must select "Somewhat agree" (5); scored separately.
 *
 * Reverse-coded items are flipped (8 - response) before construct averaging.
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
  /** Reverse-coded item: scored as (8 - response) before averaging. */
  reverse?: boolean
  question: string
  anchors: [string, string]
  /** Optional full per-point labels (rendered as a legend under the scale). */
  pointLabels?: string[]
}

const CL_ANCHORS: [string, string] = ['Very low / Not at all', 'Very high / Very much']
const AGREE_ANCHORS: [string, string] = ['Strongly disagree', 'Strongly agree']

const SURVEY_ITEMS: SurveyItem[] = [
  // ── Cognitive load ────────────────────────────────────────────────
  {
    code: 'CL1',
    construct: 'cognitive_load',
    question: 'How much mental activity was required to complete this task?',
    anchors: CL_ANCHORS,
  },
  {
    code: 'CL2',
    construct: 'cognitive_load',
    question: 'How hard did you have to work mentally to reach your performance?',
    anchors: CL_ANCHORS,
  },
  {
    code: 'CL3',
    construct: 'cognitive_load',
    question: 'How stressed or annoyed did you feel during the task?',
    anchors: CL_ANCHORS,
  },
  // ── Perceived usability ───────────────────────────────────────────
  {
    code: 'PU1',
    construct: 'usability',
    question: 'I found this system easy to use for these consecutive tasks.',
    anchors: AGREE_ANCHORS,
  },
  {
    code: 'PU2',
    construct: 'usability',
    question: 'I felt I could efficiently complete my goal using this system.',
    anchors: AGREE_ANCHORS,
  },
  {
    code: 'PU7',
    construct: 'usability',
    question: 'The transition between the two services felt smooth.',
    anchors: AGREE_ANCHORS,
  },
  {
    code: 'PU4',
    construct: 'usability',
    question: 'The app made it easy to continue from the first service to the second service.',
    anchors: AGREE_ANCHORS,
  },
  // ── Continuance intention ─────────────────────────────────────────
  {
    code: 'CI1',
    construct: 'continuance',
    question: 'I would use this system again for similar cross-service tasks.',
    anchors: AGREE_ANCHORS,
  },
  {
    code: 'CI3',
    construct: 'continuance',
    question: 'I would choose this app again when I need to move between related services.',
    anchors: AGREE_ANCHORS,
  },
  {
    code: 'CI2',
    construct: 'continuance',
    question: 'I intend to continue using this app if similar services are available.',
    anchors: AGREE_ANCHORS,
  },
  // ── Manipulation check: interrelatedness ─────────────────────────
  {
    code: 'MC1',
    construct: 'mc_interrelatedness',
    question: 'The system prompted me with the next service at the right moment.',
    anchors: AGREE_ANCHORS,
  },
  {
    code: 'MC2',
    construct: 'mc_interrelatedness',
    question: 'The system automatically carried my data into the next service.',
    anchors: AGREE_ANCHORS,
  },
  {
    code: 'MC5',
    construct: 'mc_interrelatedness',
    reverse: true,
    question: 'I had to enter my address again from scratch for the second service.',
    anchors: AGREE_ANCHORS,
  },
  // ── Manipulation check: heterogeneity ────────────────────────────
  {
    code: 'MC3',
    construct: 'mc_heterogeneity',
    question: 'The second service felt different from the ride service.',
    anchors: AGREE_ANCHORS,
  },
  {
    code: 'MC4',
    construct: 'mc_heterogeneity',
    question: 'The two service tasks required different kinds of actions.',
    anchors: AGREE_ANCHORS,
  },
  {
    code: 'MC6',
    construct: 'mc_heterogeneity',
    reverse: true,
    question: 'The two services felt like basically the same kind of activity.',
    anchors: AGREE_ANCHORS,
  },
  // ── Attention check (scored separately, excluded from constructs) ──
  {
    code: AC1_CODE,
    construct: 'attention_check',
    question: 'To show that you are reading carefully, please select "Somewhat agree" for this statement.',
    anchors: AGREE_ANCHORS,
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

/**
 * Participant-facing pagination, in doc order, with AC1 between the CI and MC
 * blocks on page 2 (as in the previous version). Internal codes are never
 * shown — only sequential numbers 1…N.
 */
const PAGE_1_CODES = ['CL1', 'CL2', 'CL3', 'PU1', 'PU2', 'PU7', 'PU4']
const PAGE_2_CODES = ['CI1', 'CI3', 'CI2', 'AC1', 'MC1', 'MC2', 'MC5', 'MC3', 'MC4', 'MC6']
const ORDERED_CODES = [...PAGE_1_CODES, ...PAGE_2_CODES]
const ITEM_BY_CODE: Record<string, SurveyItem> = Object.fromEntries(
  SURVEY_ITEMS.map((i) => [i.code, i]),
)

export default function PostTaskSurvey({ onComplete, onAttentionCheckFail }: PostTaskSurveyProps) {
  const [responses, setResponses] = useState<Record<string, number>>({})
  const [page, setPage] = useState(0)
  const [showErrors, setShowErrors] = useState(false)
  const [focusNonce, setFocusNonce] = useState(0)
  const [startedAt] = useState(() => performance.now())
  const focusCodeRef = useRef<string | null>(null)

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

  const answeredCount = Object.keys(responses).length
  const total = ORDERED_CODES.length
  const pageCodes = page === 0 ? PAGE_1_CODES : PAGE_2_CODES

  const firstMissingCode = ORDERED_CODES.find((c) => responses[c] === undefined)
  const firstMissingNumber = firstMissingCode ? ORDERED_CODES.indexOf(firstMissingCode) + 1 : 0

  // After a failed submit (or page switch toward a missing item), scroll to and
  // focus the first unanswered question.
  useEffect(() => {
    const code = focusCodeRef.current
    if (!code) return
    const el = document.getElementById(`item-${code}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.querySelector<HTMLButtonElement>('[role="radio"]')?.focus()
    }
    focusCodeRef.current = null
  }, [focusNonce, page])

  const goToFirstMissing = () => {
    if (!firstMissingCode) return
    const targetPage = PAGE_1_CODES.includes(firstMissingCode) ? 0 : 1
    focusCodeRef.current = firstMissingCode
    setShowErrors(true)
    if (targetPage !== page) setPage(targetPage)
    setFocusNonce((n) => n + 1)
  }

  const handleContinue = () => {
    logger.trackEvent('survey.page_changed', 'survey', 'survey_active', { payload: { from: 1, to: 2 } })
    setPage(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBack = () => {
    logger.trackEvent('survey.page_changed', 'survey', 'survey_active', { payload: { from: 2, to: 1 } })
    setPage(0)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = () => {
    if (firstMissingCode) {
      logger.trackEvent('survey.validation_failed', 'survey', 'survey_active', {
        payload: { firstMissing: firstMissingCode, answered: answeredCount, total },
      })
      goToFirstMissing()
      return
    }

    const durationMs = Math.round(performance.now() - startedAt)

    const constructs: Record<string, number[]> = {}
    for (const item of SURVEY_ITEMS) {
      if (item.construct === 'attention_check') continue
      if (!constructs[item.construct]) constructs[item.construct] = []
      // 7-point scale: reverse-coded items are flipped before averaging.
      constructs[item.construct].push(item.reverse ? 8 - responses[item.code] : responses[item.code])
    }
    const aggregates: Record<string, number> = {}
    for (const [key, values] of Object.entries(constructs)) {
      aggregates[`${key}_mean`] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
    }

    logger.trackEvent('survey.completed', 'survey', 'survey_complete', {
      durationMs,
      payload: { responses, aggregates, durationMs },
    })

    // A wrong AC1 answer ends the test and invalidates the session.
    const ac1 = responses[AC1_CODE]
    if (ac1 !== AC1_CORRECT_VALUE) {
      onAttentionCheckFail(AC1_CODE, AC1_CORRECT_VALUE, ac1)
      return
    }

    onComplete()
  }

  return (
    <ResearchPage
      data-testid="screen-survey"
      footer={
        page === 0 ? (
          <div className="flex justify-end">
            <button
              onClick={handleContinue}
              data-testid="btn-survey-continue"
              className="px-8 h-[52px] rounded-[14px] bg-black text-white font-bold text-[16px] hover:bg-gray-900 active:scale-[0.98] transition-all"
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handleBack}
              data-testid="btn-survey-back"
              className="px-6 h-[52px] rounded-[14px] border border-gray-200 bg-white text-black font-bold text-[16px] hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              data-testid="btn-submit-survey"
              className="flex-1 h-[52px] rounded-[14px] bg-black text-white font-bold text-[16px] hover:bg-gray-900 active:scale-[0.98] transition-all"
            >
              Submit Feedback
            </button>
          </div>
        )
      }
    >
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[26px] font-bold tracking-tight text-black mb-2">Quick Feedback</h1>
          <p className="text-[14px] text-gray-500 leading-relaxed">
            Please answer the following questions based on the task you just completed.
          </p>
        </div>

        {/* Warning banner (accessible: icon + text, not colour alone) */}
        {showErrors && firstMissingCode && (
          <div
            role="alert"
            data-testid="survey-warning"
            className="sticky top-2 z-20 mb-5 flex items-start gap-2.5 rounded-[12px] border-2 border-red-300 bg-red-50 px-4 py-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" className="mt-0.5 flex-shrink-0" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-[13.5px] font-semibold text-red-700 leading-snug">
              Please answer all required questions before submitting. Question {firstMissingNumber} still needs an answer.
            </p>
          </div>
        )}

        {/* Progress */}
        <div className="mb-7">
          <div className="flex justify-between text-[12px] font-bold text-gray-500 mb-2">
            <span data-testid="survey-page-indicator">Page {page + 1} of 3</span>
          </div>
          <div
            className="h-2 bg-gray-100 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={answeredCount}
            aria-valuemin={0}
            aria-valuemax={total}
          >
            <div
              className="h-full bg-black rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Items for the current page */}
        {pageCodes.map((code) => {
          const item = ITEM_BY_CODE[code]
          const number = ORDERED_CODES.indexOf(code) + 1
          return (
            <LikertScale
              key={code}
              code={code}
              fieldId={`item-${code}`}
              displayNumber={number}
              hideCode
              question={item.question}
              anchors={item.anchors}
              pointLabels={item.pointLabels}
              value={responses[code]}
              invalid={showErrors && responses[code] === undefined}
              onAnswer={(v) => handleAnswer(code, item.construct, v)}
            />
          )
        })}
      </div>
    </ResearchPage>
  )
}
