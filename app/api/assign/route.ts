import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assignCondition } from '@/lib/assignment'
import { CONDITIONS, type Condition } from '@/lib/experiment-config'
import type { AssignOutcome } from '@/lib/types'

interface AssignResponse {
  outcome: AssignOutcome
  condition: Condition | null
  batchId: string | null
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
 */
export async function POST(req: NextRequest): Promise<NextResponse<AssignResponse>> {
  let body: {
    pid?: string
    studyId?: string
    sessionId?: string
    expSessionId?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { outcome: 'no_active_batch', condition: null, batchId: null },
      { status: 400 },
    )
  }

  const pid = (body.pid ?? '').trim()
  if (!pid) {
    return NextResponse.json(
      { outcome: 'no_active_batch', condition: null, batchId: null },
      { status: 400 },
    )
  }

  const { data, error } = await supabaseAdmin.rpc('assign_participant', {
    p_pid: pid,
    p_study: body.studyId ?? '',
    p_session: body.sessionId ?? '',
    p_exp_session: body.expSessionId ?? null,
  })

  if (error) {
    console.error('[api/assign] rpc error:', error)
    return NextResponse.json(
      { outcome: 'no_active_batch', condition: null, batchId: null },
      { status: 500 },
    )
  }

  const row = Array.isArray(data) ? data[0] : data
  const outcome = (row?.out_outcome ?? 'no_active_batch') as AssignOutcome
  const group = (row?.out_group as string | null) ?? null
  const condition =
    group && CONDITIONS.includes(group as Condition) ? (group as Condition) : null

  return NextResponse.json({
    outcome,
    condition,
    batchId: (row?.out_batch_id as string | null) ?? null,
  })
}
