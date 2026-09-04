'use client'

import React, { useEffect, useState } from 'react'
import ResearchPage from '../shared/ResearchPage'

// Give participants a moment to read the outcome before Prolific takes over.
const REDIRECT_DELAY_MS = 2500

/**
 * End-of-experiment screen with two variants:
 *   - "completed":  the participant finished the study normally.
 *   - "terminated": the participant failed an attention check; the session
 *                   was marked invalid and the test ended early.
 *
 * Both variants share one polished layout for visual consistency.
 */

interface CompletionScreenProps {
  variant: 'completed' | 'terminated'
}

export default function CompletionScreen({ variant }: CompletionScreenProps) {
  const isCompleted = variant === 'completed'
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)

  useEffect(() => {
    const pid = sessionStorage.getItem('prolific_pid') ?? ''
    const isDebug = sessionStorage.getItem('exp_debug_override') === '1'
    // Skip the redirect for debug / E2E runs that have no real Prolific participant.
    if (isDebug || !pid || pid.startsWith('anon_')) return

    const url = isCompleted
      ? process.env.NEXT_PUBLIC_PROLIFIC_COMPLETION_URL
      : process.env.NEXT_PUBLIC_PROLIFIC_FAILED_URL
    if (!url) return

    setRedirectUrl(url)
    const timer = setTimeout(() => {
      window.location.href = url
    }, REDIRECT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isCompleted])

  return (
    <ResearchPage maxWidthClassName="max-w-[520px]">
      <div
        className="flex flex-col items-center justify-center text-center py-6 animate-fade-in"
        data-testid={isCompleted ? 'screen-finished' : 'screen-terminated'}
      >
        {/* Icon badge with soft gradient ring */}
        <div className="relative mb-7">
          <div
            className={`absolute inset-0 rounded-full blur-xl opacity-60 ${
              isCompleted ? 'bg-green-200' : 'bg-gray-200'
            }`}
          />
          <div
            className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-sm ${
              isCompleted
                ? 'bg-gradient-to-br from-green-50 to-green-100 ring-1 ring-green-200'
                : 'bg-gradient-to-br from-gray-50 to-gray-100 ring-1 ring-gray-200'
            }`}
          >
            {isCompleted ? (
              <svg
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#16a34a"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6b7280"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-[28px] font-bold tracking-tight text-black mb-2.5">
          {isCompleted ? 'All Done!' : 'Test Ended'}
        </h1>

        {/* Message */}
        <p className="text-gray-500 text-[15px] leading-relaxed max-w-[320px]">
          {isCompleted
            ? 'Thank you for completing the study. Your responses have been recorded.'
            : 'Thank you for your time. Based on your responses, this session has ended and your data will not be used.'}
        </p>

        {/* Debrief note (completed only) */}
        {isCompleted && (
          <div className="mt-6 rounded-[14px] border border-gray-100 bg-gray-50 px-5 py-4 max-w-[340px]">
            <p className="text-[13px] text-gray-500 leading-relaxed">
              For your information: &ldquo;Voya X&rdquo; and the task scenarios were fictional and
              created only for research purposes. No real ride, delivery, food order, or payment
              took place.
            </p>
          </div>
        )}

        {/* Return-to-Prolific redirect, or a close hint for non-Prolific runs */}
        {redirectUrl ? (
          <div className="mt-7 flex flex-col items-center gap-2">
            <p className="text-[13px] text-gray-400 font-medium">Returning you to Prolific…</p>
            <a
              href={redirectUrl}
              className="text-[13px] font-semibold text-blue-600 underline underline-offset-2"
            >
              Click here if you are not redirected
            </a>
          </div>
        ) : (
          <p className="mt-7 text-[13px] text-gray-400 font-medium">
            You may now close this window.
          </p>
        )}
      </div>
    </ResearchPage>
  )
}
