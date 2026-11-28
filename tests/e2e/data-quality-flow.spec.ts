import { expect, test } from '@playwright/test'
import { EVENT_UPLOAD_MAX_BYTES } from '../../lib/logger'

import {
  advanceToService2,
  completeBackgroundQuestionnaire,
  completeCourierEntry,
  completePostTaskSurvey,
  completeRidePhase,
  goToCondition,
} from './shared/helpers'

test('rapid responses are excluded from analysis but still finish normally', async ({ page }) => {
  const recordedEvents: Array<{
    eventName: string
    payload?: Record<string, unknown>
  }> = []
  const uploadSizes: number[] = []
  await page.route('**/api/events', async (route) => {
    const rawBody = route.request().postData()
    if (rawBody) {
      uploadSizes.push(new TextEncoder().encode(rawBody).byteLength)
      const body = JSON.parse(rawBody) as {
        events?: Array<{ eventName: string; payload?: Record<string, unknown> }>
      }
      recordedEvents.push(...(body.events ?? []))
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  })

  await goToCondition(page, 'G1')
  await completeRidePhase(page)
  await advanceToService2(page)
  await completeCourierEntry(page)
  await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 8_000 })
  await page.getByTestId('btn-service2-done').click({ force: true })
  await completePostTaskSurvey(page)
  await completeBackgroundQuestionnaire(page)

  await expect(page.getByTestId('screen-finished')).toBeVisible({ timeout: 10_000 })
  const qualityEvent = recordedEvents.find((event) => event.eventName === 'data_quality.flagged')
  expect(qualityEvent?.payload?.reasons).toContain('rapid_responses')
  expect(qualityEvent?.payload?.paymentDisposition).toBe('normal_completion')

  const completion = recordedEvents.find((event) => event.eventName === 'experiment.completed')
  expect(completion?.payload?.dataQualityFlagged).toBe(true)
  expect(recordedEvents.some((event) => event.eventName === 'experiment.invalidated')).toBe(false)
  expect(uploadSizes.length).toBeGreaterThan(1)
  expect(Math.max(...uploadSizes)).toBeLessThanOrEqual(EVENT_UPLOAD_MAX_BYTES)
})
