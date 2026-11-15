export interface ReconciliationAssignment {
  id: string
  prolificPid: string
  expSessionId: string | null
  status: 'assigned' | 'completed'
}
export interface ReconciliationSubmission {
  submissionId?: string
  participantId: string
  status: string
  completionCode?: string | null
  completedAt?: string | null
  returnRequestedAt?: string | null
}

export interface ReconciliationEvent {
  participantId: string
  sessionId: string
  eventName: string
  timestamp: number
}

export type ReconciliationAction =
  | {
      assignmentId: string
      action: 'release'
      prolificStatus: string
    }
  | {
      assignmentId: string
      action: 'complete'
      expSessionId: string
      completedAt: string
    }
  | {
      assignmentId: string
      action: 'request-return'
      submissionId: string
      alreadyRequested: boolean
      missingEvents: string[]
    }

const TERMINAL_PROLIFIC_STATUSES = new Set(['RETURNED', 'REJECTED', 'TIMED-OUT'])
const REQUIRED_COMPLETION_EVENTS = [
  'service2.task.complete',
  'survey.completed',
  'questionnaire.completed',
  'experiment.completed',
] as const
const RETURN_REQUEST_GRACE_MS = 2 * 60 * 1_000

function completionEvidence(
  participantId: string,
  expSessionId: string | null,
  events: ReconciliationEvent[],
): { expSessionId: string; completedAt: string } | null {
  if (!expSessionId) return null
  const rows = events.filter(
    (event) =>
      event.participantId === participantId && event.sessionId === expSessionId,
  )
  const names = new Set(rows.map((row) => row.eventName))
  if (!REQUIRED_COMPLETION_EVENTS.every((name) => names.has(name))) return null
  const completion = rows
    .filter((row) => row.eventName === 'experiment.completed')
    .sort((a, b) => b.timestamp - a.timestamp)[0]
  if (!completion || !Number.isFinite(completion.timestamp)) return null
  return {
    expSessionId,
    completedAt: new Date(completion.timestamp).toISOString(),
  }
}

/**
 * Decide how capacity-occupying rows should be reconciled when a batch reports
 * full. Terminal Prolific states release capacity. A complete server event trail
 * repairs stale assigned status/session linkage without freeing a valid slot.
 */
export function planAssignmentReconciliation(
  assignments: ReconciliationAssignment[],
  submissions: ReconciliationSubmission[],
  events: ReconciliationEvent[],
  nowMs = Date.now(),
): ReconciliationAction[] {
  const submissionByParticipant = new Map(
    submissions.map((submission) => [submission.participantId, submission]),
  )

  const actions: ReconciliationAction[] = []
  for (const assignment of assignments) {
    const prolificStatus = submissionByParticipant
      .get(assignment.prolificPid)
      ?.status.trim()
      .toUpperCase()

    if (prolificStatus && TERMINAL_PROLIFIC_STATUSES.has(prolificStatus)) {
      actions.push({
        assignmentId: assignment.id,
        action: 'release',
        prolificStatus,
      })
      continue
    }

    const evidence = completionEvidence(
      assignment.prolificPid,
      assignment.expSessionId,
      events,
    )
    if (evidence) {
      if (assignment.status === 'assigned') {
        actions.push({
          assignmentId: assignment.id,
          action: 'complete',
          ...evidence,
        })
      }
      continue
    }

    const submission = submissionByParticipant.get(assignment.prolificPid)
    const completionCode = submission?.completionCode?.trim().toUpperCase() ?? ''
    const completedAtMs = Date.parse(submission?.completedAt ?? '')
    const oldEnough =
      Number.isFinite(completedAtMs) && nowMs - completedAtMs >= RETURN_REQUEST_GRACE_MS
    const shouldRequestReturn =
      prolificStatus === 'AWAITING REVIEW' &&
      Boolean(submission?.submissionId) &&
      (completionCode === '' || completionCode === 'NOCODE') &&
      (Boolean(submission?.returnRequestedAt) || oldEnough)

    if (shouldRequestReturn && submission?.submissionId) {
      const observedEvents = new Set(
        events
          .filter(
            (event) =>
              event.participantId === assignment.prolificPid &&
              event.sessionId === assignment.expSessionId,
          )
          .map((event) => event.eventName),
      )
      actions.push({
        assignmentId: assignment.id,
        action: 'request-return',
        submissionId: submission.submissionId,
        alreadyRequested: Boolean(submission.returnRequestedAt),
        missingEvents: REQUIRED_COMPLETION_EVENTS.filter(
          (eventName) => !observedEvents.has(eventName),
        ),
      })
    }
  }

  return actions
}
