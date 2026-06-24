'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import ResearchPage from '../shared/ResearchPage'
import { logger } from '@/lib/logger'

/**
 * Background questionnaire collecting moderator variables referenced
 * in the paper (H7-H9):
 *   - Demographics (age range, gender)
 *   - Super-app familiarity  (H7, H8)
 *   - Switching intensity     (H9)
 *
 * Also includes attention check AC2 (placed before the demographic items),
 * which must be answered "Rarely". A wrong answer ends the test and
 * invalidates the session.
 *
 * The paper's Procedure section says:
 *   "After consenting and filling in a background questionnaire
 *    (demographics, multi-service app experience, switching frequency),
 *    they are hash-assigned to one condition…"
 */

/** AC2 correct answer. */
export const AC2_CODE = 'AC2'
export const AC2_CORRECT_VALUE = 'rarely'

interface BackgroundQuestionnaireProps {
  onComplete: () => void
  onAttentionCheckFail: (code: string, expected: string, actual: string) => void
}

interface SelectItem {
  code: string
  question: string
  options: { label: string; value: string }[]
}

const ITEMS: SelectItem[] = [
  {
    code: AC2_CODE,
    question: 'To help us confirm response quality, please select "Rarely" for this question.',
    options: [
      { label: 'Never', value: 'never' },
      { label: 'Rarely', value: 'rarely' },
      { label: 'Monthly', value: 'monthly' },
      { label: 'Weekly', value: 'weekly' },
      { label: 'Daily', value: 'daily' },
    ],
  },
  {
    code: 'DEM1',
    question: 'What is your age range?',
    options: [
      { label: '18–24', value: '18-24' },
      { label: '25–34', value: '25-34' },
      { label: '35–44', value: '35-44' },
      { label: '45–54', value: '45-54' },
      { label: '55+', value: '55+' },
    ],
  },
  {
    code: 'DEM2',
    question: 'What is your gender?',
    options: [
      { label: 'Male', value: 'male' },
      { label: 'Female', value: 'female' },
      { label: 'Non-binary', value: 'non-binary' },
      { label: 'Prefer not to say', value: 'prefer-not-to-say' },
    ],
  },
  {
    code: 'FAM1',
    question: 'How often do you use multi-service (super) apps such as Grab, Gojek, WeChat, or similar?',
    options: [
      { label: 'Never', value: 'never' },
      { label: 'A few times a year', value: 'rarely' },
      { label: 'A few times a month', value: 'monthly' },
      { label: 'A few times a week', value: 'weekly' },
      { label: 'Daily', value: 'daily' },
    ],
  },
  {
    code: 'FAM2',
    question: 'How familiar are you with switching between different services (e.g. ride → food) within the same app?',
    options: [
      { label: 'Not at all familiar', value: '1' },
      { label: 'Slightly familiar', value: '2' },
      { label: 'Moderately familiar', value: '3' },
      { label: 'Very familiar', value: '4' },
      { label: 'Extremely familiar', value: '5' },
    ],
  },
  {
    code: 'SWI1',
    question: 'When using a multi-service app in a single session, how many different services do you typically use?',
    options: [
      { label: 'Just one', value: '1' },
      { label: '2 services', value: '2' },
      { label: '3 services', value: '3' },
      { label: '4 or more', value: '4+' },
    ],
  },
  {
    code: 'SWI2',
    question: 'How often do you switch between services mid-session (e.g. finish a ride, then order food without closing the app)?',
    options: [
      { label: 'Never', value: 'never' },
      { label: 'Rarely', value: 'rarely' },
      { label: 'Sometimes', value: 'sometimes' },
      { label: 'Often', value: 'often' },
      { label: 'Always', value: 'always' },
    ],
  },
]

/**
 * Participant-facing order with the attention check (AC2) placed in the middle.
 * Internal codes (AC2, DEM1, …) are never shown — only sequential numbers.
 */
const ORDERED_CODES = ['DEM1', 'DEM2', 'FAM1', AC2_CODE, 'FAM2', 'SWI1', 'SWI2']
const ITEM_BY_CODE: Record<string, SelectItem> = Object.fromEntries(ITEMS.map((i) => [i.code, i]))

