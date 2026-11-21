import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  isProlificId,
  fetchProlificData,
  requestProlificSubmissionReturn,
  type ProlificSubmission,
} from '@/lib/batch-export/prolific'
import {
  planAssignmentReconciliation,
  type ReconciliationAssignment,
  type ReconciliationEvent,
  type ReconciliationSubmission,
} from '@/lib/assignment-reconciliation'

const PAGE_SIZE = 1_000
const QUERY_CHUNK_SIZE = 100

interface AssignmentRow {
  id: string
  prolific_pid: string
  prolific_study_id: string | null
  prolific_session_id: string | null
  exp_session_id: string | null
  status: 'assigned' | 'completed'
}
interface EventRow {
  participant_id: string
  session_id: string
  event_name: string
  timestamp: number
  prolific_session_id: string | null
}

export interface FullBatchReconciliationResult {
  released: number
  completed: number
  returnRequested: number
  changed: number
  sourceAvailable: boolean
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

async function loadCapacityRows(batchId: string): Promise<AssignmentRow[]> {
  const rows: AssignmentRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('participant_assignments')
      .select('id,prolific_pid,prolific_study_id,prolific_session_id,exp_session_id,status')
      .eq('batch_id', batchId)
      .in('status', ['assigned', 'completed'])
      .order('assigned_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const page = (data ?? []) as AssignmentRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

function dominantStudyId(rows: AssignmentRow[]): string | null {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!isProlificId(row.prolific_study_id)) continue
    counts.set(row.prolific_study_id, (counts.get(row.prolific_study_id) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

const COMPLETION_EVENT_NAMES = [
  'service2.task.complete',
  'survey.completed',
  'questionnaire.completed',
  'experiment.completed',
]

async function loadCompletionEvents(assignments: AssignmentRow[]): Promise<EventRow[]> {
  const unique = (values: (string | null)[]): string[] =>
    Array.from(new Set(values.filter((value): value is string => Boolean(value))))
  const sessionIds = unique(assignments.map((assignment) => assignment.exp_session_id))
  // Also load sessions from the same Prolific submission, so a participant who
  // finished in an earlier tab after re-opening the study link is recognized.
  const submissionIds = unique(
    assignments
      .filter((assignment) => assignment.status === 'assigned')
      .map((assignment) => assignment.prolific_session_id)
      .filter((value) => isProlificId(value)),
  )

  const byEventKey = new Map<string, EventRow>()
  const load = async (column: 'session_id' | 'prolific_session_id', values: string[]) => {
    for (const valueChunk of chunks(values, QUERY_CHUNK_SIZE)) {
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabaseAdmin
          .from('experiment_events')
          .select('event_id,participant_id,session_id,event_name,timestamp,prolific_session_id')
          .in(column, valueChunk)
          .in('event_name', COMPLETION_EVENT_NAMES)
          .order('id')
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw error
        const page = (data ?? []) as (EventRow & { event_id: string })[]
        for (const { event_id: eventId, ...row } of page) byEventKey.set(eventId, row)
        if (page.length < PAGE_SIZE) break
      }
    }
  }
  await load('session_id', sessionIds)
  await load('prolific_session_id', submissionIds)
  return [...byEventKey.values()]
}

function toSubmissionRows(submissions: ProlificSubmission[]): ReconciliationSubmission[] {
  return submissions.map((submission) => ({
    submissionId: submission.id,
    participantId: submission.participant_id,
    status: submission.status,
    completionCode: submission.study_code,
    returnRequestedAt: submission.return_requested,
    completedAt: submission.completed_at,
  }))
}

async function applyActions(
  actions: ReturnType<typeof planAssignmentReconciliation>,
): Promise<FullBatchReconciliationResult> {
  let released = 0
  let completed = 0
  let returnRequested = 0

  for (const action of actions) {
    if (action.action === 'release') {
      const { data, error } = await supabaseAdmin
        .from('participant_assignments')
        .update({
          status: 'released',
          invalid_reason: `prolific_terminal:${action.prolificStatus}`,
        })
        .eq('id', action.assignmentId)
        .in('status', ['assigned', 'completed'])
        .select('id')
      if (error) throw error
      released += data?.length ?? 0
      continue
    }

    if (action.action === 'complete') {
      const { data, error } = await supabaseAdmin
        .from('participant_assignments')
        .update({
          status: 'completed',
          exp_session_id: action.expSessionId,
          completed_at: action.completedAt,
        })
        .eq('id', action.assignmentId)
        .eq('status', 'assigned')
        .select('id')
      if (error) throw error
      completed += data?.length ?? 0
      continue
    }

    const requested =
      action.alreadyRequested ||
      (await requestProlificSubmissionReturn(action.submissionId))
    if (!requested) continue

    const checkedAt = new Date().toISOString()
    const evidence = [
      'prolific_return_requested:nocode_incomplete',
      `submission=${action.submissionId}`,
      `missing=${action.missingEvents.join(',') || 'unknown'}`,
      `checked_at=${checkedAt}`,
    ].join(';')
    const { data, error } = await supabaseAdmin
      .from('participant_assignments')
      .update({
        invalid_reason: evidence,
      })
      .eq('id', action.assignmentId)
      .in('status', ['assigned', 'completed'])
      .select('id')
    if (error) throw error
    const changedRows = data?.length ?? 0
    returnRequested += changedRows
  }

  return {
    released,
    completed,
    returnRequested,
    changed: released + completed + returnRequested,
    sourceAvailable: true,
  }
}

/**
 * Reconcile stale capacity-occupying rows after an atomic assignment attempt
 * says the active batch is full. Failure is surfaced to the caller, which
 * safely falls back to the original `full` outcome without over-assigning.
 */
export async function reconcileFullBatch(
  batchId: string,
): Promise<FullBatchReconciliationResult> {
  const rows = await loadCapacityRows(batchId)
  if (rows.length === 0) {
    return {
      released: 0,
      completed: 0,
      returnRequested: 0,
      changed: 0,
      sourceAvailable: true,
    }
  }

  const studyId = dominantStudyId(rows)
  const prolific = await fetchProlificData(studyId)
  if (!prolific.available) {
    return {
      released: 0,
      completed: 0,
      returnRequested: 0,
      changed: 0,
      sourceAvailable: false,
    }
  }

  const eventRows = await loadCompletionEvents(rows)
  const assignments: ReconciliationAssignment[] = rows.map((row) => ({
    id: row.id,
    prolificPid: row.prolific_pid,
    expSessionId: row.exp_session_id,
    prolificSessionId: isProlificId(row.prolific_session_id) ? row.prolific_session_id : null,
    status: row.status,
  }))
  const events: ReconciliationEvent[] = eventRows.map((event) => ({
    participantId: event.participant_id,
    sessionId: event.session_id,
    eventName: event.event_name,
    timestamp: Number(event.timestamp),
    prolificSessionId: event.prolific_session_id,
  }))
  const actions = planAssignmentReconciliation(
    assignments,
    toSubmissionRows(prolific.submissions),
    events,
  )

  return applyActions(actions)
}
