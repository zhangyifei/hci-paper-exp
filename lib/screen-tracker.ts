/**
 * Screen-level behavioral tracking utility.
 *
 * Captures per-screen metrics that the paper needs but the original
 * event set does not cover:
 *   - Dwell time on each screen
 *   - Time-to-first-interaction (hesitation)
 *   - Tap count per screen
 *   - Scroll depth (for list screens)
 *   - Navigation path as a sequence
 *
 * Usage: call `enterScreen(name)` on mount and the returned cleanup
 * function on unmount.  The tracker fires `screen.entered`,
 * `screen.first_interaction`, and `screen.exited` events via the
 * shared EventLogger.
 */

import { logger, type FlowType } from './logger'

interface ScreenSession {
  screen: string
  flow: FlowType
  enteredAt: number          // performance.now()
  firstInteractionAt: number | null
  tapCount: number
  maxScrollDepth: number     // 0-1 ratio
  scrollCount: number
}

let current: ScreenSession | null = null
const navigationPath: string[] = []

// ─── helpers ────────────────────────────────────────────────────────────

function onTap() {
  if (!current) return
  current.tapCount++
  if (current.firstInteractionAt === null) {
    current.firstInteractionAt = performance.now()
    const hesitationMs = Math.round(current.firstInteractionAt - current.enteredAt)
    logger.trackEvent('screen.first_interaction', current.flow, current.screen, {
      payload: {
        screen: current.screen,
        hesitationMs,
      },
    })
  }
}

function onScroll() {
  if (!current) return
  current.scrollCount++

  // Compute scroll depth as percentage (0..1) of scrollable area
  const el = document.scrollingElement ?? document.documentElement
  if (el.scrollHeight > el.clientHeight) {
    const depth = (el.scrollTop + el.clientHeight) / el.scrollHeight
    if (depth > current.maxScrollDepth) {
      current.maxScrollDepth = depth
    }
  }
}

// ─── public API ─────────────────────────────────────────────────────────

/**
 * Call when a screen mounts.  Returns a cleanup function to call on
 * unmount (fires `screen.exited` with aggregated metrics).
 */
export function enterScreen(screen: string, flow: FlowType): () => void {
  // Flush the previous screen if someone forgot to call cleanup
  if (current) {
    exitCurrentScreen()
  }

  current = {
    screen,
    flow,
    enteredAt: performance.now(),
    firstInteractionAt: null,
    tapCount: 0,
    maxScrollDepth: 0,
    scrollCount: 0,
  }

  navigationPath.push(screen)

  logger.trackEvent('screen.entered', flow, screen, {
    payload: { screen, pathIndex: navigationPath.length - 1 },
  })

  // Register listeners (passive where possible for perf)
  document.addEventListener('pointerdown', onTap, { passive: true })
  document.addEventListener('scroll', onScroll, { passive: true, capture: true })

  return () => exitCurrentScreen()
}

function exitCurrentScreen() {
  if (!current) return

  document.removeEventListener('pointerdown', onTap)
  document.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions)

  const dwellMs = Math.round(performance.now() - current.enteredAt)
  const hesitationMs = current.firstInteractionAt
    ? Math.round(current.firstInteractionAt - current.enteredAt)
    : null

  logger.trackEvent('screen.exited', current.flow, current.screen, {
    payload: {
      screen: current.screen,
      dwellMs,
      hesitationMs,
      tapCount: current.tapCount,
      maxScrollDepth: Math.round(current.maxScrollDepth * 100) / 100,
      scrollCount: current.scrollCount,
    },
  })

  current = null
}

/** Returns the full navigation path recorded so far. */
export function getNavigationPath(): string[] {
  return [...navigationPath]
}

/** Resets path tracking (call at experiment start). */
export function resetNavigationPath(): void {
  navigationPath.length = 0
}
