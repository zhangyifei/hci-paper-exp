import { NextRequest, NextResponse } from 'next/server'
import { put, list } from '@vercel/blob'
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

    // Group events by sessionId — one blob file per session
    const bySession = new Map<string, ExperimentEvent[]>()
    for (const event of events) {
      if (!event.sessionId) continue
      const existing = bySession.get(event.sessionId) ?? []
      existing.push(event)
      bySession.set(event.sessionId, existing)
    }

    const writes = Array.from(bySession.entries()).map(
      async ([sessionId, sessionEvents]) => {
        const blobPath = `events/${sessionId}.jsonl`

        // Fetch existing blob content if it exists
        let existing = ''
        try {
          const { blobs } = await list({ prefix: blobPath })
          if (blobs.length > 0) {
            const res = await fetch(blobs[0].url)
            if (res.ok) {
              existing = await res.text()
            }
          }
        } catch {
          // No existing blob — start fresh
        }

        // Append new events as JSONL
        const newLines = sessionEvents
          .map((e) => JSON.stringify(e))
          .join('\n')

        const content = existing
          ? existing.trimEnd() + '\n' + newLines + '\n'
          : newLines + '\n'

        await put(blobPath, content, {
          access: 'public',
          addRandomSuffix: false,
          contentType: 'application/x-ndjson',
        })
      }
    )

    await Promise.all(writes)

    return NextResponse.json({ ok: true, inserted: events.length })
  } catch (err) {
    console.error('[api/events]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
