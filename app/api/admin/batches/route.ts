import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isAdminAuthorized } from '@/lib/admin-auth'
import { CONDITIONS, type Condition } from '@/lib/experiment-config'
import type { BatchSummary, GroupTally, TestBatch } from '@/lib/types'

interface BatchRow {
  id: string
  name: string
  status: 'active' | 'closed'
  group_size: number
  created_at: string
  closed_at: string | null
}

interface AssignmentRow {
  batch_id: string
  group_condition: Condition
  status: 'assigned' | 'completed' | 'invalid'
}

const MAX_GROUP_SIZE = 1000

function toBatch(row: BatchRow): TestBatch {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    groupSize: row.group_size,
    createdAt: row.created_at,
    closedAt: row.closed_at,
  }
}

function summarize(batch: BatchRow, assignments: AssignmentRow[]): BatchSummary {
  const rows = assignments.filter((a) => a.batch_id === batch.id)
  const groups: GroupTally[] = CONDITIONS.map((group) => {
    const g = rows.filter((r) => r.group_condition === group)
    return {
      group,
      assigned: g.length,
      completed: g.filter((r) => r.status === 'completed').length,
      invalid: g.filter((r) => r.status === 'invalid').length,
      capacity: batch.group_size,
    }
  })

  return {
    ...toBatch(batch),
    groups,
    totalAssigned: groups.reduce((s, g) => s + g.assigned, 0),
    totalCompleted: groups.reduce((s, g) => s + g.completed, 0),
    totalInvalid: groups.reduce((s, g) => s + g.invalid, 0),
    capacity: batch.group_size * CONDITIONS.length,
  }
}

/** List every batch with per-group tallies (assigned / completed / invalid). */
export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ data: batches, error: bErr }, { data: assignments, error: aErr }] = await Promise.all([
    supabaseAdmin.from('test_batches').select('*').order('created_at', { ascending: false }),
    supabaseAdmin
      .from('participant_assignments')
      .select('batch_id, group_condition, status'),
  ])

  if (bErr || aErr) {
    console.error('[api/admin/batches] query error:', bErr ?? aErr)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const summaries = (batches ?? []).map((b) =>
    summarize(b as BatchRow, (assignments ?? []) as AssignmentRow[]),
  )

  return NextResponse.json({ batches: summaries })
}

/**
 * Start a new batch. To keep assignment unambiguous, any currently active
 * batches are closed first, so a fresh batch becomes the single active target.
 */
export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { name?: string; groupSize?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const groupSize = Number.isFinite(body.groupSize) ? Math.floor(body.groupSize as number) : 25
  if (groupSize < 1 || groupSize > MAX_GROUP_SIZE) {
    return NextResponse.json({ error: 'groupSize out of range' }, { status: 400 })
  }

  // Close any active batches so only the new one recruits.
  const { error: closeErr } = await supabaseAdmin
    .from('test_batches')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('status', 'active')

  if (closeErr) {
    console.error('[api/admin/batches] close-active error:', closeErr)
    return NextResponse.json({ error: 'Failed to close active batches' }, { status: 500 })
  }

  const { data, error } = await supabaseAdmin
    .from('test_batches')
    .insert({ name, group_size: groupSize, status: 'active' })
    .select('*')
    .single()

  if (error || !data) {
    console.error('[api/admin/batches] insert error:', error)
    return NextResponse.json({ error: 'Failed to create batch' }, { status: 500 })
  }

  return NextResponse.json({ batch: toBatch(data as BatchRow) }, { status: 201 })
}
