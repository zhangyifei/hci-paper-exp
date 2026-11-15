import { createHmac, timingSafeEqual } from 'node:crypto'

export const TERMINAL_PROLIFIC_STATUSES = new Set([
  'RETURNED',
  'REJECTED',
  'TIMED-OUT',
])

function equalText(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  )
}

/** Verify Prolific's base64 HMAC-SHA256 signature over timestamp + raw body. */
export function verifyProlificWebhookSignature(input: {
  rawBody: string
  timestamp: string | null
  signature: string | null
  secret: string | undefined
}): boolean {
  if (!input.secret || !input.timestamp || !input.signature) return false
  const expected = createHmac('sha256', input.secret)
    .update(input.timestamp + input.rawBody)
    .digest('base64')
  return equalText(expected, input.signature)
}

const PROLIFIC_ID = /^[a-f0-9]{24}$/

interface ProlificWebhookPayload {
  resource_id?: unknown
  event_type?: unknown
  participant_id?: unknown
  status?: unknown
}

export interface WebhookSubmission {
  id: string
  participant: string | null
  study_id: string
  status: string
}

export interface WebhookAssignment {
  id: string
  prolific_pid: string
  prolific_study_id: string | null
  status: 'assigned' | 'completed' | 'invalid' | 'released'
  invalid_reason: string | null
}

export interface ProlificWebhookDependencies {
  getSubmission: (submissionId: string) => Promise<WebhookSubmission>
  findAssignment: (submissionId: string) => Promise<WebhookAssignment | null>
  releaseAssignment: (input: {
    assignmentId: string
    evidence: string
    receivedAt: string
  }) => Promise<boolean>
  now?: () => Date
  onError?: (stage: 'submission' | 'assignment' | 'release', error: unknown) => void
}

export interface ProlificWebhookResult {
  status: number
  body: Record<string, unknown>
}

/**
 * Process a webhook independently from Next.js and Supabase so every status,
 * linkage, idempotency, and retry branch can be tested with deterministic
 * dependencies.
 */
export async function processProlificWebhook(
  input: {
    rawBody: string
    timestamp: string | null
    signature: string | null
    secret: string | undefined
    eventId: string | null
  },
  dependencies: ProlificWebhookDependencies,
): Promise<ProlificWebhookResult> {
  if (!input.secret) {
    return { status: 503, body: { error: 'Webhook unavailable' } }
  }
  if (!verifyProlificWebhookSignature(input)) {
    return { status: 401, body: { error: 'Invalid signature' } }
  }

  let payload: ProlificWebhookPayload
  try {
    payload = JSON.parse(input.rawBody) as ProlificWebhookPayload
  } catch {
    return { status: 400, body: { error: 'Invalid JSON' } }
  }

  if (payload.event_type !== 'submission.status.change') {
    return { status: 200, body: { ok: true, ignored: true } }
  }

  const submissionId =
    typeof payload.resource_id === 'string' ? payload.resource_id : ''
  if (!PROLIFIC_ID.test(submissionId)) {
    return { status: 400, body: { error: 'Invalid submission id' } }
  }

  let submission: WebhookSubmission
  try {
    submission = await dependencies.getSubmission(submissionId)
  } catch (error) {
    dependencies.onError?.('submission', error)
    return { status: 503, body: { error: 'Submission lookup failed' } }
  }

  const currentStatus = submission.status.trim().toUpperCase()
  if (!TERMINAL_PROLIFIC_STATUSES.has(currentStatus)) {
    return {
      status: 200,
      body: { ok: true, ignored: true, status: currentStatus },
    }
  }

  const participantId = submission.participant ?? ''
  if (
    typeof payload.participant_id === 'string' &&
    payload.participant_id !== participantId
  ) {
    return { status: 409, body: { error: 'Participant mismatch' } }
  }

  let assignment: WebhookAssignment | null
  try {
    assignment = await dependencies.findAssignment(submissionId)
  } catch (error) {
    dependencies.onError?.('assignment', error)
    return { status: 503, body: { error: 'Assignment lookup failed' } }
  }
  if (!assignment) {
    return {
      status: 200,
      body: { ok: true, ignored: true, reason: 'no assignment' },
    }
  }

  if (
    assignment.prolific_pid !== participantId ||
    assignment.prolific_study_id !== submission.study_id
  ) {
    return { status: 409, body: { error: 'Assignment mismatch' } }
  }
  if (assignment.status === 'released' || assignment.status === 'invalid') {
    return { status: 200, body: { ok: true, duplicate: true } }
  }

  const receivedAt = (dependencies.now?.() ?? new Date()).toISOString()
  const terminalEvidence = [
    assignment.invalid_reason,
    `prolific_terminal:${currentStatus}`,
    `webhook_event=${input.eventId ?? 'unknown'}`,
    `received_at=${receivedAt}`,
  ]
    .filter((value): value is string => Boolean(value))
    .join(';')

  try {
    const released = await dependencies.releaseAssignment({
      assignmentId: assignment.id,
      evidence: terminalEvidence,
      receivedAt,
    })
    return { status: 200, body: { ok: true, released, status: currentStatus } }
  } catch (error) {
    dependencies.onError?.('release', error)
    return { status: 503, body: { error: 'Assignment update failed' } }
  }
}