export default function BackgroundQuestionnaire({ onComplete, onAttentionCheckFail }: BackgroundQuestionnaireProps) {
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [showErrors, setShowErrors] = useState(false)
  const [focusNonce, setFocusNonce] = useState(0)
  const [startedAt] = useState(() => performance.now())
  const focusCodeRef = useRef<string | null>(null)

  useEffect(() => {
    logger.trackEvent('questionnaire.started', 'questionnaire', 'questionnaire_active', {
      payload: { itemCount: ITEMS.length },
    })
  }, [])

  const handleAnswer = useCallback((code: string, value: string) => {
    setResponses((prev) => {
      const next = { ...prev, [code]: value }
      logger.trackEvent('questionnaire.item_answered', 'questionnaire', 'questionnaire_active', {
        payload: { code, value, responseSoFar: Object.keys(next).length },
      })
      return next
    })
  }, [])

  const answeredCount = Object.keys(responses).length
  const total = ORDERED_CODES.length
  const firstMissingCode = ORDERED_CODES.find((c) => responses[c] === undefined)
  const firstMissingNumber = firstMissingCode ? ORDERED_CODES.indexOf(firstMissingCode) + 1 : 0

  // After a failed submit, scroll to and focus the first unanswered question.
  useEffect(() => {
    const code = focusCodeRef.current
    if (!code) return
    const el = document.getElementById(`q-${code}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.querySelector<HTMLButtonElement>('button')?.focus()
    }
    focusCodeRef.current = null
  }, [focusNonce])

  const handleSubmit = () => {
    if (firstMissingCode) {
      setShowErrors(true)
      focusCodeRef.current = firstMissingCode
      logger.trackEvent('questionnaire.validation_failed', 'questionnaire', 'questionnaire_active', {
        payload: { firstMissing: firstMissingCode, answered: answeredCount, total },
      })
      setFocusNonce((n) => n + 1)
      return
    }

    const durationMs = Math.round(performance.now() - startedAt)
    logger.trackEvent('questionnaire.completed', 'questionnaire', 'questionnaire_complete', {
      durationMs,
      payload: { responses, durationMs },
    })

    // Attention check: a wrong AC2 answer ends the test and invalidates the session.
    const ac2 = responses[AC2_CODE]
    if (ac2 !== AC2_CORRECT_VALUE) {
      onAttentionCheckFail(AC2_CODE, AC2_CORRECT_VALUE, ac2)
      return
    }

    onComplete()
  }

  return (
    <ResearchPage
      data-testid="screen-questionnaire"
      footer={
        <button
          onClick={handleSubmit}
          data-testid="btn-submit-questionnaire"
          className="w-full h-[54px] rounded-[14px] bg-black text-white font-bold text-[16px] hover:bg-gray-900 active:scale-[0.98] transition-all"
        >
          Finish
        </button>
      }
    >
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[26px] font-bold tracking-tight text-black mb-2">A Few Last Questions</h1>
          <p className="text-[14px] text-gray-500 leading-relaxed">
            A few quick questions about yourself and your experience with multi-service apps.
            This helps us understand different user perspectives.
          </p>
        </div>

        {/* Warning banner (accessible: icon + text, not colour alone) */}
        {showErrors && firstMissingCode && (
          <div
            role="alert"
            data-testid="questionnaire-warning"
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
            <span data-testid="questionnaire-progress">{answeredCount} of {total} answered</span>
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

        {/* Questions */}
        {ORDERED_CODES.map((code) => {
          const item = ITEM_BY_CODE[code]
          const number = ORDERED_CODES.indexOf(code) + 1
          const invalid = showErrors && responses[code] === undefined
          return (
            <div
              key={code}
              id={`q-${code}`}
              className={`mb-8 scroll-mt-28 ${invalid ? 'rounded-[14px] border-2 border-red-400 bg-red-50/50 p-4' : ''}`}
            >
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white text-[12px] font-bold flex items-center justify-center">
                    {number}
                  </span>
                  {invalid && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      Answer required
                    </span>
                  )}
                </div>
                <p className="text-[15px] font-semibold text-black mt-1.5 leading-snug">{item.question}</p>
              </div>

              <div className="space-y-2">
                {item.options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleAnswer(code, opt.value)}
                    data-testid={`questionnaire-option-${code}-${opt.value}`}
                    aria-pressed={responses[code] === opt.value}
                    className={`
                      w-full text-left px-4 py-3 rounded-[12px] text-[14px] font-medium
                      transition-all duration-150 active:scale-[0.98]
                      ${responses[code] === opt.value
                        ? 'bg-black text-white shadow-md'
                        : 'bg-gray-50 text-gray-700 border border-gray-100 hover:bg-gray-100'
                      }
                    `}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </ResearchPage>
  )
}
