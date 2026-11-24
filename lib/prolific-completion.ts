import { isProlificId } from '@/lib/prolific-identity'

/** Return an identifier only when all recorded nonempty values agree. */
export function uniqueProlificId(values: Iterable<string | null | undefined>): string | null {
  const ids = new Set<string>()
  for (const value of values) {
    if (!value) continue
    if (!isProlificId(value)) return null
    ids.add(value)
  }
  return ids.size === 1 ? [...ids][0] : null
}

/**
 * Only a researcher-operated COMPLETED code with manual review can be used by
 * the server. Never choose a participant code or a path with payment or other
 * automatic actions, and fail closed if more than one candidate exists.
 */
export function researcherCompletionCode(completionCodes: unknown): string | null {
  if (!Array.isArray(completionCodes)) return null

  const candidates: string[] = []
  for (const item of completionCodes) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Record<string, unknown>
    const actions: unknown = entry.actions
    if (
      entry.actor !== 'researcher' ||
      entry.code_type !== 'COMPLETED' ||
      typeof entry.code !== 'string' ||
      !entry.code.trim() ||
      !Array.isArray(actions) ||
      actions.length !== 1 ||
      !actions[0] ||
      typeof actions[0] !== 'object' ||
      (actions[0] as Record<string, unknown>).action !== 'MANUALLY_REVIEW'
    ) {
      continue
    }
    candidates.push(entry.code.trim())
  }
  return candidates.length === 1 ? candidates[0] : null
}

/** Execute a validated server completion using only the submission's own study. */
export async function completeWithResearcherCode(
  submissionId: string | null,
  studyId: string | null,
  dependencies: {
    loadCodes: (studyId: string) => Promise<unknown>
    complete: (submissionId: string, code: string) => Promise<void>
  },
): Promise<boolean> {
  if (!isProlificId(submissionId) || !isProlificId(studyId)) return false
  const code = researcherCompletionCode(await dependencies.loadCodes(studyId))
  if (!code) return false
  await dependencies.complete(submissionId, code)
  return true
}
