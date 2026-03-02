import { NextRequest, NextResponse } from 'next/server'
import { assignCondition } from '@/lib/assignment'


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const pid = searchParams.get('pid') ?? 'anonymous'
  const override = searchParams.get('condition')

  const condition = assignCondition(pid, override)
  return NextResponse.json({ condition, pid })
}
