import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthorized } from '@/lib/admin-auth'
import { reconcileFullBatch } from '@/lib/assignment-reconciliation-server'

/**
 * Explicit researcher review action. It reconciles terminal Prolific states,
 * repairs complete event trails, and requests returns for older incomplete
 * NOCODE submissions while storing the evidence on the assignment row.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  try {
    const result = await reconcileFullBatch(id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[api/admin/batches/:id/reconcile] error:', error)
    return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 })
  }
}
