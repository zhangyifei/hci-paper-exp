import { createHmac } from 'node:crypto'
import { expect, test } from '@playwright/test'
import {
  processProlificWebhook,
  verifyProlificWebhookSignature,
  type ProlificWebhookDependencies,
  type WebhookAssignment,
  type WebhookSubmission,
} from '../../lib/prolific-webhook'

const SECRET = 'test-webhook-secret'
const TIMESTAMP = '1794686400'
const SUBMISSION_ID = '6af7616e7de01ab7c5a54ed3'
const PARTICIPANT_ID = '6647eae0cdc9da0ab81dc415'
const STUDY_ID = '6af7616e7de01ab7c5a54ed4'

function signedInput(payload: Record<string, unknown>) {
  const rawBody = JSON.stringify(payload)
  return {
    rawBody,
    timestamp: TIMESTAMP,
    signature: createHmac('sha256', SECRET)
      .update(TIMESTAMP + rawBody)
      .digest('base64'),
    secret: SECRET,
    eventId: 'evt-terminal-1',
  }
}

function terminalPayload() {
  return {
    resource_id: SUBMISSION_ID,
    event_type: 'submission.status.change',
    participant_id: PARTICIPANT_ID,
    status: 'RETURNED',
  }
}

function submission(status = 'RETURNED'): WebhookSubmission {
  return {
    id: SUBMISSION_ID,
    participant: PARTICIPANT_ID,
    study_id: STUDY_ID,
    status,
  }
}

function assignment(
  overrides: Partial<WebhookAssignment> = {},
): WebhookAssignment {
  return {
    id: 'assignment-1',
    prolific_pid: PARTICIPANT_ID,
    prolific_study_id: STUDY_ID,
    status: 'assigned',
    invalid_reason: null,
    ...overrides,
  }
}

function dependencies(
  overrides: Partial<ProlificWebhookDependencies> = {},
): ProlificWebhookDependencies {
  return {
    getSubmission: async () => submission(),
    findAssignment: async () => assignment(),
    releaseAssignment: async () => true,
    now: () => new Date('2026-11-14T18:00:00.000Z'),
    ...overrides,
  }
}

test.describe('Prolific webhook verification', () => {
  test('accepts the documented HMAC-SHA256 signature', () => {
    const input = signedInput(terminalPayload())
    expect(verifyProlificWebhookSignature(input)).toBe(true)
  })

  test('rejects tampered payloads and missing verification fields', () => {
    const input = signedInput({ status: 'RETURNED' })
    expect(
      verifyProlificWebhookSignature({
        ...input,
        rawBody: '{"status":"REJECTED"}',
      }),
    ).toBe(false)
    expect(
      verifyProlificWebhookSignature({
        rawBody: '{}',
        timestamp: null,
        signature: null,
        secret: SECRET,
      }),
    ).toBe(false)
  })
})

test.describe('Prolific webhook processing', () => {
  test('releases a matching assignment after a terminal status is confirmed', async () => {
    const releases: Array<{
      assignmentId: string
      evidence: string
      receivedAt: string
    }> = []
    const result = await processProlificWebhook(
      signedInput(terminalPayload()),
      dependencies({
        releaseAssignment: async (input) => {
          releases.push(input)
          return true
        },
      }),
    )

    expect(result).toEqual({
      status: 200,
      body: { ok: true, released: true, status: 'RETURNED' },
    })
    expect(releases).toHaveLength(1)
    expect(releases[0].evidence).toContain('prolific_terminal:RETURNED')
    expect(releases[0].evidence).toContain('webhook_event=evt-terminal-1')
  })

  test('ignores a non-terminal source-of-truth status', async () => {
    let assignmentLookups = 0
    const result = await processProlificWebhook(
      signedInput(terminalPayload()),
      dependencies({
        getSubmission: async () => submission('AWAITING REVIEW'),
        findAssignment: async () => {
          assignmentLookups += 1
          return assignment()
        },
      }),
    )

    expect(result).toEqual({
      status: 200,
      body: { ok: true, ignored: true, status: 'AWAITING REVIEW' },
    })
    expect(assignmentLookups).toBe(0)
  })

  test('rejects participant and assignment linkage mismatches', async () => {
    const participantMismatch = await processProlificWebhook(
      signedInput({ ...terminalPayload(), participant_id: 'different-participant' }),
      dependencies(),
    )
    expect(participantMismatch).toEqual({
      status: 409,
      body: { error: 'Participant mismatch' },
    })

    const assignmentMismatch = await processProlificWebhook(
      signedInput(terminalPayload()),
      dependencies({
        findAssignment: async () =>
          assignment({ prolific_study_id: '6af7616e7de01ab7c5a54ed5' }),
      }),
    )
    expect(assignmentMismatch).toEqual({
      status: 409,
      body: { error: 'Assignment mismatch' },
    })
  })

  test('treats duplicate terminal delivery as idempotent', async () => {
    let releases = 0
    const result = await processProlificWebhook(
      signedInput(terminalPayload()),
      dependencies({
        findAssignment: async () => assignment({ status: 'released' }),
        releaseAssignment: async () => {
          releases += 1
          return true
        },
      }),
    )

    expect(result).toEqual({
      status: 200,
      body: { ok: true, duplicate: true },
    })
    expect(releases).toBe(0)
  })

  test('returns retryable failures for source and storage outages', async () => {
    const submissionFailure = await processProlificWebhook(
      signedInput(terminalPayload()),
      dependencies({
        getSubmission: async () => {
          throw new Error('Prolific unavailable')
        },
      }),
    )
    expect(submissionFailure).toEqual({
      status: 503,
      body: { error: 'Submission lookup failed' },
    })

    const assignmentFailure = await processProlificWebhook(
      signedInput(terminalPayload()),
      dependencies({
        findAssignment: async () => {
          throw new Error('Supabase unavailable')
        },
      }),
    )
    expect(assignmentFailure).toEqual({
      status: 503,
      body: { error: 'Assignment lookup failed' },
    })

    const releaseFailure = await processProlificWebhook(
      signedInput(terminalPayload()),
      dependencies({
        releaseAssignment: async () => {
          throw new Error('Supabase update failed')
        },
      }),
    )
    expect(releaseFailure).toEqual({
      status: 503,
      body: { error: 'Assignment update failed' },
    })
  })
})
