import 'server-only'

import type { NextRequest } from 'next/server'

/**
 * Admin authorization for the batch-management and stats surfaces.
 *
 * Accepts either the `x-stats-password` header (used by the dashboard UIs) or a
 * `Bearer` token, checked against PAPER_STATS_SECRET (falling back to
 * STATS_SECRET). If no secret is configured, access is denied.
 */
export function isAdminAuthorized(req: NextRequest): boolean {
  const secret = process.env.PAPER_STATS_SECRET ?? process.env.STATS_SECRET
  if (!secret) return false

  const passwordHeader = req.headers.get('x-stats-password')
  if (passwordHeader && passwordHeader === secret) return true

  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}
