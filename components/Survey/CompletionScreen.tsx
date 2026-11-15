'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import ResearchPage from '../shared/ResearchPage'
import { logger } from '@/lib/logger'

// Give participants a moment to read the outcome before Prolific takes over.
const REDIRECT_DELAY_MS = 2500
const COMPLETION_CHECK_ATTEMPTS = 4

interface CompletionResult {
  outcome: 'valid' | 'failed' | 'incomplete'
  url: string | null
  code: string | null
  prolificCompleted?: boolean
}

const wait = (delayMs: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, delayMs))

/**
 * End-of-experiment screen with two variants:
 *   - "completed":  the participant finished the study normally.
 *   - "terminated": the participant failed an attention check; the session
 *                   was marked invalid and the test ended early.
 *   - "timed_out":  the participant exceeded the 30-minute study limit.
 *
 * Both variants share one polished layout for visual consistency.
 */

interface CompletionScreenProps {
  variant: 'completed' | 'terminated' | 'timed_out'
}

export default function CompletionScreen({ variant }: CompletionScreenProps) {
  const isCompleted = variant === 'completed'
  const isTimedOut = variant === 'timed_out'
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)
  const [completionCode, setCompletionCode] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [prolificRun, setProlificRun] = useState<boolean | null>(null)
  const [verificationError, setVerificationError] = useState(false)
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const verifyCompletion = useCallback(async () => {
    const pid = sessionStorage.getItem('prolific_pid') ?? ''
    const isDebug = sessionStorage.getItem('exp_debug_override') === '1'
    const isRealProlificRun = !isDebug && Boolean(pid) && !pid.startsWith('anon_')
    setProlificRun(isRealProlificRun)
    if (!isRealProlificRun) return

    const sessionId = sessionStorage.getItem('exp_session_id') ?? ''
    if (!sessionId) {
      setVerificationError(true)
      return
    }

    setChecking(true)
    setVerificationError(false)
    for (let attempt = 0; attempt < COMPLETION_CHECK_ATTEMPTS; attempt += 1) {
      try {
        // If the final upload failed transiently, retry it before asking the
        // server to validate the completion trail and complete Prolific.
        await logger.flushAndWait()
        const res = await fetch('/api/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        if (!res.ok) throw new Error(`Completion check failed: ${res.status}`)
        const data = (await res.json()) as CompletionResult
        if (data.url) {
          setRedirectUrl(data.url)
          setCompletionCode(data.code)
          setChecking(false)
          if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
          redirectTimerRef.current = setTimeout(() => {
            window.location.href = data.url as string
          }, REDIRECT_DELAY_MS)
          return
        }
      } catch {
        // Retry below. Pending events remain in sessionStorage until uploaded.
      }

      if (attempt < COMPLETION_CHECK_ATTEMPTS - 1) {
        await wait(750 * (attempt + 1))
      }
    }

    setChecking(false)
    setVerificationError(true)
  }, [])

  useEffect(() => {
    void verifyCompletion()
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    }
  }, [verifyCompletion])

  return (
    <ResearchPage maxWidthClassName="max-w-[520px]">
      <div
        className="flex flex-col items-center justify-center text-center py-6 animate-fade-in"
        data-testid={
          isCompleted ? 'screen-finished' : isTimedOut ? 'screen-timed-out' : 'screen-terminated'
        }
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
          {isCompleted ? 'All Done!' : isTimedOut ? 'Session Timed Out' : 'Test Ended'}
        </h1>

        {/* Message */}
        <p className="text-gray-500 text-[15px] leading-relaxed max-w-[320px]">
          {isCompleted
            ? 'Thank you for completing the study. Your responses have been recorded.'
            : isTimedOut
              ? 'The 30-minute study limit has passed. This session is incomplete, and your responses will not be included in the study analysis.'
              : 'You have failed the attention check. Thank you for your time. Based on your responses, this session has ended and your data will not be used.'}
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

        {/* Return-to-Prolific redirect with a visible, copyable fallback code. */}
        {redirectUrl ? (
          <div className="mt-7 flex w-full max-w-[340px] flex-col items-center gap-3">
            {completionCode && (
              <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-[12px] font-medium text-gray-500">Completion code</p>
                <p className="mt-1 select-all font-mono text-[18px] font-bold tracking-wider text-black">
                  {completionCode}
                </p>
              </div>
            )}
            <a
              href={redirectUrl}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-black px-4 text-sm font-bold text-white"
            >
              Return to Prolific
            </a>
            <p className="text-[12px] font-medium text-gray-400">
              Redirecting automatically… Use the button or code above if needed.
            </p>
          </div>
        ) : prolificRun && checking ? (
          <p className="mt-7 text-[13px] text-gray-500 font-medium">
            Saving your responses and confirming completion…
          </p>
        ) : prolificRun && verificationError ? (
          <div className="mt-7 flex w-full max-w-[340px] flex-col items-center gap-3">
            <p className="text-[13px] leading-relaxed text-gray-500">
              We could not confirm your completion yet. Please keep this page open and try again.
            </p>
            <button
              type="button"
              onClick={() => void verifyCompletion()}
              className="h-11 w-full rounded-xl bg-black px-4 text-sm font-bold text-white"
            >
              Try again
            </button>
          </div>
        ) : prolificRun === false ? (
          <p className="mt-7 text-[13px] text-gray-400 font-medium">
            You may now close this window.
          </p>
        ) : null}
      </div>
    </ResearchPage>
  )
}
