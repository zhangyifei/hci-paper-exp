import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { evaluateOutcome } from '@/lib/session-eval'

/**
 * Server-side Prolific redirect decision. The completion codes live in
 * server-only env vars (never shipped to the client), and the outcome is derived
 * from the session's recorded events — so a participant can't read the "valid"
 * code or claim it after failing. A failure trail always returns the fail URL.
 */
export async function POST(req: NextRequest) {
  let body: { sessionId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ outcome: 'incomplete', url: null }, { status: 400 })
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  if (!sessionId) {
    return NextResponse.json({ outcome: 'incomplete', url: null }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('experiment_events')
    .select('event_name')
    .eq('session_id', sessionId)

  if (error) {
    console.error('[api/complete] query error:', error)
    return NextResponse.json({ outcome: 'incomplete', url: null }, { status: 500 })
  }

  const outcome = evaluateOutcome((data ?? []).map((r) => r.event_name as string))
  const completionUrl = process.env.PROLIFIC_COMPLETION_URL ?? null
  const failedUrl = process.env.PROLIFIC_FAILED_URL ?? null

  // Failed → always the fail URL. Otherwise the completion URL (a genuine finisher
  // is never stranded; an incomplete trail is flagged for review in /admin).
  const url = outcome === 'failed' ? failedUrl : completionUrl

  return NextResponse.json({ outcome, url })
}
