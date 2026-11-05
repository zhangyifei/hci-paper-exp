'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import ResearchPage from '../shared/ResearchPage'
import LikertScale from './LikertScale'
import { logger } from '@/lib/logger'

/**
 * Post-task survey collecting subjective measures. Item wording is based on the
 * post-task questionnaire (section B) of
 *   docs/0613/Appendix_D_SuperApp_Questionnaire_HEC_06102026.docx,
 * revised for study v2 to reduce ceiling/acquiescence (reverse-coded items) and
 * to split the manipulation checks into two constructs.
 *
 *   Cognitive Load  (CL1-CL5)      — questions 1–5
 *   Usability       (PU1-PU5)      — questions 6–10; PU5 reverse-coded
 *   Continuance     (CI1-CI4)      — questions 11–14
 *   Attention       (AC1)          — question 15; must select "Somewhat agree" (5).
 *   MC interrelated (MC1-MC4)      — questions 16–19
 *   MC heterogeneity(MC5-MC9)      — questions 20–24
 *
 * Reverse-coded items are flipped (8 - response) before construct averaging.
 * All items use a 1–7 response scale (LikertScale default points = 7).
 */

/** AC1 correct answer: "Somewhat agree" on the 1–7 scale. */
export const AC1_CODE = 'AC1'
export const AC1_CORRECT_VALUE = 5
const SURVEY_SCALE_POINTS = 7

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
  /** Place each full point label directly under its numbered response button. */
  labelsUnderOptions?: boolean
}

const SURVEY_ITEMS: SurveyItem[] = [
  // ── Cognitive Load (Raw TLX adapted, 1=Very low … 7=Very high) ─────
  {
    code: 'CL1',
    construct: 'cognitive_load',
    question: 'How much mental activity was required to complete the two tasks?',
    anchors: ['Very Low', 'Very High'],
  },
  {
    code: 'CL2',
    construct: 'cognitive_load',
    question: 'How hard did you have to work mentally to complete these two tasks?',
    anchors: ['Very Low', 'Very High'],
  },
  {
    code: 'CL3',
    construct: 'cognitive_load',
    question: 'Using this app required a lot of thinking.',
    anchors: ['Very Low', 'Very High'],
  },
  // ── Perceived Usability (SUS adapted) ─────────────────────────────
  {
    code: 'CL4',
    construct: 'cognitive_load',
    question: 'While using this app, I had to think carefully about what to do next.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'CL5',
    construct: 'cognitive_load',
    question: 'Overall, using this app was mentally demanding.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'PU1',
    construct: 'usability',
    question: 'I found this app easy to use for these consecutive tasks.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'PU2',
    construct: 'usability',
    question: 'I felt I could efficiently complete my goal using this app.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'PU3',
    construct: 'usability',
    question: 'The transition between the two services felt smooth.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'PU4',
    construct: 'usability',
    question: 'The app made it easy to continue from the first service to the second service.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'PU5',
    construct: 'usability',
    reverse: true,
    question: 'Using this app was a frustrating experience.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  // ── Continuance Intention ─────────────────────────────────────────
  {
    code: 'CI1',
    construct: 'continuance',
    question: 'I intend to continue using this app rather than discontinue its use.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'CI2',
    construct: 'continuance',
    question: 'My intentions are to continue using this app rather than use any alternative app.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'CI3',
    construct: 'continuance',
    question: 'I would choose this super app again for similar tasks.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'CI4',
    construct: 'continuance',
    question: 'I would like to continue my use of this app.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  // ── Attention Check (scored separately, excluded from constructs) ──
  {
    code: AC1_CODE,
    construct: 'attention_check',
    question: 'To show that you are reading carefully, please select "Somewhat agree" for this statement.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
    labelsUnderOptions: true,
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
  // ── Manipulation checks ──────────────────────────────────────────
  {
    code: 'MC1',
    construct: 'mc_interrelatedness',
    question: 'The app provided a direct link from the first service to the second service.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'MC2',
    construct: 'mc_interrelatedness',
    question: 'The app allowed me to go straight from the first service to the second service.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'MC3',
    construct: 'mc_interrelatedness',
    question: 'Information from the first service was automatically carried over to the second service.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'MC4',
    construct: 'mc_interrelatedness',
    question: 'The destination address from my ride booking was automatically filled in for the second service.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'MC5',
    construct: 'mc_heterogeneity',
    question: 'The two services served different purposes.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'MC6',
    construct: 'mc_heterogeneity',
    question: 'The main functions performed by the two services are different.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'MC7',
    construct: 'mc_heterogeneity',
    question: 'The two services belong to different broad service categories.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'MC8',
    construct: 'mc_heterogeneity',
    question: 'The two services follow different steps to complete their main tasks.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
  {
    code: 'MC9',
    construct: 'mc_heterogeneity',
    question: 'The two services involve different types of activities.',
    anchors: ['Strongly Disagree', 'Strongly Agree'],
  },
]

/**
 * Participant-facing pagination. Items are split across two pages with the
 * attention check (AC1) placed in the middle of page 2. Internal codes
 * (CL1, AC1, …) are never shown — only sequential numbers 1…N.
 */
const PAGE_1_CODES = ['CL1', 'CL2', 'CL3', 'CL4', 'CL5', 'PU1', 'PU2', 'PU3', 'PU4', 'PU5']
const PAGE_2_CODES = [
  'CI1', 'CI2', 'CI3', 'CI4', 'AC1',
  'MC1', 'MC2', 'MC3', 'MC4', 'MC5', 'MC6', 'MC7', 'MC8', 'MC9',
]
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
  const firstMissingOnPage = pageCodes.find((c) => responses[c] === undefined)
  const firstMissingNumber = firstMissingOnPage
    ? ORDERED_CODES.indexOf(firstMissingOnPage) + 1
    : 0

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
    const firstMissing = PAGE_1_CODES.find((code) => responses[code] === undefined)
    if (firstMissing) {
      focusCodeRef.current = firstMissing
      setShowErrors(true)
      logger.trackEvent('survey.validation_failed', 'survey', 'survey_active', {
        payload: {
          page: 1,
          firstMissing,
          answered: PAGE_1_CODES.filter((code) => responses[code] !== undefined).length,
          total: PAGE_1_CODES.length,
        },
      })
      setFocusNonce((n) => n + 1)
      return
    }

    setShowErrors(false)
    logger.trackEvent('survey.page_changed', 'survey', 'survey_active', { payload: { from: 1, to: 2 } })
    setPage(1)
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

    // Compute construct-level aggregates, excluding the attention check so it
    // never contaminates cognitive load / usability / continuance / manip checks.
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

    // Attention check: a wrong AC1 answer ends the test and invalidates the session.
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
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              data-testid="btn-submit-survey"
              className="px-8 h-[52px] rounded-[14px] bg-black text-white font-bold text-[16px] hover:bg-gray-900 active:scale-[0.98] transition-all"
            >
              Continue
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
            Please answer each question based on your experience with the tasks you just completed.
            There are no right or wrong answers.
          </p>
        </div>

        {/* Warning banner (accessible: icon + text, not colour alone) */}
        {showErrors && firstMissingOnPage && (
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
              Please answer all required questions before continuing. Question {firstMissingNumber}
              {' '}still needs an answer.
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
              points={SURVEY_SCALE_POINTS}
              anchors={item.anchors}
              pointLabels={item.pointLabels}
              labelsUnderOptions={item.labelsUnderOptions}
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
