import { NextRequest, NextResponse } from 'next/server'
import {
  computePaperStats,
  type PaperStatsEventRow,
} from '@/lib/paper-stats/analysis'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function fetchAllRows(): Promise<PaperStatsEventRow[]> {
  const rows: PaperStatsEventRow[] = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('experiment_events')
      .select('*')
      .range(offset, offset + pageSize - 1)
      .order('created_at')

    if (error) throw new Error(`DB error: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...(data as PaperStatsEventRow[]))
    if (data.length < pageSize) break
    offset += pageSize
  }

  return rows
}

function requireStatsAuth(req: NextRequest): boolean {
  const secret = process.env.PAPER_STATS_SECRET ?? process.env.STATS_SECRET
  if (!secret) {
    return false
  }

  const password = req.headers.get('x-stats-password')
  return password === secret
}

export async function GET(req: NextRequest) {
  if (!requireStatsAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rows = await fetchAllRows()
    const stats = computePaperStats(rows)

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      ...stats,
    })
  } catch (err) {
    console.error('[api/paper-stats]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
