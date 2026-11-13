export const RAPID_RESPONSE_THRESHOLD_MS = 1_000
export const RAPID_RESPONSE_RATIO_THRESHOLD = 0.8

const MIN_SCALE_RESPONSES_FOR_STRAIGHTLINING = 20
const MIN_TIMED_RESPONSES_FOR_RAPID_FLAG = 20

export type DataQualityReason = 'straightlining' | 'rapid_responses'

export interface ResponseTiming {
  firstResponse: boolean
  responseTimeMs: number
}

export interface DataQualityAssessment {
  flagged: boolean
  reasons: DataQualityReason[]
  metrics: {
    scaleResponseCount: number
    distinctScaleValues: number
    timedResponseCount: number
    rapidResponseCount: number
    rapidResponseRatio: number
    rapidResponseThresholdMs: number
    rapidResponseRatioThreshold: number
  }
}

class DataQualityTracker {
  private scaleResponses = new Map<string, number>()
  private firstResponseTimes = new Map<string, number>()
  private lastInteractionAt: number | null = null

  reset(): void {
    this.scaleResponses.clear()
    this.firstResponseTimes.clear()
    this.lastInteractionAt = null
  }

  startPage(now: number): void {
    this.lastInteractionAt = now
  }

  recordResponse(
    code: string,
    value: string | number,
    now: number,
    includeInStraightlining: boolean,
  ): ResponseTiming {
    const responseTimeMs = Math.max(0, Math.round(now - (this.lastInteractionAt ?? now)))
    const firstResponse = !this.firstResponseTimes.has(code)

    if (firstResponse) {
      this.firstResponseTimes.set(code, responseTimeMs)
    }
    if (includeInStraightlining && typeof value === 'number') {
      this.scaleResponses.set(code, value)
    }

    this.lastInteractionAt = now
    return { firstResponse, responseTimeMs }
  }

  assess(): DataQualityAssessment {
    const scaleValues = [...this.scaleResponses.values()]
    const distinctScaleValues = new Set(scaleValues).size
    const timings = [...this.firstResponseTimes.values()]
    const rapidResponseCount = timings.filter(
      (duration) => duration < RAPID_RESPONSE_THRESHOLD_MS,
    ).length
    const rapidResponseRatio = timings.length > 0 ? rapidResponseCount / timings.length : 0

    const reasons: DataQualityReason[] = []
    if (
      scaleValues.length >= MIN_SCALE_RESPONSES_FOR_STRAIGHTLINING &&
      distinctScaleValues === 1
    ) {
      reasons.push('straightlining')
    }
    if (
      timings.length >= MIN_TIMED_RESPONSES_FOR_RAPID_FLAG &&
      rapidResponseRatio >= RAPID_RESPONSE_RATIO_THRESHOLD
    ) {
      reasons.push('rapid_responses')
    }

    return {
      flagged: reasons.length > 0,
      reasons,
      metrics: {
        scaleResponseCount: scaleValues.length,
        distinctScaleValues,
        timedResponseCount: timings.length,
        rapidResponseCount,
        rapidResponseRatio: Math.round(rapidResponseRatio * 1_000) / 1_000,
        rapidResponseThresholdMs: RAPID_RESPONSE_THRESHOLD_MS,
        rapidResponseRatioThreshold: RAPID_RESPONSE_RATIO_THRESHOLD,
      },
    }
  }
}

export const dataQualityTracker = new DataQualityTracker()
