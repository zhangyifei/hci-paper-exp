export const EXPERIMENT_TIMEOUT_MS = 30 * 60 * 1000

const EXPERIMENT_STARTED_AT_KEY_PREFIX = 'hci_experiment_started_at:'

export function experimentStartedAtStorageKey(sessionId: string): string {
  return `${EXPERIMENT_STARTED_AT_KEY_PREFIX}${sessionId}`
}
