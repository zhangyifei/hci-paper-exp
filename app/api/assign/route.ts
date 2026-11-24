import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assignCondition } from '@/lib/assignment'
import { reconcileFullBatch } from '@/lib/assignment-reconciliation-server'
import { CONDITIONS, type Condition } from '@/lib/experiment-config'
import { hasValidProlificAssignmentIdentity } from '@/lib/prolific-identity'
import type { AssignOutcome, AssignmentStatus } from '@/lib/types'

interface AssignResponse {
  outcome: AssignOutcome
  condition: Condition | null
  batchId: string | null
  status: AssignmentStatus | null
  retryable: boolean
}

interface AssignBody {
  pid?: unknown
  studyId?: unknown
  sessionId?: unknown
  expSessionId?: unknown
}

interface ValidAssignBody {
  pid: string
  studyId: string
  sessionId: string
  expSessionId: string
}

interface AssignmentRpcRow {
  out_outcome?: string | null
  out_group?: string | null
  out_batch_id?: string | null
  out_status?: AssignmentStatus | null
}

function parseAssignmentResult(data: unknown): AssignResponse {
  const raw = Array.isArray(data) ? data[0] : data
  const row = (raw ?? {}) as AssignmentRpcRow
  const outcome = (row.out_outcome ?? 'no_active_batch') as AssignOutcome
  const group = row.out_group ?? null

  return {
    outcome,
    condition:
      group && CONDITIONS.includes(group as Condition) ? (group as Condition) : null,
    batchId: row.out_batch_id ?? null,
    status: row.out_status ?? null,
    retryable: false,
  }
}

async function assignParticipant(body: ValidAssignBody, pid: string): Promise<AssignResponse> {
  const { data, error } = await supabaseAdmin.rpc('assign_participant', {
    p_pid: pid,
    p_study: body.studyId ?? '',
    p_session: body.sessionId ?? '',
    p_exp_session: body.expSessionId ?? null,
  })
  if (error) throw error
  return parseAssignmentResult(data)
}

async function refreshExistingSession(
  assignment: AssignResponse,
  body: ValidAssignBody,
  pid: string,
): Promise<void> {
  if (
    assignment.outcome !== 'existing' ||
    assignment.status !== 'assigned' ||
    !assignment.batchId
  ) {
    return
  }

  const updates: {
    exp_session_id?: string
    prolific_study_id?: string
    prolific_session_id?: string
  } = {}
  if (body.expSessionId) updates.exp_session_id = body.expSessionId
  if (body.studyId) updates.prolific_study_id = body.studyId
  if (body.sessionId) updates.prolific_session_id = body.sessionId
  if (Object.keys(updates).length === 0) return

  const { error } = await supabaseAdmin
    .from('participant_assignments')
    .update(updates)
    .eq('batch_id', assignment.batchId)
    .eq('prolific_pid', pid)
    .eq('status', 'assigned')
  if (error) console.error('[api/assign] existing-session refresh failed:', error)
}

/**
 * Legacy / override path: deterministic hash assignment (or an explicit
 * `?condition=Gx` override). Used for debugging and for forcing a condition
 * without touching the batch system.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const pid = searchParams.get('pid') ?? 'anonymous'
  const override = searchParams.get('condition')

  const condition = assignCondition(pid, override)
  return NextResponse.json({ condition, pid })
}

/**
 * Balanced, batch-aware condition assignment.
 *
 * Assigns the incoming participant to the least-filled group (G1–G4) of the
 * currently active test batch, capped at the batch's per-group size. The work
 * happens inside an atomic Postgres function (`assign_participant`) that locks
 * the active batch row, so concurrent landings can't over-fill a group.
 *
 * Outcomes:
 *   - assigned         → newly placed into a group
 *   - existing         → already assigned (idempotent re-entry keeps the group)
 *   - full             → every group in the active batch is at capacity
 *   - no_active_batch  → no batch is currently open for recruitment
 *   - invalid_prolific_params → missing/malformed Prolific launch identity
 */
export async function POST(req: NextRequest): Promise<NextResponse<AssignResponse>> {
  let body: AssignBody

  try {
    const rawBody: unknown = await req.json()
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      throw new Error('Invalid assignment request body')
    }
    body = rawBody as AssignBody
  } catch {
    return NextResponse.json(
      {
        outcome: 'invalid_prolific_params',
        condition: null,
        batchId: null,
        status: null,
        retryable: false,
      },
      { status: 400 },
    )
  }

  const pid = typeof body.pid === 'string' ? body.pid.trim() : ''
  const studyId = typeof body.studyId === 'string' ? body.studyId.trim() : ''
  const submissionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  const expSessionId =
    typeof body.expSessionId === 'string' ? body.expSessionId.trim() : ''
  if (
    !hasValidProlificAssignmentIdentity({
      participantId: pid,
      studyId,
      submissionId,
      experimentSessionId: expSessionId,
    })
  ) {
    return NextResponse.json(
      {
        outcome: 'invalid_prolific_params',
        condition: null,
        batchId: null,
        status: null,
        retryable: false,
      },
      { status: 400 },
    )
  }

  const validBody: ValidAssignBody = {
    pid,
    studyId,
    sessionId: submissionId,
    expSessionId,
  }

  let assignment: AssignResponse
  try {
    assignment = await assignParticipant(validBody, pid)
  } catch (error) {
    console.error('[api/assign] rpc error:', error)
    return NextResponse.json(
      {
        outcome: 'no_active_batch',
        condition: null,
        batchId: null,
        status: null,
        retryable: false,
      },
      { status: 500 },
    )
  }

  if (assignment.outcome === 'full' && assignment.batchId) {
    try {
      const reconciliation = await reconcileFullBatch(assignment.batchId)
      if (reconciliation.released > 0) {
        assignment = await assignParticipant(validBody, pid)
      } else if (!reconciliation.sourceAvailable) {
        assignment.retryable = true
      }
    } catch (error) {
      // Fail closed: keep the original `full` result if Prolific or storage is
      // unavailable. The atomic RPC remains the only way to grant a slot.
      console.error('[api/assign] full-batch reconciliation failed:', error)
      assignment.retryable = true
    }
  }

  await refreshExistingSession(assignment, validBody, pid)
  return NextResponse.json(assignment)
}
