export interface ReconciliationAssignment {
  id: string
  prolificPid: string
  expSessionId: string | null
  prolificSessionId?: string | null
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
  prolificSessionId?: string | null
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
  | {
      assignmentId: string
      action: 'wait-for-grace'
      submissionId: string
      remainingMs: number
    }

const TERMINAL_PROLIFIC_STATUSES = new Set(['RETURNED', 'REJECTED', 'TIMED-OUT'])
const REQUIRED_COMPLETION_EVENTS = [
  'service2.task.complete',
  'survey.completed',
  'questionnaire.completed',
  'experiment.completed',
] as const
const RETURN_REQUEST_GRACE_MS = 2 * 60 * 1_000

function sessionCompletion(
  participantId: string,
  sessionId: string,
  events: ReconciliationEvent[],
): { expSessionId: string; completedAt: string; completedAtMs: number } | null {
  const rows = events.filter(
    (event) => event.participantId === participantId && event.sessionId === sessionId,
  )
  const names = new Set(rows.map((row) => row.eventName))
  if (!REQUIRED_COMPLETION_EVENTS.every((name) => names.has(name))) return null
  const completion = rows
    .filter((row) => row.eventName === 'experiment.completed')
    .sort((a, b) => b.timestamp - a.timestamp)[0]
  if (!completion || !Number.isFinite(completion.timestamp)) return null
  return {
    expSessionId: sessionId,
    completedAt: new Date(completion.timestamp).toISOString(),
    completedAtMs: completion.timestamp,
  }
}

/**
 * Prefer the experiment session linked on the assignment. A participant who
 * re-opens the study link gets a new session that replaces that link, so when
 * they finish in the earlier tab, accept another complete session only if it
 * belongs to the same Prolific submission. Older submissions never qualify.
 */
function completionEvidence(
  assignment: ReconciliationAssignment,
  events: ReconciliationEvent[],
): { expSessionId: string; completedAt: string } | null {
  const linked = assignment.expSessionId
    ? sessionCompletion(assignment.prolificPid, assignment.expSessionId, events)
    : null
  if (linked) return { expSessionId: linked.expSessionId, completedAt: linked.completedAt }

  const submissionId = assignment.prolificSessionId
  if (!submissionId) return null
  const sameSubmissionSessions = new Set(
    events
      .filter(
        (event) =>
          event.participantId === assignment.prolificPid &&
          event.prolificSessionId === submissionId,
      )
      .map((event) => event.sessionId),
  )
  const latest = [...sameSubmissionSessions]
    .map((sessionId) => sessionCompletion(assignment.prolificPid, sessionId, events))
    .filter((evidence): evidence is NonNullable<typeof evidence> => evidence !== null)
    .sort((a, b) => b.completedAtMs - a.completedAtMs)[0]
  return latest ? { expSessionId: latest.expSessionId, completedAt: latest.completedAt } : null
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

    const evidence = completionEvidence(assignment, events)
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
    const isIncompleteNoCode =
      prolificStatus === 'AWAITING REVIEW' &&
      Boolean(submission?.submissionId) &&
      (completionCode === '' || completionCode === 'NOCODE')
    const shouldRequestReturn =
      isIncompleteNoCode && (Boolean(submission?.returnRequestedAt) || oldEnough)

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
      continue
    }

    if (isIncompleteNoCode && submission?.submissionId) {
      const elapsedMs = Number.isFinite(completedAtMs)
        ? Math.max(0, nowMs - completedAtMs)
        : 0
      actions.push({
        assignmentId: assignment.id,
        action: 'wait-for-grace',
        submissionId: submission.submissionId,
        remainingMs: Math.max(0, RETURN_REQUEST_GRACE_MS - elapsedMs),
      })
    }
  }

  return actions
}
