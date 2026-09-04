import { NextRequest, NextResponse } from 'next/server'

/**
 * Shared study passcode gate. The code is shown on the Prolific study page and
 * validated here (server-only env var) so it never ships in the client bundle.
 * When STUDY_PASSCODE is unset the gate is disabled (open access).
 */
export function GET() {
  return NextResponse.json({ enabled: Boolean(process.env.STUDY_PASSCODE) })
}

export async function POST(req: NextRequest) {
  const expected = (process.env.STUDY_PASSCODE ?? '').trim()
  if (!expected) return NextResponse.json({ ok: true, enabled: false })

  let body: { passcode?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const provided = typeof body.passcode === 'string' ? body.passcode.trim() : ''
  const ok = provided.length > 0 && provided.toLowerCase() === expected.toLowerCase()
  return NextResponse.json({ ok, enabled: true }, { status: ok ? 200 : 401 })
}
