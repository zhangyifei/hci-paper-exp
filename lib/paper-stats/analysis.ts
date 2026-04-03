import type { Condition } from '../experiment-config'

export const CONDITIONS: Condition[] = ['G1', 'G2', 'G3', 'G4']

export interface PaperStatsEventRow {
  id: number
  event_name: string
  session_id: string
  participant_id: string
  sequence_id: number
  flow: string
  state: string
  timestamp: number
  client_mono_ms: number
  duration_ms: number | null
  payload: Record<string, unknown> | null
  condition: Condition
  prolific_study_id: string | null
  prolific_session_id: string | null
  created_at: string
}

export interface SurveyAggregates {
  cognitive_load_mean: number
  usability_mean: number
  continuance_mean: number
  manipulation_check_mean: number
}

export interface SurveyResponses {
  DEM1?: string
  DEM2?: string
  FAM1?: string
}

export interface NumericSummary {
  mean: number
  sd: number
  median: number
  min: number
  max: number
  n: number
  values: number[]
}

export interface BannerUptake {
  used: number
  total: number
}

export interface ConditionStats {
  total: number
  completed: number
  completionRate: number
  navLag: NumericSummary | null
  s2Dur: NumericSummary | null
  bannerUptake: BannerUptake | null
}

export interface SurveyConditionStats {
  n: number
  cognitiveLoad: { mean: number; sd: number; values: number[] }
  usability: { mean: number; sd: number; values: number[] }
  continuance: { mean: number; sd: number; values: number[] }
  manipCheck: { mean: number; sd: number; values: number[] }
}

export interface GroupComparison {
  label: string
  n: number
  cl: { mean: number | null; sd: number | null }
  pu: { mean: number | null; sd: number | null }
  ci: { mean: number | null; sd: number | null }
  mc?: { mean: number | null; sd: number | null }
}

export interface SessionDetail {
  sessionId: string
  condition: Condition
  participantId: string
  isBot: boolean
  eventCount: number
  navLagS: number | null
  s2DurS: number | null
  bannerTapped: boolean
  completed: boolean
}

export interface PaperStatsSummary {
  overview: {
    totalRows: number
    totalSessions: number
    botSessions: number
    realSessions: number
    completedRealSessions: number
    completionRate: number
  }
  sessionDetail: SessionDetail[]
  conditionStats: Record<Condition, ConditionStats>
  surveyByCondition: Record<Condition, SurveyConditionStats | null>
  heterogeneityComparison: {
    low: GroupComparison
    high: GroupComparison
  }
  interrelatednessComparison: {
    noBridge: GroupComparison
    bridge: GroupComparison
  }
  demographics: {
    ages: Record<string, number>
    genders: Record<string, number>
    famFreqs: Record<string, number>
  }
  eventNameCounts: Record<string, number>
}

export function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

export function sd(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1))
}

export function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function getSurveyAggregates(
  payload: Record<string, unknown> | null,
): SurveyAggregates | null {
  if (!isRecord(payload)) {
    return null
  }

  const aggregates = payload.aggregates
  if (!isRecord(aggregates)) {
    return null
  }

  const cognitiveLoad = aggregates.cognitive_load_mean
  const usability = aggregates.usability_mean
  const continuance = aggregates.continuance_mean
  const manipulationCheck = aggregates.manipulation_check_mean

  if (
    typeof cognitiveLoad !== 'number' ||
    typeof usability !== 'number' ||
    typeof continuance !== 'number' ||
    typeof manipulationCheck !== 'number'
  ) {
    return null
  }

  return {
    cognitive_load_mean: cognitiveLoad,
    usability_mean: usability,
    continuance_mean: continuance,
    manipulation_check_mean: manipulationCheck,
  }
}

export function getSurveyResponses(
  payload: Record<string, unknown> | null,
): SurveyResponses | null {
  if (!isRecord(payload)) {
    return null
  }

  const responses = payload.responses
  if (!isRecord(responses)) {
    return null
  }

  return {
    DEM1: typeof responses.DEM1 === 'string' ? responses.DEM1 : undefined,
    DEM2: typeof responses.DEM2 === 'string' ? responses.DEM2 : undefined,
    FAM1: typeof responses.FAM1 === 'string' ? responses.FAM1 : undefined,
  }
}

export function groupEventsBySession(rows: PaperStatsEventRow[]) {
  const bySession = new Map<string, PaperStatsEventRow[]>()

  for (const row of rows) {
    if (!bySession.has(row.session_id)) {
      bySession.set(row.session_id, [])
    }

    bySession.get(row.session_id)!.push(row)
  }

  return bySession
}

