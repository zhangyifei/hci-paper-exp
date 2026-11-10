import { logger } from './logger'

/** Normalize presentation-only address differences without accepting another location. */
export function normalizeStudyAddress(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/,?\s*montreal\s*$/i, '')
    .replace(/[.,]/g, ' ')
    .replace(/[‐‑‒–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchesRequiredAddress(value: string, requiredAddress: string | null): boolean {
  if (requiredAddress === null) return true
  return normalizeStudyAddress(value) === normalizeStudyAddress(requiredAddress)
}

interface TaskAddressErrorDetails {
  taskNumber: 1 | 2
  field: 'ride_destination' | 'courier_sender' | 'courier_recipient' | 'cinema_location'
  expectedAddress: string
  providedAddress: string
  source: 'suggestion' | 'saved' | 'manual_entry' | 'continue'
}

/** Record one participant-correctable task error without marking the task complete. */
export function recordTaskAddressError(details: TaskAddressErrorDetails): void {
  logger.trackEvent('task.error', 'task', 'task_active', {
    error: 'incorrect_address',
    payload: {
      ...details,
      reason: 'incorrect_address',
    },
  })
}
