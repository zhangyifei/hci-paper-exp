import { NextRequest, NextResponse } from 'next/server'
import { put, list, get } from '@vercel/blob'
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

    const bySession = new Map<string, ExperimentEvent[]>()
    for (const event of events) {
      if (!event.sessionId) continue
      const existing = bySession.get(event.sessionId) ?? []
      existing.push(event)
      bySession.set(event.sessionId, existing)
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN
    
    // Debug log (masking token)
    console.log('[api/events] Token present:', !!token, token ? `...${token.slice(-5)}` : 'missing')

    const writes = Array.from(bySession.entries()).map(
      async ([sessionId, sessionEvents]) => {
        const blobPath = `events/${sessionId}.jsonl`

        let existing = ''
        try {
          const { blobs } = await list({ prefix: blobPath, token })
          if (blobs.length > 0) {
            const blob = await get(blobs[0].url, { access: 'private', token })
            if (blob && blob.stream) {
              existing = await new Response(blob.stream).text()
            }
          }
        } catch (err) {
          // No existing blob — start fresh or error reading
          console.warn('[api/events] Failed to read existing blob:', err)
        }

        const newLines = sessionEvents
          .map((e) => JSON.stringify(e))
          .join('\n')

        const content = existing
          ? existing.trimEnd() + '\n' + newLines + '\n'
          : newLines + '\n'

        await put(blobPath, content, {
          access: 'private',
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: 'application/x-ndjson',
          token,
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
