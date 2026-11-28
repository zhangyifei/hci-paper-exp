import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { uniqueProlificId } from '@/lib/prolific-completion'
import { isProlificId } from '@/lib/prolific-identity'
import type { ExperimentEvent } from '@/lib/logger'
import { evaluateOutcome, RELEVANT_EVENTS } from '@/lib/session-eval'
import {
  completeProlificSubmission,
  requestProlificSubmissionReturn,
} from '@/lib/batch-export/prolific'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const events: ExperimentEvent[] = body.events

    if (!Array.isArray(events)) {
      return NextResponse.json({ error: 'events must be an array' }, { status: 400 })
    }

    if (events.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 })
    }

    const rows = events
      .filter((e) => e.sessionId)
      .map((e) => ({
        event_name: e.eventName,
        event_id: e.eventId,
        session_id: e.sessionId,
        participant_id: e.participantId,
        sequence_id: e.sequenceId,
        flow: e.flow,
        state: e.state,
        timestamp: e.timestamp,
        client_mono_ms: e.clientMonoMs,
        duration_ms: e.durationMs ?? null,
        parent_event_id: e.parentEventId ?? null,
        payload: e.payload ?? null,
        error: e.error ?? null,
        condition: e.condition,
        prolific_study_id: e.prolificStudyId ?? null,
        prolific_session_id: e.prolificSessionId ?? null,
      }))

    const { error } = await supabaseAdmin.from('experiment_events').upsert(rows, {
      onConflict: 'event_id',
      ignoreDuplicates: true,
    })

    if (error) {
      console.error('[api/events] Supabase insert error:', error)
      return NextResponse.json({ error: 'Failed to insert events' }, { status: 500 })
    }

    // Best-effort: keep the batch assignment's status in sync with lifecycle
    // events so the admin dashboard reflects who finished vs. was invalidated.
    // Matched by exp session id (events.session_id === assignment.exp_session_id).
    await syncAssignmentStatus(events)

    // Apply the valid Prolific completion code in the same server request that
    // durably stores the final event trail. Browser redirect remains a backup,
    // not the only way a genuine completion receives its code.
    await syncProlificDisposition(events)

    return NextResponse.json({ ok: true, inserted: rows.length })
  } catch (err) {
    console.error('[api/events]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function syncProlificDisposition(events: ExperimentEvent[]): Promise<void> {
  const sessionIds = Array.from(
    new Set(events.map((event) => event.sessionId).filter(Boolean)),
  )

  for (const sessionId of sessionIds) {
    // Uploads can arrive in several browser-safe chunks. Re-read the durable
    // session trail so a valid completion or failure can span those chunks.
    const { data, error } = await supabaseAdmin
      .from('experiment_events')
      .select('event_name,prolific_session_id,prolific_study_id')
      .eq('session_id', sessionId)
      .in('event_name', [...RELEVANT_EVENTS])
    if (error) throw error

    const sessionEvents = data ?? []
    const outcome = evaluateOutcome(sessionEvents.map((event) => event.event_name as string))
    const submissionId = uniqueProlificId(
      sessionEvents.map((event) => event.prolific_session_id as string | null),
    )
    const studyId = uniqueProlificId(
      sessionEvents.map((event) => event.prolific_study_id as string | null),
    )
    if (outcome === 'valid') {
      await completeProlificSubmission(submissionId, studyId)
    } else if (outcome === 'failed' && submissionId) {
      await requestProlificSubmissionReturn(submissionId)
    }
  }
}

/**
 * Reflect completion / invalidation into `participant_assignments`. Runs after
 * the events are stored and never blocks the response on failure — the events
 * are the source of truth, this table is a convenience view for the admin.
 */
async function syncAssignmentStatus(events: ExperimentEvent[]): Promise<void> {
  const sessionsFor = (name: string): string[] =>
    Array.from(
      new Set(
        events
          .filter((e) => e.eventName === name && e.sessionId)
          .map((e) => e.sessionId),
      ),
    )

  const completed = sessionsFor('experiment.completed')
  const invalidated = invalidatedSessions(events)

  try {
    for (const sessionId of completed) {
      const completedAt = new Date().toISOString()
      const { data, error } = await supabaseAdmin
        .from('participant_assignments')
        .update({ status: 'completed', completed_at: completedAt })
        .eq('exp_session_id', sessionId)
        .not('status', 'in', '("invalid","released")')
        .select('id')
      if (error) throw error
      if ((data?.length ?? 0) === 0) {
        await relinkSameSubmission(events, sessionId, { status: 'completed', completed_at: completedAt })
      }
    }
    for (const { sessionId, reason } of invalidated) {
      const update = {
        status: 'invalid',
        invalid_reason: reason,
        completed_at: new Date().toISOString(),
      }
      const { data, error } = await supabaseAdmin
        .from('participant_assignments')
        .update(update)
        .eq('exp_session_id', sessionId)
        .select('id')
      if (error) throw error
      if ((data?.length ?? 0) === 0) await relinkSameSubmission(events, sessionId, update)
    }
  } catch (err) {
    console.error('[api/events] assignment status sync failed:', err)
  }
}

/**
 * Re-opening the study link starts a new experiment session and re-points the
 * assignment to it. When the participant then finishes in the earlier tab, its
 * session matches no assignment, so attach it to the still-open assignment for
 * the same participant and Prolific submission.
 */
async function relinkSameSubmission(
  events: ExperimentEvent[],
  sessionId: string,
  update: Record<string, string | null>,
): Promise<void> {
  const source = events.find(
    (e) => e.sessionId === sessionId && e.participantId && isProlificId(e.prolificSessionId),
  )
  if (!source?.prolificSessionId) return
  const { error } = await supabaseAdmin
    .from('participant_assignments')
    .update({ ...update, exp_session_id: sessionId })
    .eq('prolific_pid', source.participantId)
    .eq('prolific_session_id', source.prolificSessionId)
    .eq('status', 'assigned')
  if (error) throw error
}

interface InvalidatedSession {
  sessionId: string
  reason: string | null
}

/** Unique invalidated sessions in this batch, each with its recorded reason. */
function invalidatedSessions(events: ExperimentEvent[]): InvalidatedSession[] {
  const bySession = new Map<string, string | null>()
  for (const e of events) {
    if (e.eventName !== 'experiment.invalidated' || !e.sessionId) continue
    if (!bySession.has(e.sessionId)) bySession.set(e.sessionId, invalidationReason(e))
  }
  return Array.from(bySession, ([sessionId, reason]) => ({ sessionId, reason }))
}

function invalidationReason(e: ExperimentEvent): string | null {
  const p = e.payload as { reason?: unknown; failedCheck?: unknown } | undefined
  const reason = typeof p?.reason === 'string' ? p.reason : null
  const check = typeof p?.failedCheck === 'string' ? p.failedCheck : null
  if (reason && check) return `${reason}:${check}`
  return reason ?? check
}
