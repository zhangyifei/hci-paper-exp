'use client'

import React, { useEffect, useState, useCallback } from 'react'
import StatusBar from '../shared/StatusBar'
import { logger } from '@/lib/logger'

/**
 * Background questionnaire collecting moderator variables referenced
 * in the paper (H7-H9):
 *   - Demographics (age range, gender)
 *   - Super-app familiarity  (H7, H8)
 *   - Switching intensity     (H9)
 *
 * The paper's Procedure section says:
 *   "After consenting and filling in a background questionnaire
 *    (demographics, multi-service app experience, switching frequency),
 *    they are hash-assigned to one condition…"
 */

interface BackgroundQuestionnaireProps {
  onComplete: () => void
}

interface SelectItem {
  code: string
  question: string
  options: { label: string; value: string }[]
}

const ITEMS: SelectItem[] = [
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

export default function BackgroundQuestionnaire({ onComplete }: BackgroundQuestionnaireProps) {
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [startedAt] = useState(() => performance.now())

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

  const allAnswered = Object.keys(responses).length === ITEMS.length

  const handleSubmit = () => {
    if (!allAnswered) return

    const durationMs = Math.round(performance.now() - startedAt)
    logger.trackEvent('questionnaire.completed', 'questionnaire', 'questionnaire_complete', {
      durationMs,
      payload: {
        responses,
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
            Before We Begin
          </h1>
          <p className="text-[14px] text-gray-500 leading-relaxed">
            A few quick questions about yourself and your experience with multi-service apps.
            This helps us understand different user perspectives.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-[12px] font-bold text-gray-400 mb-2">
            <span>{Object.keys(responses).length} of {ITEMS.length} answered</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-black rounded-full transition-all duration-300"
              style={{ width: `${(Object.keys(responses).length / ITEMS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Questions */}
        {ITEMS.map((item) => (
          <div key={item.code} className="mb-8">
            <div className="mb-3">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{item.code}</span>
              <p className="text-[15px] font-semibold text-black mt-1 leading-snug">{item.question}</p>
            </div>

            <div className="space-y-2">
              {item.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleAnswer(item.code, opt.value)}
                  className={`
                    w-full text-left px-4 py-3 rounded-[12px] text-[14px] font-medium
                    transition-all duration-150 active:scale-[0.98]
                    ${responses[item.code] === opt.value
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
        ))}
      </div>

      {/* Submit */}
      <div className="sticky bottom-0 w-full p-4 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-50 pb-[34px]">
        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          data-testid="btn-submit-questionnaire"
          className={`w-full h-[54px] rounded-[16px] font-bold text-[17px] shadow-lg transition-all active:scale-[0.97] flex items-center justify-center ${
            allAnswered
              ? 'bg-black text-white hover:bg-gray-900'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
          }`}
        >
          Continue to Task
        </button>
      </div>
    </div>
  )
}
