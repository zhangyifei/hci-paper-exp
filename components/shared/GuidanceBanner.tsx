'use client'

import React, { useEffect, useRef, useState } from 'react'
import { logger } from '@/lib/logger'

interface GuidanceBannerProps {
  /** Neutral reminder text (identical position across conditions). */
  text: string
  /** Idle delay before the banner first appears. */
  thresholdMs: number
  /**
   * Incremented by a parent "Help" control to re-show the banner after the
   * participant explicitly requests help (the banner otherwise appears only
   * once per task).
   */
  helpNonce?: number
}

/**
 * Non-blocking idle guidance banner.
 *
 * Appears once per task after `thresholdMs` of no interaction, in the same
 * position across all conditions, with neutral language. It is dismissible,
 * never auto-navigates, and only re-appears if the participant requests help
 * (via `helpNonce`).
 */
export default function GuidanceBanner({ text, thresholdMs, helpNonce = 0 }: GuidanceBannerProps) {
  const [visible, setVisible] = useState(false)
  const shownOnceRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstHelpRun = useRef(true)

  // Auto-show once after the idle threshold; reset on any interaction until shown.
  useEffect(() => {
    const arm = () => {
      if (shownOnceRef.current) return
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (shownOnceRef.current) return
        shownOnceRef.current = true
        setVisible(true)
        logger.trackEvent('guidance.banner_shown', 'screen', 'idle', {
          payload: { reason: 'idle', text },
        })
      }, thresholdMs)
    }

    const onActivity = () => {
      if (!shownOnceRef.current) arm()
    }

    arm()
    document.addEventListener('pointerdown', onActivity, { passive: true })
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      document.removeEventListener('pointerdown', onActivity)
    }
  }, [thresholdMs, text])

  // Re-show when the participant explicitly requests help.
  useEffect(() => {
    if (firstHelpRun.current) {
      firstHelpRun.current = false
      return
    }
    setVisible(true)
    logger.trackEvent('guidance.banner_shown', 'screen', 'idle', {
      payload: { reason: 'help', text },
    })
  }, [helpNonce, text])

  const handleDismiss = () => {
    setVisible(false)
    logger.trackEvent('guidance.banner_dismissed', 'screen', 'idle')
  }

  if (!visible) return null

  return (
    <div className="absolute left-3 right-3 bottom-[150px] z-[200] flex justify-center pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        data-testid="guidance-banner"
        className="pointer-events-none w-full flex items-start gap-3 rounded-[14px] bg-gray-900/95 text-white px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-md animate-fade-in"
      >
        <span aria-hidden className="mt-0.5 flex-shrink-0 text-[16px]">💡</span>
        <p className="flex-1 text-[13px] leading-snug font-medium">{text}</p>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss reminder"
          data-testid="guidance-banner-dismiss"
          className="pointer-events-auto flex-shrink-0 -mt-0.5 -mr-1 w-7 h-7 rounded-full flex items-center justify-center text-white/80 hover:text-white active:scale-90 transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