export function isCompletedSession(events: PaperStatsEventRow[]): boolean {
  return events.some(
    (event) => event.event_name === 'experiment.completed' || event.state === 'finished',
  )
}

export function isBotSession(events: PaperStatsEventRow[]): boolean {
  return events.some(
    (event) =>
      event.prolific_study_id?.includes('BOT') ||
      event.prolific_session_id?.includes('BOT') ||
      event.participant_id?.includes('BOT'),
  )
}

function buildNumericSummary(values: number[]): NumericSummary | null {
  if (values.length === 0) {
    return null
  }

  return {
    mean: mean(values),
    sd: sd(values),
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values),
    n: values.length,
    values,
  }
}

function buildMeanSd(values: number[]): { mean: number | null; sd: number | null } {
  if (values.length === 0) {
    return { mean: null, sd: null }
  }

  return {
    mean: mean(values),
    sd: sd(values),
  }
}

export function computePaperStats(rows: PaperStatsEventRow[]): PaperStatsSummary {
  const bySession = groupEventsBySession(rows)
  const botSessionIds = new Set<string>()

  for (const [sessionId, events] of bySession) {
    if (isBotSession(events)) {
      botSessionIds.add(sessionId)
    }
  }

  const sessionDetail = [...bySession.entries()].map(([sessionId, events]) => {
    const sorted = [...events].sort((a, b) => a.sequence_id - b.sequence_id)
    const tripComplete = sorted.find((event) => event.event_name === 'trip_complete.viewed')
    const service2Entry = sorted.find((event) => event.event_name === 'service2.entry')
    const taskComplete = sorted.find((event) => event.event_name === 'service2.task.complete')
    const bannerTap = sorted.find((event) => event.event_name === 'trip_complete.banner_tapped')

    return {
      sessionId,
      condition: sorted[0].condition,
      participantId: sorted[0].participant_id,
      isBot: botSessionIds.has(sessionId),
      eventCount: sorted.length,
      navLagS:
        tripComplete && service2Entry
          ? (service2Entry.timestamp - tripComplete.timestamp) / 1000
          : null,
      s2DurS: taskComplete?.duration_ms ? taskComplete.duration_ms / 1000 : null,
      bannerTapped: !!bannerTap,
      completed: isCompletedSession(sorted),
    }
  })

  const conditionStats = Object.fromEntries(
    CONDITIONS.map((condition) => {
      const sessions = sessionDetail.filter(
        (session) => session.condition === condition && !session.isBot,
      )
      const completed = sessions.filter((session) => session.completed)
      const navLags = completed
        .filter((session) => session.navLagS !== null && session.navLagS > 0)
        .map((session) => session.navLagS!)
      const taskDurations = completed
        .filter((session) => session.s2DurS !== null && session.s2DurS > 0)
        .map((session) => session.s2DurS!)

      return [
        condition,
        {
          total: sessions.length,
          completed: completed.length,
          completionRate: sessions.length > 0 ? (completed.length / sessions.length) * 100 : 0,
          navLag: buildNumericSummary(navLags),
          s2Dur: buildNumericSummary(taskDurations),
          bannerUptake:
            condition === 'G2' || condition === 'G4'
              ? {
                  used: completed.filter((session) => session.bannerTapped).length,
                  total: completed.length,
                }
              : null,
        } satisfies ConditionStats,
      ]
    }),
  ) as Record<Condition, ConditionStats>

  const surveyRows = rows.filter(
    (row) =>
      !botSessionIds.has(row.session_id) &&
      (row.event_name === 'questionnaire.completed' || row.event_name === 'survey.completed') &&
      getSurveyAggregates(row.payload) !== null,
  )

  const surveyByCondition = Object.fromEntries(
    CONDITIONS.map((condition) => {
      const aggregates = surveyRows
        .filter((row) => row.condition === condition)
        .map((row) => getSurveyAggregates(row.payload))
        .filter((aggregate): aggregate is SurveyAggregates => aggregate !== null)

      if (aggregates.length === 0) {
        return [condition, null]
      }

      const cl = aggregates.map((aggregate) => aggregate.cognitive_load_mean)
      const us = aggregates.map((aggregate) => aggregate.usability_mean)
      const ci = aggregates.map((aggregate) => aggregate.continuance_mean)
      const mc = aggregates.map((aggregate) => aggregate.manipulation_check_mean)

      return [
        condition,
        {
          n: aggregates.length,
          cognitiveLoad: { mean: mean(cl), sd: sd(cl), values: cl },
          usability: { mean: mean(us), sd: sd(us), values: us },
          continuance: { mean: mean(ci), sd: sd(ci), values: ci },
          manipCheck: { mean: mean(mc), sd: sd(mc), values: mc },
        } satisfies SurveyConditionStats,
      ]
    }),
  ) as Record<Condition, SurveyConditionStats | null>

  const allSurveys = surveyRows
    .map((row) => ({
      condition: row.condition,
      ...(getSurveyAggregates(row.payload) ?? {}),
    }))
    .filter((survey) => 'cognitive_load_mean' in survey) as Array<
    { condition: Condition } & SurveyAggregates
  >

  const low = allSurveys.filter(
    (survey) => survey.condition === 'G1' || survey.condition === 'G2',
  )
  const high = allSurveys.filter(
    (survey) => survey.condition === 'G3' || survey.condition === 'G4',
  )
  const noBridge = allSurveys.filter(
    (survey) => survey.condition === 'G1' || survey.condition === 'G3',
  )
  const bridge = allSurveys.filter(
    (survey) => survey.condition === 'G2' || survey.condition === 'G4',
  )

  const heterogeneityComparison = {
    low: {
      label: 'Low (G1+G2 Courier)',
      n: low.length,
      cl: buildMeanSd(low.map((survey) => survey.cognitive_load_mean)),
      pu: buildMeanSd(low.map((survey) => survey.usability_mean)),
      ci: buildMeanSd(low.map((survey) => survey.continuance_mean)),
    },
    high: {
      label: 'High (G3+G4 Eats)',
      n: high.length,
      cl: buildMeanSd(high.map((survey) => survey.cognitive_load_mean)),
      pu: buildMeanSd(high.map((survey) => survey.usability_mean)),
      ci: buildMeanSd(high.map((survey) => survey.continuance_mean)),
    },
  }

  const interrelatednessComparison = {
    noBridge: {
      label: 'Low (G1+G3 no bridge)',
      n: noBridge.length,
      cl: buildMeanSd(noBridge.map((survey) => survey.cognitive_load_mean)),
      pu: buildMeanSd(noBridge.map((survey) => survey.usability_mean)),
      ci: buildMeanSd(noBridge.map((survey) => survey.continuance_mean)),
      mc: buildMeanSd(noBridge.map((survey) => survey.manipulation_check_mean)),
    },
    bridge: {
      label: 'High (G2+G4 bridge)',
      n: bridge.length,
      cl: buildMeanSd(bridge.map((survey) => survey.cognitive_load_mean)),
      pu: buildMeanSd(bridge.map((survey) => survey.usability_mean)),
      ci: buildMeanSd(bridge.map((survey) => survey.continuance_mean)),
      mc: buildMeanSd(bridge.map((survey) => survey.manipulation_check_mean)),
    },
  }

  const ages: Record<string, number> = {}
  const genders: Record<string, number> = {}
  const famFreqs: Record<string, number> = {}

  for (const row of rows) {
    if (botSessionIds.has(row.session_id)) {
      continue
    }

    const responses = getSurveyResponses(row.payload)
    if (
      (row.event_name !== 'survey.completed' && row.event_name !== 'questionnaire.completed') ||
      !responses?.DEM1 ||
      !responses.DEM2 ||
      !responses.FAM1
    ) {
      continue
    }

    ages[responses.DEM1] = (ages[responses.DEM1] || 0) + 1
    genders[responses.DEM2] = (genders[responses.DEM2] || 0) + 1
    famFreqs[responses.FAM1] = (famFreqs[responses.FAM1] || 0) + 1
  }

  const eventNameCounts: Record<string, number> = {}
  for (const row of rows) {
    eventNameCounts[row.event_name] = (eventNameCounts[row.event_name] || 0) + 1
  }

  const realSessions = sessionDetail.filter((session) => !session.isBot)
  const completedRealSessions = realSessions.filter((session) => session.completed)

  return {
    overview: {
      totalRows: rows.length,
      totalSessions: sessionDetail.length,
      botSessions: botSessionIds.size,
      realSessions: realSessions.length,
      completedRealSessions: completedRealSessions.length,
      completionRate:
        realSessions.length > 0 ? (completedRealSessions.length / realSessions.length) * 100 : 0,
    },
    sessionDetail,
    conditionStats,
    surveyByCondition,
    heterogeneityComparison,
    interrelatednessComparison,
    demographics: {
      ages,
      genders,
      famFreqs,
    },
    eventNameCounts,
  }
}
