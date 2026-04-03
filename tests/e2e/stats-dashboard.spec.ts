import { test, expect } from '@playwright/test'

import {
  computePaperStats,
  type PaperStatsEventRow,
} from '../../lib/paper-stats/analysis'

function makeSurveyPayload(
  aggregates: {
    cognitive_load_mean: number
    usability_mean: number
    continuance_mean: number
    manipulation_check_mean: number
  },
  responses: { DEM1: string; DEM2: string; FAM1: string },
) {
  return { aggregates, responses }
}

function makeRow(overrides: Partial<PaperStatsEventRow>): PaperStatsEventRow {
  return {
    id: 1,
    event_name: 'questionnaire.completed',
    session_id: 'session-default',
    participant_id: 'participant-default',
    sequence_id: 1,
    flow: 'service2',
    state: 'finished',
    timestamp: 1_000,
    client_mono_ms: 1_000,
    duration_ms: null,
    payload: null,
    condition: 'G1',
    prolific_study_id: 'study-real',
    prolific_session_id: 'session-real',
    created_at: '2026-04-02T00:00:00.000Z',
    ...overrides,
  }
}

test.describe('Stats dashboard access', () => {
  test('computePaperStats excludes bot sessions from survey and demographic aggregates', async () => {
    const rows: PaperStatsEventRow[] = [
      makeRow({
        id: 1,
        session_id: 'session-real',
        participant_id: 'participant-real',
        condition: 'G1',
        payload: makeSurveyPayload(
          {
            cognitive_load_mean: 2,
            usability_mean: 6,
            continuance_mean: 5,
            manipulation_check_mean: 4,
          },
          { DEM1: '25-34', DEM2: 'female', FAM1: 'weekly' },
        ),
      }),
      makeRow({
        id: 2,
        session_id: 'session-bot',
        participant_id: 'BOT_PARTICIPANT',
        condition: 'G1',
        prolific_study_id: 'BOT_STUDY',
        prolific_session_id: 'BOT_SESSION',
        payload: makeSurveyPayload(
          {
            cognitive_load_mean: 7,
            usability_mean: 1,
            continuance_mean: 1,
            manipulation_check_mean: 7,
          },
          { DEM1: '55-64', DEM2: 'male', FAM1: 'never' },
        ),
      }),
    ]

    const stats = computePaperStats(rows)

    expect(stats.surveyByCondition.G1?.n).toBe(1)
    expect(stats.surveyByCondition.G1?.cognitiveLoad.values).toEqual([2])
    expect(stats.demographics.ages).toEqual({ '25-34': 1 })
    expect(stats.demographics.genders).toEqual({ female: 1 })
    expect(stats.demographics.famFreqs).toEqual({ weekly: 1 })
  })

  test('computePaperStats returns null comparison stats for empty groups', async () => {
    const stats = computePaperStats([])

    expect(stats.heterogeneityComparison.low).toEqual({
      label: 'Low (G1+G2 Courier)',
      n: 0,
      cl: { mean: null, sd: null },
      pu: { mean: null, sd: null },
      ci: { mean: null, sd: null },
    })
    expect(stats.interrelatednessComparison.bridge).toEqual({
      label: 'High (G2+G4 bridge)',
      n: 0,
      cl: { mean: null, sd: null },
      pu: { mean: null, sd: null },
      ci: { mean: null, sd: null },
      mc: { mean: null, sd: null },
    })
  })

  test('stats page renders the password gate', async ({ page }) => {
    await page.goto('/stats')

    await expect(page.getByText('Experiment Results')).toBeVisible()
    await expect(page.getByPlaceholder('Access password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Access Dashboard' })).toBeVisible()
  })

  test('paper stats API rejects requests without a password header', async ({ request }) => {
    const response = await request.get('/api/paper-stats')

    expect(response.status()).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  test('stats page renders returned stats after successful auth', async ({ page }) => {
    await page.route('**/api/paper-stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: '2026-04-02T12:00:00.000Z',
          overview: {
            totalRows: 4,
            totalSessions: 2,
            botSessions: 0,
            realSessions: 2,
            completedRealSessions: 1,
            completionRate: 50,
          },
          sessionDetail: [
            {
              sessionId: 'session-1',
              condition: 'G1',
              participantId: 'participant-1',
              isBot: false,
              eventCount: 10,
              navLagS: 5.5,
              s2DurS: 25.2,
              bannerTapped: false,
              completed: true,
            },
          ],
          conditionStats: {
            G1: {
              total: 1,
              completed: 1,
              completionRate: 100,
              navLag: { mean: 5.5, sd: 0, median: 5.5, min: 5.5, max: 5.5, n: 1, values: [5.5] },
              s2Dur: { mean: 25.2, sd: 0, median: 25.2, min: 25.2, max: 25.2, n: 1, values: [25.2] },
              bannerUptake: null,
            },
            G2: {
              total: 0,
              completed: 0,
              completionRate: 0,
              navLag: null,
              s2Dur: null,
              bannerUptake: { used: 0, total: 0 },
            },
            G3: {
              total: 1,
              completed: 0,
              completionRate: 0,
              navLag: null,
              s2Dur: null,
              bannerUptake: null,
            },
            G4: {
              total: 0,
              completed: 0,
              completionRate: 0,
              navLag: null,
              s2Dur: null,
              bannerUptake: { used: 0, total: 0 },
            },
          },
          surveyByCondition: { G1: null, G2: null, G3: null, G4: null },
          heterogeneityComparison: {
            low: {
              label: 'Low (G1+G2 Courier)',
              n: 0,
              cl: { mean: null, sd: null },
              pu: { mean: null, sd: null },
              ci: { mean: null, sd: null },
            },
            high: {
              label: 'High (G3+G4 Eats)',
              n: 0,
              cl: { mean: null, sd: null },
              pu: { mean: null, sd: null },
              ci: { mean: null, sd: null },
            },
          },
          interrelatednessComparison: {
            noBridge: {
              label: 'Low (G1+G3 no bridge)',
              n: 0,
              cl: { mean: null, sd: null },
              pu: { mean: null, sd: null },
              ci: { mean: null, sd: null },
              mc: { mean: null, sd: null },
            },
            bridge: {
              label: 'High (G2+G4 bridge)',
              n: 0,
              cl: { mean: null, sd: null },
              pu: { mean: null, sd: null },
              ci: { mean: null, sd: null },
              mc: { mean: null, sd: null },
            },
          },
          demographics: { ages: {}, genders: {}, famFreqs: {} },
          eventNameCounts: { 'trip_complete.viewed': 1 },
        }),
      })
    })

    await page.goto('/stats')
    await page.getByPlaceholder('Access password').fill('correct-password')
    await page.getByRole('button', { name: 'Access Dashboard' }).click()

    await expect(page.getByText('HCI Experiment · Results')).toBeVisible()
    const dbRowsCard = page.getByText('DB Rows').locator('..')
    await expect(dbRowsCard).toContainText('4')
    await expect(page.getByText('Table 4a. Heterogeneity Comparison')).toBeVisible()
    const lowHeterogeneityRow = page.locator('table').filter({
      has: page.getByText('Low (G1+G2 Courier)'),
    })
    await expect(lowHeterogeneityRow.first()).toContainText('—')
  })
})
