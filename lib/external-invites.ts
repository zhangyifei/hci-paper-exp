import { createHash } from 'node:crypto'
import { CONDITIONS, type Condition } from './experiment-config'
import { isExperimentSessionId } from './prolific-identity'

// 16 random bytes, base64url-encoded (see scripts/external-invites.mjs).
const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/
export const EXTERNAL_PARTICIPANT_PATTERN = /^ext_[0-9a-f]{10}$/

export type ExternalClaimOutcome = 'claimed' | 'used' | 'closed' | 'full' | 'invalid_invite'

export interface ExternalClaimResult {
  outcome: ExternalClaimOutcome
  condition: Condition | null
  participantId: string | null
}

export interface ExternalClaimRow {
  out_outcome: string | null
  out_group: string | null
  out_participant: string | null
}

/** Atomic claim; implemented by the `claim_external_invite` SQL function. */
export type ExternalClaimRpc = (tokenHash: string, expSessionId: string) => Promise<ExternalClaimRow | null>

const OUTCOMES: readonly ExternalClaimOutcome[] = ['claimed', 'used', 'closed', 'full', 'invalid_invite']

export const isInviteToken = (value: unknown): value is string =>
  typeof value === 'string' && INVITE_TOKEN_PATTERN.test(value)

export const isExternalParticipantId = (value: unknown): value is string =>
  typeof value === 'string' && EXTERNAL_PARTICIPANT_PATTERN.test(value)

export const hashInviteToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

const rejected = (outcome: Exclude<ExternalClaimOutcome, 'claimed'>): ExternalClaimResult => ({
  outcome,
  condition: null,
  participantId: null,
})

/**
 * Claim a single-use external invite for one experiment session. The condition
 * and participant ID come only from the stored invite, never from the client.
 */
export async function claimExternalInvite(
  token: unknown,
  expSessionId: unknown,
  rpc: ExternalClaimRpc,
): Promise<ExternalClaimResult> {
  if (!isInviteToken(token) || typeof expSessionId !== 'string' || !isExperimentSessionId(expSessionId)) {
    return rejected('invalid_invite')
  }

  const row = await rpc(hashInviteToken(token), expSessionId)
  const outcome = OUTCOMES.find((value) => value === row?.out_outcome) ?? 'invalid_invite'
  if (outcome !== 'claimed') return rejected(outcome)

  const condition = row?.out_group as Condition
  if (!CONDITIONS.includes(condition) || !isExternalParticipantId(row?.out_participant)) {
    throw new Error('External invite claim returned an invalid assignment')
  }
  return { outcome, condition, participantId: row.out_participant }
}
