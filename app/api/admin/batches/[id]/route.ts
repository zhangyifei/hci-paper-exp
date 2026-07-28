import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isAdminAuthorized } from '@/lib/admin-auth'
import type { BatchStatus } from '@/lib/types'

const VALID_STATUS: BatchStatus[] = ['active', 'closed']

/**
 * Update a batch's lifecycle status.
 *   - closed → stops recruitment into this batch.
 *   - active → reopens it (and closes any other active batch, since only one
 *     batch may recruit at a time).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: { status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const status = body.status as BatchStatus
  if (!VALID_STATUS.includes(status)) {
    return NextResponse.json({ error: 'status must be "active" or "closed"' }, { status: 400 })
  }

  // Reopening a batch: ensure it becomes the single active one.
  if (status === 'active') {
    const { error: closeErr } = await supabaseAdmin
      .from('test_batches')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('status', 'active')
      .neq('id', id)
    if (closeErr) {
      console.error('[api/admin/batches/:id] close-others error:', closeErr)
      return NextResponse.json({ error: 'Failed to update batches' }, { status: 500 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('test_batches')
    .update({
      status,
      closed_at: status === 'closed' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    console.error('[api/admin/batches/:id] update error:', error)
    return NextResponse.json({ error: 'Batch not found or update failed' }, { status: 404 })
  }

  return NextResponse.json({
    batch: {
      id: data.id,
      name: data.name,
      status: data.status,
      groupSize: data.group_size,
      createdAt: data.created_at,
      closedAt: data.closed_at,
    },
  })
}
