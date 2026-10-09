'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { logger } from '@/lib/logger'
import AddressText from './AddressText'

interface GuidanceBannerProps {
  /** Neutral reminder text (identical position across conditions). */
  text: string
  /** Idle delay before the banner (re)appears. */
  thresholdMs: number
}

/**
 * Non-blocking idle guidance banner.
 *
 * Appears automatically after `thresholdMs` of no interaction, in the same
 * position across all conditions, with neutral language. It is dismissible and
 * never auto-navigates. After being dismissed it intelligently re-arms, so the
 * hint resurfaces only if the participant stalls again — staying out of the way
 * while they are actively interacting.
 */
export default function GuidanceBanner({ text, thresholdMs }: GuidanceBannerProps) {
  const [visible, setVisible] = useState(false)
  const visibleRef = useRef(false)
  const bannerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Shared re-arm function so the dismiss handler and activity listeners agree.
  const armRef = useRef<() => void>(() => {})

  useEffect(() => {
    const show = () => {
      if (visibleRef.current) return
      visibleRef.current = true
      setVisible(true)
      logger.trackEvent('guidance.banner_shown', 'screen', 'idle', {
        payload: { reason: 'idle', text },
      })
    }

    const arm = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(show, thresholdMs)
    }
    armRef.current = arm

    // Any interaction resets the idle countdown — but only while hidden, so an
    // already-visible hint stays put until the participant dismisses it.
    const onActivity = () => {
      if (visibleRef.current) return
      arm()
    }

    arm()
    document.addEventListener('pointerdown', onActivity, { passive: true })
    document.addEventListener('keydown', onActivity)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      document.removeEventListener('pointerdown', onActivity)
      document.removeEventListener('keydown', onActivity)
    }
  }, [thresholdMs, text])

  const dismiss = useCallback((method: 'close_button' | 'outside_click') => {
    visibleRef.current = false
    setVisible(false)
    logger.trackEvent('guidance.banner_dismissed', 'screen', 'idle', {
      payload: { method },
    })
    // Re-arm so the hint can resurface after another idle period.
    armRef.current()
  }, [])

  useEffect(() => {
    if (!visible) return

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node) || bannerRef.current?.contains(target)) return
      dismiss('outside_click')
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown, true)
    }
  }, [dismiss, visible])

  if (!visible) return null

  return (
    <div className="absolute left-3 right-3 bottom-[0.8cm] z-[200] flex justify-center pointer-events-none">
      <div
        ref={bannerRef}
        role="status"
        aria-live="polite"
        data-testid="guidance-banner"
        className="pointer-events-auto w-full flex items-start gap-3 rounded-[14px] bg-gray-900/95 text-white px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-md animate-fade-in"
      >
        <span aria-hidden className="mt-0.5 flex-shrink-0 text-[16px]">💡</span>
        <p className="flex-1 text-[13px] leading-snug font-medium">
          <AddressText>{text}</AddressText>
        </p>
        <button
          type="button"
          onClick={() => dismiss('close_button')}
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
