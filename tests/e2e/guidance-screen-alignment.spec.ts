import { expect, test } from '@playwright/test'
import { advanceToService2, completeRidePhase, goToCondition } from './shared/helpers'

test.setTimeout(50_000)

test('ride selection reminder describes choosing and confirming a ride', async ({ page }) => {
  await goToCondition(page, 'G1')
  await page.getByTestId('input-destination').fill('1000 Saint-Catherine Street West')
  await page.getByTestId('btn-start-ride').click({ force: true })

  await expect(page.getByTestId('guidance-banner')).toContainText(
    'Task reminder: Choose a ride option, then confirm your ride.',
    { timeout: 12_000 },
  )
})

test('G1 reminders follow courier entry, details, and completion actions', async ({ page }) => {
  await goToCondition(page, 'G1')
  await completeRidePhase(page)
  await advanceToService2(page, false)

  await expect(page.getByTestId('guidance-banner')).toContainText(
    'Task reminder: Sender: 1000 Saint-Catherine Street West. Recipient: 3008 Rue McGill. Then choose a delivery option.',
    { timeout: 12_000 },
  )
  await page.getByTestId('guidance-banner-dismiss').click()

  await page.getByTestId('input-sender-address').fill('1000 Saint-Catherine Street West')
  await page.getByTestId('input-recipient-address').fill('300')
  await page.getByTestId('recipient-suggestion-rue-mcgill').click({ force: true })
  await page.getByTestId('btn-confirm-courier').click({ force: true })

  await expect(page.getByTestId('guidance-banner')).toContainText(
    'Task reminder: Select the package details, then confirm pickup.',
    { timeout: 12_000 },
  )
  await page.getByTestId('guidance-banner-dismiss').click()
  await page.getByTestId('btn-confirm-pickup').scrollIntoViewIfNeeded()
  await page.getByTestId('btn-confirm-pickup').click()

  await expect(page.getByTestId('guidance-banner')).toContainText(
    'Task reminder: Tap Done to continue.',
    { timeout: 12_000 },
  )
})

test('G3 reminders follow cinema seat and completion actions', async ({ page }) => {
  await goToCondition(page, 'G3')
  await completeRidePhase(page)
  await advanceToService2(page, false)

  await page.getByTestId('input-movie-location').fill('1000')
  await page.getByTestId('movie-location-suggestion-saint-catherine').click()
  await page.getByTestId('showtime-forum-710').click({ force: true })
  await page.getByTestId('btn-select-cinema').click({ force: true })

  await expect(page.getByTestId('guidance-banner')).toContainText(
    'Task reminder: Select 2 seats, then confirm your tickets.',
    { timeout: 12_000 },
  )
  await page.getByTestId('guidance-banner-dismiss').click()
  await page.getByTestId('seat-A1').click({ force: true })
  await page.getByTestId('seat-A2').click({ force: true })
  await page.getByTestId('btn-confirm-tickets').scrollIntoViewIfNeeded()
  await page.getByTestId('btn-confirm-tickets').click()

  await expect(page.getByTestId('guidance-banner')).toContainText(
    'Task reminder: Tap Done to continue.',
    { timeout: 12_000 },
  )
})

test('G4 cinema entry reminder describes its current page action', async ({ page }) => {
  await goToCondition(page, 'G4')
  await completeRidePhase(page)
  await advanceToService2(page, true)

  await expect(page.getByTestId('guidance-banner')).toContainText(
    'Task reminder: Choose a cinema and showtime near 1000 Saint-Catherine Street West.',
    { timeout: 12_000 },
  )
})
