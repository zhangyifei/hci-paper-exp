import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { claimExternalInvite, type ExternalClaimRow } from '@/lib/external-invites'

async function claimRpc(tokenHash: string, expSessionId: string): Promise<ExternalClaimRow | null> {
  const { data, error } = await supabaseAdmin.rpc('claim_external_invite', {
    p_token_hash: tokenHash,
    p_exp_session: expSessionId,
  })
  if (error) throw error
  return ((Array.isArray(data) ? data[0] : data) ?? null) as ExternalClaimRow | null
}

const STATUS = { claimed: 200, used: 409, closed: 409, full: 409, invalid_invite: 400 } as const

/** Single-use external (non-Prolific) invite → server-assigned batch cell. */
export async function POST(req: NextRequest) {
  let body: { invite?: unknown; expSessionId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { outcome: 'invalid_invite', condition: null, participantId: null },
      { status: 400 },
    )
  }

  try {
    const result = await claimExternalInvite(body?.invite, body?.expSessionId, claimRpc)
    return NextResponse.json(result, { status: STATUS[result.outcome] })
  } catch (error) {
    console.error('[api/external/claim] claim failed:', error)
    return NextResponse.json({ error: 'claim_failed' }, { status: 500 })
  }
}
