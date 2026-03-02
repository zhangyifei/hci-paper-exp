import { NextRequest, NextResponse } from 'next/server'
import { list, get } from '@vercel/blob'

export const runtime = 'edge'

function requireAuth(req: NextRequest): boolean {
  const secret = process.env.STATS_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

// Returns all event batch files concatenated as JSONL (one event per line).
// This endpoint is intentionally expensive in terms of Advanced Requests
// (1 list + N private blob reads) and should only be called once at the
// end of data collection, not during the study.
export async function GET(req: NextRequest) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN

    // 1. List all private event batch blobs — 1 Advanced Request per 1,000 files.
    const blobUrls: string[] = []
    let cursor: string | undefined

    do {
      const page = await list({
        prefix: 'events/',
        limit: 1000,
        cursor,
        token,
      })
      for (const blob of page.blobs) {
        blobUrls.push(blob.url)
      }
      cursor = page.cursor
    } while (cursor)

    if (blobUrls.length === 0) {
      return new Response('', {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Content-Disposition': 'attachment; filename="all_events.jsonl"',
        },
      })
    }

    // 2. Fetch all private blob contents in parallel — 1 Advanced Request each.
    const chunks = await Promise.all(
      blobUrls.map(async (url) => {
        try {
          const blob = await get(url, { access: 'private', token })
          if (!blob?.stream) return ''
          return await new Response(blob.stream).text()
        } catch {
          return ''
        }
      })
    )

    const body = chunks.filter(Boolean).join('')

    return new Response(body, {
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
