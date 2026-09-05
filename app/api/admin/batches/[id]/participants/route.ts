import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isAdminAuthorized } from '@/lib/admin-auth'
import { evaluateOutcome } from '@/lib/session-eval'
import type { ParticipantAssignment } from '@/lib/types'

interface AssignmentRow {
  id: string
  batch_id: string
  prolific_pid: string
  prolific_study_id: string | null
  prolific_session_id: string | null
  group_condition: ParticipantAssignment['groupCondition']
  exp_session_id: string | null
  status: ParticipantAssignment['status']
  invalid_reason: string | null
  assigned_at: string
  completed_at: string | null
}

/**
 * Roster of participants in a batch — the list an admin uses to reconcile who
 * to pay on Prolific. Each row links the internal assignment to the Prolific
 * PID / session and reports completion status.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('participant_assignments')
    .select('*')
    .eq('batch_id', id)
    .order('assigned_at', { ascending: true })

  if (error) {
    console.error('[api/admin/batches/:id/participants] query error:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const participants: ParticipantAssignment[] = (data ?? []).map((r) => {
    const row = r as AssignmentRow
    return {
      id: row.id,
      batchId: row.batch_id,
      prolificPid: row.prolific_pid,
      prolificStudyId: row.prolific_study_id,
      prolificSessionId: row.prolific_session_id,
      groupCondition: row.group_condition,
      expSessionId: row.exp_session_id,
      status: row.status,
      invalidReason: row.invalid_reason,
      assignedAt: row.assigned_at,
      completedAt: row.completed_at,
    }
  })

  // Verify each completed session's event trail so a forged completion is flagged.
  const sessionIds = participants
    .map((p) => p.expSessionId)
    .filter((s): s is string => Boolean(s))

  const namesBySession = new Map<string, Set<string>>()
  if (sessionIds.length > 0) {
    const { data: evs } = await supabaseAdmin
      .from('experiment_events')
      .select('session_id, event_name')
      .in('session_id', sessionIds)
    for (const row of evs ?? []) {
      const e = row as { session_id: string; event_name: string }
      if (!namesBySession.has(e.session_id)) namesBySession.set(e.session_id, new Set())
      namesBySession.get(e.session_id)!.add(e.event_name)
    }
  }

  const verified: ParticipantAssignment[] = participants.map((p) => {
    if (p.status !== 'completed' || !p.expSessionId) return p
    const outcome = evaluateOutcome(namesBySession.get(p.expSessionId) ?? new Set())
    return { ...p, integrity: outcome === 'valid' ? 'ok' : 'review' }
  })

  return NextResponse.json({ participants: verified })
}
