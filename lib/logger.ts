import type { Condition } from './experiment-config'

export type FlowType = 'ride' | 'trip_complete' | 'service2' | 'experiment' | 'survey' | 'questionnaire' | 'screen' | 'onboarding' | 'task'

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
const STORAGE_SESSION_KEY = 'hci_experiment_events_session'
const AUTO_FLUSH_BYTES = 32 * 1024

// Fetch's keepalive budget is 64 KiB across in-flight requests. Keep each
// payload comfortably below that ceiling so completion uploads cannot fail in
// the browser before reaching /api/events.
export const EVENT_UPLOAD_MAX_BYTES = 48 * 1024

export function eventUploadBody(events: ExperimentEvent[]): string {
  return JSON.stringify({ events })
}

export function eventUploadBodyBytes(events: ExperimentEvent[]): number {
  return new TextEncoder().encode(eventUploadBody(events)).byteLength
}

export function splitEventUploadChunks(
  events: ExperimentEvent[],
  maxBytes = EVENT_UPLOAD_MAX_BYTES,
): ExperimentEvent[][] {
  const chunks: ExperimentEvent[][] = []
  let current: ExperimentEvent[] = []

  for (const event of events) {
    const candidate = [...current, event]
    if (current.length > 0 && eventUploadBodyBytes(candidate) > maxBytes) {
      chunks.push(current)
      current = [event]
    } else {
      current = candidate
    }
  }

  if (current.length > 0) chunks.push(current)
  return chunks
}

class EventLogger {
  private sequenceId = 0
  private session: LoggerSession | null = null
  private unloadHandler: (() => void) | null = null
  private flushPromise: Promise<void> | null = null

  init(session: LoggerSession): void {
    this.session = session
    this.sequenceId = 0

    // Preserve unsent events when the same experiment session is re-mounted or
    // retried. Clear only when this tab starts a genuinely different session.
    if (typeof sessionStorage !== 'undefined') {
      const storedSessionId = sessionStorage.getItem(STORAGE_SESSION_KEY)
      if (storedSessionId !== session.sessionId) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify([]))
      }
      sessionStorage.setItem(STORAGE_SESSION_KEY, session.sessionId)
      const events = this.readEvents()
      this.sequenceId = events.reduce(
        (next, event) => Math.max(next, event.sequenceId + 1),
        0,
      )
    }

    // Remove any previous listener before adding a new one
    if (this.unloadHandler && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.unloadHandler)
    }

    // Safety net: if the tab closes between background flushes, send one safe
    // chunk. Keep the outbox because a same-tab reload can retry it, and event
    // IDs make a successful beacon plus a later retry idempotent.
    this.unloadHandler = () => {
      if (!this.session) return
      const events = this.readEvents()
      if (events.length === 0) return
      const chunk = splitEventUploadChunks(events)[0]
      const body = eventUploadBody(chunk)
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const queued = navigator.sendBeacon('/api/events', body)
        if (!queued) console.warn('[logger] beforeunload beacon was not queued')
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
    if (eventUploadBodyBytes(this.readEvents()) >= AUTO_FLUSH_BYTES) {
      void this.flushAndWait().catch((error: unknown) => {
        console.warn('[logger] background event upload failed:', error)
      })
    }

    return eventId
  }

  /** Upload the outbox sequentially in keepalive-safe, retryable chunks. */
  async flushAndWait(): Promise<void> {
    const activeFlush = this.flushPromise ?? this.flushQueuedEvents()
    this.flushPromise = activeFlush

    try {
      await activeFlush
    } finally {
      if (this.flushPromise === activeFlush) this.flushPromise = null
    }

    // Cover an event appended after the active flush observed an empty outbox.
    if (this.readEvents().length > 0) {
      await this.flushAndWait()
    }
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

  private async flushQueuedEvents(): Promise<void> {
    while (true) {
      const events = this.readEvents()
      if (events.length === 0) return

      const chunk = splitEventUploadChunks(events)[0]
      const body = eventUploadBody(chunk)
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: eventUploadBodyBytes(chunk) <= EVENT_UPLOAD_MAX_BYTES,
      })

      if (!response.ok) {
        throw new Error(`[logger] POST /api/events failed: ${response.status}`)
      }

      this.removeEvents(chunk.map((event) => event.eventId))
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

  private removeEvents(eventIds: string[]): void {
    if (typeof sessionStorage === 'undefined') return
    const uploaded = new Set(eventIds)
    const remaining = this.readEvents().filter((event) => !uploaded.has(event.eventId))
    if (remaining.length === 0) sessionStorage.removeItem(STORAGE_KEY)
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(remaining))
  }
}

// Singleton
export const logger = new EventLogger()
