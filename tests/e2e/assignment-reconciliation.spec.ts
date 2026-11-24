import { expect, test } from '@playwright/test'
import {
  planAssignmentReconciliation,
  type ReconciliationEvent,
} from '../../lib/assignment-reconciliation'

const COMPLETE_EVENT_NAMES = [
  'service2.task.complete',
  'survey.completed',
  'questionnaire.completed',
  'experiment.completed',
]

function completeEvents(
  participantId: string,
  sessionId: string,
  completedAt = Date.UTC(2026, 10, 14, 15, 30),
): ReconciliationEvent[] {
  return COMPLETE_EVENT_NAMES.map((eventName, index) => ({
    participantId,
    sessionId,
    eventName,
    timestamp: completedAt - (COMPLETE_EVENT_NAMES.length - 1 - index) * 1_000,
  }))
}

test.describe('full-batch assignment reconciliation', () => {
  test('releases terminal Prolific submissions so replacements can use the slots', () => {
    const actions = planAssignmentReconciliation(
      [
        { id: 'assignment-returned', prolificPid: 'pid-returned', expSessionId: null, status: 'assigned' },
        { id: 'assignment-rejected', prolificPid: 'pid-rejected', expSessionId: null, status: 'completed' },
        { id: 'assignment-timed-out', prolificPid: 'pid-timed-out', expSessionId: null, status: 'assigned' },
      ],
      [
        { participantId: 'pid-returned', status: 'returned' },
        { participantId: 'pid-rejected', status: ' REJECTED ' },
        { participantId: 'pid-timed-out', status: 'TIMED-OUT' },
      ],
      [],
    )

    expect(actions).toEqual([
      {
        assignmentId: 'assignment-returned',
        action: 'release',
        prolificStatus: 'RETURNED',
      },
      {
        assignmentId: 'assignment-rejected',
        action: 'release',
        prolificStatus: 'REJECTED',
      },
      {
        assignmentId: 'assignment-timed-out',
        action: 'release',
        prolificStatus: 'TIMED-OUT',
      },
    ])
  })

  test('repairs a stale assignment with a complete same-session event trail', () => {
    const completedAt = Date.UTC(2026, 10, 14, 16, 45)
    const actions = planAssignmentReconciliation(
      [{ id: 'assignment-complete', prolificPid: 'pid-complete', expSessionId: 'exp-session-current', status: 'assigned' }],
      [{ participantId: 'pid-complete', status: 'AWAITING REVIEW' }],
      completeEvents('pid-complete', 'exp-session-current', completedAt),
    )

    expect(actions).toEqual([
      {
        assignmentId: 'assignment-complete',
        action: 'complete',
        expSessionId: 'exp-session-current',
        completedAt: new Date(completedAt).toISOString(),
      },
    ])
  })

  test('does not alter active or awaiting-review participants without full completion evidence', () => {
    const incompleteEvents = completeEvents('pid-awaiting', 'exp-session-incomplete').filter(
      (event) => event.eventName !== 'questionnaire.completed',
    )
    const actions = planAssignmentReconciliation(
      [
        { id: 'assignment-active', prolificPid: 'pid-active', expSessionId: 'exp-session-active', status: 'assigned' },
        { id: 'assignment-awaiting', prolificPid: 'pid-awaiting', expSessionId: 'exp-session-incomplete', status: 'assigned' },
      ],
      [
        { participantId: 'pid-active', status: 'ACTIVE' },
        { participantId: 'pid-awaiting', status: 'AWAITING REVIEW' },
      ],
      incompleteEvents,
    )

    expect(actions).toEqual([])
  })

  test('keeps a completed awaiting-review submission counted', () => {
    const actions = planAssignmentReconciliation(
      [{ id: 'assignment-finished', prolificPid: 'pid-finished', expSessionId: 'session-finished', status: 'completed' }],
      [{ participantId: 'pid-finished', status: 'AWAITING REVIEW' }],
      completeEvents('pid-finished', 'session-finished'),
    )

    expect(actions).toEqual([])
  })

  test('requests a return for an older NOCODE submission with incomplete evidence', () => {
    const now = Date.UTC(2026, 10, 14, 18, 0)
    const incompleteEvents = completeEvents('pid-nocode', 'session-nocode').filter(
      (event) => event.eventName !== 'questionnaire.completed',
    )
    const actions = planAssignmentReconciliation(
      [{ id: 'assignment-nocode', prolificPid: 'pid-nocode', expSessionId: 'session-nocode', status: 'assigned' }],
      [
        {
          submissionId: '6af7616e7de01ab7c5a54ed3',
          participantId: 'pid-nocode',
          status: 'AWAITING REVIEW',
          completionCode: 'NOCODE',
          completedAt: new Date(now - 3 * 60 * 1_000).toISOString(),
        },
      ],
      [
        ...completeEvents('pid-nocode', 'session-previous'),
        ...incompleteEvents,
      ],
      now,
    )

    expect(actions).toEqual([
      {
        assignmentId: 'assignment-nocode',
        action: 'request-return',
        submissionId: '6af7616e7de01ab7c5a54ed3',
        alreadyRequested: false,
        missingEvents: ['questionnaire.completed'],
      },
    ])
  })

  test('gives a new NOCODE submission a two-minute event-upload grace period', () => {
    const now = Date.UTC(2026, 10, 14, 18, 0)
    const actions = planAssignmentReconciliation(
      [{ id: 'assignment-grace', prolificPid: 'pid-grace', expSessionId: 'session-grace', status: 'assigned' }],
      [
        {
          submissionId: '6af7616e7de01ab7c5a54ed4',
          participantId: 'pid-grace',
          status: 'AWAITING REVIEW',
          completionCode: 'NOCODE',
          completedAt: new Date(now - 30_000).toISOString(),
        },
      ],
      [],
      now,
    )

    expect(actions).toEqual([
      {
        assignmentId: 'assignment-grace',
        action: 'wait-for-grace',
        submissionId: '6af7616e7de01ab7c5a54ed4',
        remainingMs: 90_000,
      },
    ])
  })

  test('does not combine completion events from different experiment sessions', () => {
    const events = completeEvents('pid-split', 'session-a').map((event, index) => ({
      ...event,
      sessionId: index < 2 ? 'session-a' : 'session-b',
    }))
    const actions = planAssignmentReconciliation(
      [{ id: 'assignment-split', prolificPid: 'pid-split', expSessionId: 'session-a', status: 'assigned' }],
      [{ participantId: 'pid-split', status: 'AWAITING REVIEW' }],
      events,
    )

    expect(actions).toEqual([])
  })

  test('does not reuse a complete event trail from a participant\'s older session', () => {
    const currentEvents = completeEvents('pid-repeat', 'session-current').filter(
      (event) => event.eventName !== 'questionnaire.completed',
    )
    const actions = planAssignmentReconciliation(
      [
        {
          id: 'assignment-current',
          prolificPid: 'pid-repeat',
          expSessionId: 'session-current',
          status: 'assigned',
        },
      ],
      [{ participantId: 'pid-repeat', status: 'AWAITING REVIEW' }],
      [...completeEvents('pid-repeat', 'session-previous'), ...currentEvents],
    )

    expect(actions).toEqual([])
  })

  test('uses only the experiment session recorded on the assignment', () => {
    const older = Date.UTC(2026, 10, 14, 13, 0)
    const newer = Date.UTC(2026, 10, 14, 14, 0)
    const actions = planAssignmentReconciliation(
      [{ id: 'assignment-newest', prolificPid: 'pid-newest', expSessionId: 'session-newer', status: 'assigned' }],
      [{ participantId: 'pid-newest', status: 'AWAITING REVIEW' }],
      [
        ...completeEvents('pid-newest', 'session-newer', newer),
        ...completeEvents('pid-newest', 'session-older', older),
      ],
    )

    expect(actions).toEqual([
      {
        assignmentId: 'assignment-newest',
        action: 'complete',
        expSessionId: 'session-newer',
        completedAt: new Date(newer).toISOString(),
      },
    ])
  })
})
