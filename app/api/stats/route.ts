import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export const runtime = 'edge'

type Condition = 'G1' | 'G2' | 'G3' | 'G4'

interface SessionStatus {
  sessionId: string
  condition: Condition
  startedAt: number
  completed: boolean
  completedAt: number | null
}

interface ConditionStat {
  total: number
  completed: number
  completionRate: number
}

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
    const token = process.env.BLOB_READ_WRITE_TOKEN

    // Collect all public status blob URLs.
    // list() is one Advanced Request (covers up to 1,000 blobs per page).
    const statusUrls: string[] = []
    let cursor: string | undefined

    do {
      const page = await list({
        prefix: 'stats/',
        limit: 1000,
        cursor,
        token,
      })
      for (const blob of page.blobs) {
        statusUrls.push(blob.url)
      }
      cursor = page.cursor
    } while (cursor)

    if (statusUrls.length === 0) {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        overall: { total: 0, completed: 0, completionRate: 0 },
        byCondition: {
          G1: { total: 0, completed: 0, completionRate: 0 },
          G2: { total: 0, completed: 0, completionRate: 0 },
          G3: { total: 0, completed: 0, completionRate: 0 },
          G4: { total: 0, completed: 0, completionRate: 0 },
        },
      })
    }

    // Fetch all public status files in parallel.
    // Public blob URLs are CDN URLs — these are plain HTTP fetches and do NOT
    // count as Vercel Blob Advanced Requests.
    const statuses = await Promise.all(
      statusUrls.map(async (url) => {
        try {
          const res = await fetch(url)
          if (!res.ok) return null
          return (await res.json()) as SessionStatus
        } catch {
          return null
        }
      })
    )

    const valid = statuses.filter((s): s is SessionStatus => s !== null)

    const conditions: Condition[] = ['G1', 'G2', 'G3', 'G4']
    const byCondition = Object.fromEntries(
      conditions.map((c) => {
        const group = valid.filter((s) => s.condition === c)
        const completedCount = group.filter((s) => s.completed).length
        return [
          c,
          {
            total: group.length,
            completed: completedCount,
            completionRate:
              group.length > 0
                ? Math.round((completedCount / group.length) * 10000) / 100
                : 0,
          } satisfies ConditionStat,
        ]
      })
    ) as Record<Condition, ConditionStat>

    const totalCompleted = valid.filter((s) => s.completed).length

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      overall: {
        total: valid.length,
        completed: totalCompleted,
        completionRate:
          valid.length > 0
            ? Math.round((totalCompleted / valid.length) * 10000) / 100
            : 0,
      },
      byCondition,
    })
  } catch (err) {
    console.error('[api/stats]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
