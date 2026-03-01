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

class EventLogger {
  private queue: ExperimentEvent[] = []
  private sequenceId = 0
  private session: LoggerSession | null = null
  private flushInterval: ReturnType<typeof setInterval> | null = null
  private isFlushing = false

  init(session: LoggerSession): void {
    this.session = session
    this.sequenceId = 0
    this.queue = []

    // Flush every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flush().catch(console.error)
    }, 5000)

    // Flush on page unload via sendBeacon
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushSync()
      })
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

    this.queue.push(event)

    // Flush immediately if queue is large
    if (this.queue.length >= 10) {
      this.flush().catch(console.error)
    }

    return eventId
  }

  async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) return
    this.isFlushing = true

    const batch = [...this.queue]
    this.queue = []

    try {
      await this.sendBatch(batch)
    } catch (err) {
      // Re-queue on failure
      this.queue = [...batch, ...this.queue]
      console.error('[logger] flush failed:', err)
    } finally {
      this.isFlushing = false
    }
  }

  /** Synchronous flush via sendBeacon for page unload */
  private flushSync(): void {
    if (this.queue.length === 0) return
    const body = JSON.stringify({ events: this.queue })
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/events', body)
    }
    this.queue = []
  }

  private async sendBatch(events: ExperimentEvent[]): Promise<void> {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true,
    })
    if (!response.ok) {
      throw new Error(`[logger] POST /api/events failed: ${response.status}`)
    }
  }

  /** Flush and wait — used before Prolific redirect */
  async flushAndWait(): Promise<void> {
    await this.flush()
    // Wait for any in-flight request
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
  }
}

// Singleton
export const logger = new EventLogger()
