const PROLIFIC_ID_PATTERN = /^[a-z0-9]{24}$/i
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const isProlificId = (
  value: string | null | undefined,
): value is string =>
  typeof value === 'string' && PROLIFIC_ID_PATTERN.test(value)

export const isExperimentSessionId = (
  value: string | null | undefined,
): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value)

/**
 * A real Prolific launch supplies three 24-character identifiers. Requiring
 * all of them before assignment prevents missing values or literal URL
 * template placeholders from consuming a balanced-study slot.
 */
export function hasValidProlificAssignmentIdentity(input: {
  participantId?: string | null
  studyId?: string | null
  submissionId?: string | null
  experimentSessionId?: string | null
}): boolean {
  return (
    isProlificId(input.participantId) &&
    isProlificId(input.studyId) &&
    isProlificId(input.submissionId) &&
    isExperimentSessionId(input.experimentSessionId)
  )
}
