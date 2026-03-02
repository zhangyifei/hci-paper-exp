import type { Condition } from './experiment-config'

export type FlowType = 'ride' | 'trip_complete' | 'service2' | 'experiment'

export interface ExperimentEvent {
  eventName: string
  eventId: string
  sessionId: string
  participantId: string
  sequenceId: number
  flow: FlowType
  state: string
  timestamp: number
  clientMonoMs: number
  durationMs?: number
  parentEventId?: string
  payload?: Record<string, unknown>
  error?: string
  condition: Condition
  prolificStudyId?: string
  prolificSessionId?: string
}

interface LoggerSession {
  sessionId: string
  participantId: string
  condition: Condition
  prolificStudyId?: string
  prolificSessionId?: string
}

const STORAGE_KEY = 'hci_experiment_events'

class EventLogger {
  private sequenceId = 0
  private session: LoggerSession | null = null
  private unloadHandler: (() => void) | null = null

  init(session: LoggerSession): void {
    this.session = session
    this.sequenceId = 0

    // Start fresh in sessionStorage for this session
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([]))
    }

    // Remove any previous listener before adding a new one
    if (this.unloadHandler && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.unloadHandler)
    }

    // Safety net: if user closes the tab, send everything accumulated so far.
    // After a successful send, sessionStorage is cleared, so this is a no-op
    // if flushAndWait() already completed.
    this.unloadHandler = () => {
      if (!this.session) return
      const events = this.readEvents()
      if (events.length === 0) return
      const body = JSON.stringify({ events })
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/events', body)
        this.clearEvents()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.unloadHandler)
    }
  }

  trackEvent(
    eventName: string,
    flow: FlowType,
    state: string,
    extras?: Partial<
      Pick<ExperimentEvent, 'durationMs' | 'parentEventId' | 'payload' | 'error'>
    >
  ): string {
    if (!this.session) {
      console.warn('[logger] trackEvent called before init()')
      return ''
    }

    const eventId = crypto.randomUUID()
    const event: ExperimentEvent = {
      eventName,
      eventId,
      sessionId: this.session.sessionId,
      participantId: this.session.participantId,
      sequenceId: this.sequenceId++,
      flow,
      state,
      timestamp: Date.now(),
      clientMonoMs: typeof performance !== 'undefined' ? performance.now() : 0,
      condition: this.session.condition,
      prolificStudyId: this.session.prolificStudyId,
      prolificSessionId: this.session.prolificSessionId,
      ...extras,
    }

    this.appendEvent(event)

    return eventId
  }

  /** Send all accumulated events to the server in a single request. */
  async flushAndWait(): Promise<void> {
    const events = this.readEvents()
    if (events.length === 0) return

    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true,
    })

    if (!response.ok) {
      throw new Error(`[logger] POST /api/events failed: ${response.status}`)
    }

    // Clear storage after successful send so beforeunload won't resend
    this.clearEvents()
  }

  destroy(): void {
    if (this.unloadHandler && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.unloadHandler)
      this.unloadHandler = null
    }
  }

  private appendEvent(event: ExperimentEvent): void {
    const events = this.readEvents()
    events.push(event)
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events))
    }
  }

  private readEvents(): ExperimentEvent[] {
    if (typeof sessionStorage === 'undefined') return []
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      return JSON.parse(raw) as ExperimentEvent[]
    } catch {
      return []
    }
  }

  private clearEvents(): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }
}

// Singleton
export const logger = new EventLogger()
