export type SessionOutcome = 'valid' | 'failed' | 'incomplete'

// A session is invalid the moment it records a failure event.
const FAILURE_EVENTS = ['attention_check.failed', 'experiment.invalidated'] as const

// A valid completion must carry the full trail, not just a lone completion event —
// this makes a forged `experiment.completed` detectable.
const REQUIRED_EVENTS = [
  'experiment.completed',
  'service2.task.complete',
  'survey.completed',
  'questionnaire.completed',
] as const

// Only these event names affect the outcome — filtering trail queries to this
// set keeps them small so a large batch never hits the DB row cap.
export const RELEVANT_EVENTS: readonly string[] = [...FAILURE_EVENTS, ...REQUIRED_EVENTS]

/** Classify a session from the set of event names it recorded. */
export function evaluateOutcome(eventNames: Iterable<string>): SessionOutcome {
  const names = eventNames instanceof Set ? eventNames : new Set(eventNames)
  if (FAILURE_EVENTS.some((n) => names.has(n))) return 'failed'
  if (REQUIRED_EVENTS.every((n) => names.has(n))) return 'valid'
  return 'incomplete'
}
