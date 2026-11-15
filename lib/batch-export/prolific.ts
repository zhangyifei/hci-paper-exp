import 'server-only'

const PROLIFIC_API = 'https://api.prolific.com/api/v1'
const PROLIFIC_ID = /^[a-f0-9]{24}$/
const REQUEST_TIMEOUT_MS = 10_000
const MAX_SUBMISSION_PAGES = 20

export interface ProlificSubmission {
  id?: string
  participant_id: string
  status: string
  study_code?: string | null
  return_requested?: string | null
  time_taken?: number | null
  started_at?: string | null
  completed_at?: string | null
}

export interface ProlificStudyInfo {
  name: string
  status: string
  reward: number
  estimated_completion_time: number
  maximum_allowed_time: number
}

export interface ProlificSubmissionDetail {
  id: string
  participant: string | null
  study_id: string
  status: string
  entered_code?: string | null
  return_requested?: string | null
  completed_at?: string | null
}

export type ProlificData =
  | { available: true; studyId: string; study: ProlificStudyInfo; submissions: ProlificSubmission[] }
  | { available: false; studyId: string | null; reason: string }

export const isProlificId = (value: string | null | undefined): value is string =>
  typeof value === 'string' && PROLIFIC_ID.test(value)

async function getJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Token ${token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Prolific API responded ${res.status}`)
  return res.json() as Promise<T>
}

async function postJson<T>(url: string, token: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Prolific API responded ${res.status}`)
  return res.json() as Promise<T>
}

export function completionCodeFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const code = new URL(url).searchParams.get('cc')?.trim()
    return code || null
  } catch {
    return null
  }
}

/**
 * Complete a valid Prolific submission from the server before browser redirect.
 * Prolific documents this transition as idempotent, so a retry is safe.
 */
export async function completeProlificSubmission(
  submissionId: string | null,
  completionCode: string | null,
): Promise<boolean> {
  const token = process.env.PROLIFIC_API_TOKEN
  if (!token || !isProlificId(submissionId) || !completionCode) return false
  try {
    await postJson(`${PROLIFIC_API}/submissions/${submissionId}/transition/`, token, {
      action: 'COMPLETE',
      completion_code: completionCode,
    })
    return true
  } catch (err) {
    console.error('[prolific] completion transition failed:', err)
    return false
  }
}

/** Ask an incomplete participant to return without penalising them. */
export async function requestProlificSubmissionReturn(
  submissionId: string,
): Promise<boolean> {
  const token = process.env.PROLIFIC_API_TOKEN
  if (!token || !isProlificId(submissionId)) return false
  try {
    await postJson(`${PROLIFIC_API}/submissions/${submissionId}/request-return/`, token, {
      request_return_reasons: ['Did not finish study.'],
    })
    return true
  } catch (err) {
    // The completion endpoint intentionally retries after the durable event
    // upload. If the first request succeeded but its response was lost (or a
    // second caller races it), treat Prolific's recorded return request as
    // success instead of surfacing a false failure.
    try {
      const current = await getJson<ProlificSubmissionDetail>(
        `${PROLIFIC_API}/submissions/${submissionId}/`,
        token,
      )
      if (current.return_requested) return true
    } catch {
      // Report the original request failure below.
    }
    console.error('[prolific] return request failed:', err)
    return false
  }
}

/** Retrieve the current source-of-truth submission state for webhook handling. */
export async function getProlificSubmission(
  submissionId: string,
): Promise<ProlificSubmissionDetail> {
  const token = process.env.PROLIFIC_API_TOKEN
  if (!token) throw new Error('PROLIFIC_API_TOKEN is not configured')
  if (!isProlificId(submissionId)) throw new Error('Invalid Prolific submission id')
  return getJson<ProlificSubmissionDetail>(
    `${PROLIFIC_API}/submissions/${submissionId}/`,
    token,
  )
}

/**
 * Optional enrichment: Prolific submission status / timing for the batch's study.
 * Never throws — the export still works without Prolific data.
 */
export async function fetchProlificData(studyId: string | null): Promise<ProlificData> {
  const token = process.env.PROLIFIC_API_TOKEN
  if (!token) return { available: false, studyId, reason: 'PROLIFIC_API_TOKEN is not configured on the server' }
  if (!isProlificId(studyId)) return { available: false, studyId, reason: 'No Prolific study ID recorded for this batch' }

  try {
    const study = await getJson<ProlificStudyInfo>(`${PROLIFIC_API}/studies/${studyId}/`, token)
    const submissions: ProlificSubmission[] = []
    let next: string | null = `${PROLIFIC_API}/studies/${studyId}/submissions/?limit=200`
    for (let page = 0; next && page < MAX_SUBMISSION_PAGES; page++) {
      const body: { results?: ProlificSubmission[]; _links?: { next?: { href?: string | null } } } = await getJson(next, token)
      submissions.push(...(body.results ?? []))
      const href = body._links?.next?.href ?? null
      // Only follow pagination links that stay on the Prolific API host.
      next = href && href.startsWith(`${PROLIFIC_API}/`) ? href : null
    }
    return { available: true, studyId, study, submissions }
  } catch (err) {
    console.error('[batch-export] Prolific fetch failed:', err)
    return { available: false, studyId, reason: 'Prolific API request failed' }
  }
}
