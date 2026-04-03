import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Condition = 'G1' | 'G2' | 'G3' | 'G4'

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
    // Get all distinct sessions with their condition
    const { data: allSessions, error: sessErr } = await supabaseAdmin
      .from('experiment_events')
      .select('session_id, condition')
      .order('session_id')

    if (sessErr) {
      console.error('[api/stats] sessions query:', sessErr)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    // Get sessions that have experiment.completed
    const { data: completedSessions, error: compErr } = await supabaseAdmin
      .from('experiment_events')
      .select('session_id')
      .eq('event_name', 'experiment.completed')

    if (compErr) {
      console.error('[api/stats] completed query:', compErr)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    // Deduplicate sessions
    const sessionMap = new Map<string, string>()
    for (const row of allSessions ?? []) {
      if (!sessionMap.has(row.session_id)) {
        sessionMap.set(row.session_id, row.condition)
      }
    }

    const completedIds = new Set(
      (completedSessions ?? []).map((r) => r.session_id)
    )

    const conditions: Condition[] = ['G1', 'G2', 'G3', 'G4']
    const byCondition = Object.fromEntries(
      conditions.map((c) => {
        const sessionsInCondition = [...sessionMap.entries()].filter(
          ([, cond]) => cond === c
        )
        const total = sessionsInCondition.length
        const completed = sessionsInCondition.filter(([sid]) =>
          completedIds.has(sid)
        ).length
        return [
          c,
          {
            total,
            completed,
            completionRate:
              total > 0
                ? Math.round((completed / total) * 10000) / 100
                : 0,
          } satisfies ConditionStat,
        ]
      })
    ) as Record<Condition, ConditionStat>

    const totalSessions = sessionMap.size
    const totalCompleted = [...sessionMap.keys()].filter((sid) =>
      completedIds.has(sid)
    ).length

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      overall: {
        total: totalSessions,
        completed: totalCompleted,
        completionRate:
          totalSessions > 0
            ? Math.round((totalCompleted / totalSessions) * 10000) / 100
            : 0,
      },
      byCondition,
    })
  } catch (err) {
    console.error('[api/stats]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
