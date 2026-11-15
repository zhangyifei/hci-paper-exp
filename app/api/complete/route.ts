import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { evaluateOutcome } from '@/lib/session-eval'
import {
  completeProlificSubmission,
  completionCodeFromUrl,
  isProlificId,
  requestProlificSubmissionReturn,
} from '@/lib/batch-export/prolific'

/**
 * Server-side Prolific completion decision. Completion URLs live in server-only
 * env vars, and the selected URL/code is returned only after the session's event
 * trail is validated. A participant cannot obtain the valid code after failing.
 */
export async function POST(req: NextRequest) {
  let body: { sessionId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ outcome: 'incomplete', url: null, code: null }, { status: 400 })
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  if (!sessionId) {
    return NextResponse.json({ outcome: 'incomplete', url: null, code: null }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('experiment_events')
    .select('event_name,prolific_session_id')
    .eq('session_id', sessionId)

  if (error) {
    console.error('[api/complete] query error:', error)
    return NextResponse.json({ outcome: 'incomplete', url: null, code: null }, { status: 500 })
  }

  const outcome = evaluateOutcome((data ?? []).map((r) => r.event_name as string))
  const completionUrl = process.env.PROLIFIC_COMPLETION_URL ?? null
  const failedUrl = process.env.PROLIFIC_FAILED_URL ?? null

  // Only a full valid trail yields the completion code; a failure yields the fail
  // code; anything else yields no code (so the valid code can't be fished out).
  const url =
    outcome === 'valid' ? completionUrl : outcome === 'failed' ? failedUrl : null
  const code = completionCodeFromUrl(url)

  // Prevent a genuine completer from becoming NOCODE if the browser redirect
  // is interrupted. The submission id is derived from stored server events,
  // never accepted from the request body.
  const submissionId = (data ?? [])
    .map((row) => row.prolific_session_id as string | null)
    .find((value) => isProlificId(value)) ?? null
  let prolificCompleted = false
  let returnRequested = false
  if (outcome === 'valid') {
    prolificCompleted = await completeProlificSubmission(submissionId, code)
  } else if (outcome === 'failed' && submissionId) {
    // B4 was already published with a manual-review failure code, which can no
    // longer be edited. Request the policy-safe return directly after the
    // server validates an attention-check failure or timeout.
    returnRequested = await requestProlificSubmissionReturn(submissionId)
  }

  return NextResponse.json({
    outcome,
    url,
    code,
    prolificCompleted,
    returnRequested,
  })
}
