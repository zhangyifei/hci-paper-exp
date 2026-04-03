import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ExperimentEvent } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const events: ExperimentEvent[] = body.events

    if (!Array.isArray(events)) {
      return NextResponse.json({ error: 'events must be an array' }, { status: 400 })
    }

    if (events.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 })
    }

    const rows = events
      .filter((e) => e.sessionId)
      .map((e) => ({
        event_name: e.eventName,
        event_id: e.eventId,
        session_id: e.sessionId,
        participant_id: e.participantId,
        sequence_id: e.sequenceId,
        flow: e.flow,
        state: e.state,
        timestamp: e.timestamp,
        client_mono_ms: e.clientMonoMs,
        duration_ms: e.durationMs ?? null,
        parent_event_id: e.parentEventId ?? null,
        payload: e.payload ?? null,
        error: e.error ?? null,
        condition: e.condition,
        prolific_study_id: e.prolificStudyId ?? null,
        prolific_session_id: e.prolificSessionId ?? null,
      }))

    const { error } = await supabaseAdmin.from('experiment_events').insert(rows)

    if (error) {
      console.error('[api/events] Supabase insert error:', error)
      return NextResponse.json({ error: 'Failed to insert events' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, inserted: rows.length })
  } catch (err) {
    console.error('[api/events]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
