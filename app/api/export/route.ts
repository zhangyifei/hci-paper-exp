import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function requireAuth(req: NextRequest): boolean {
  const secret = process.env.STATS_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data, error } = await supabase
      .from('experiment_events')
      .select('*')
      .order('session_id')
      .order('sequence_id')

    if (error) {
      console.error('[api/export] query error:', error)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return new Response('', {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Content-Disposition': 'attachment; filename="all_events.jsonl"',
        },
      })
    }

    // Convert snake_case DB rows back to camelCase event format
    const lines = data.map((row) =>
      JSON.stringify({
        eventName: row.event_name,
        eventId: row.event_id,
        sessionId: row.session_id,
        participantId: row.participant_id,
        sequenceId: row.sequence_id,
        flow: row.flow,
        state: row.state,
        timestamp: row.timestamp,
        clientMonoMs: row.client_mono_ms,
        durationMs: row.duration_ms,
        parentEventId: row.parent_event_id,
        payload: row.payload,
        error: row.error,
        condition: row.condition,
        prolificStudyId: row.prolific_study_id,
        prolificSessionId: row.prolific_session_id,
      })
    )

    return new Response(lines.join('\n') + '\n', {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Content-Disposition': 'attachment; filename="all_events.jsonl"',
      },
    })
  } catch (err) {
    console.error('[api/export]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
