import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isAdminAuthorized } from '@/lib/admin-auth'

/**
 * Release a participant's slot so a replacement can be recruited. Sets the
 * assignment to 'released', which is excluded from a group's capacity count
 * (see the assign_participant function), freeing the cell without unbalancing
 * the design. Used for abandoned sessions or completions you reject on Prolific.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: { action?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.action !== 'release') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('participant_assignments')
    .update({ status: 'released' })
    .eq('id', id)
    .neq('status', 'released')

  if (error) {
    console.error('[api/admin/assignments/:id] release error:', error)
    return NextResponse.json({ error: 'Release failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
