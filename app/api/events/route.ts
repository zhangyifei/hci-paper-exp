import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import type { ExperimentEvent } from '@/lib/logger'

export const runtime = 'edge'

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

    const token = process.env.BLOB_READ_WRITE_TOKEN

    // Group events by session
    const bySession = new Map<string, ExperimentEvent[]>()
    for (const event of events) {
      if (!event.sessionId) continue
      const existing = bySession.get(event.sessionId) ?? []
      existing.push(event)
      bySession.set(event.sessionId, existing)
    }

    const writes = Array.from(bySession.entries()).map(
      async ([sessionId, sessionEvents]) => {
        sessionEvents.sort((a, b) => a.sequenceId - b.sequenceId)

        // ─── Raw event storage ───────────────────────────────────────────────
        // Each flush is stored as a NEW private file.
        // put() is a Simple Request: does NOT count against the Advanced Request
        // quota. No list() or get() is needed before writing, so this operation
        // costs zero Advanced Requests.
        const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const batchPath = `events/${sessionId}/${batchId}.jsonl`
        const batchContent =
          sessionEvents.map((e) => JSON.stringify(e)).join('\n') + '\n'

        await put(batchPath, batchContent, {
          access: 'private',
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: 'application/x-ndjson',
          token,
        })

        // ─── Per-session status (for /api/stats) ─────────────────────────────
        // Written to a PUBLIC blob only on the first batch and on the
        // experiment.completed batch. Skipping intermediate batches prevents a
        // delayed network write from overwriting a previously set completed:true.
        //
        // Reading a public blob URL is a regular HTTP fetch — not a Vercel Blob
        // operation — so the stats endpoint incurs zero Advanced Requests per
        // read. put() of a public blob is also a Simple Request (free).
        const isFirstBatch = sessionEvents.some((e) => e.sequenceId === 0)
        const completionEvent = sessionEvents.find(
          (e) => e.eventName === 'experiment.completed'
        )

        if (isFirstBatch || completionEvent) {
          const firstEvent = sessionEvents[0]
          await put(
            `stats/${sessionId}.json`,
            JSON.stringify({
              sessionId,
              condition: firstEvent.condition,
              startedAt: firstEvent.timestamp,
              completed: Boolean(completionEvent),
              completedAt: completionEvent?.timestamp ?? null,
            }),
            {
              access: 'public',
              addRandomSuffix: false,
              allowOverwrite: true,
              contentType: 'application/json',
              token,
            }
          )
        }
      }
    )

    await Promise.all(writes)

    return NextResponse.json({ ok: true, inserted: events.length })
  } catch (err) {
    console.error('[api/events]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
