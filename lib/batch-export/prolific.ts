import 'server-only'

const PROLIFIC_API = 'https://api.prolific.com/api/v1'
const PROLIFIC_ID = /^[a-f0-9]{24}$/
const REQUEST_TIMEOUT_MS = 10_000
const MAX_SUBMISSION_PAGES = 20

export interface ProlificSubmission {
  participant_id: string
  status: string
  study_code?: string | null
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
