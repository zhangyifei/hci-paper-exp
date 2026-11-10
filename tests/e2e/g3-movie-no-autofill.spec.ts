import { test, expect } from '@playwright/test'
import {
  goToCondition,
  completeRidePhase,
  assertNoBanner,
  advanceToService2,
  completeMovieEntry,
  expectPhoneCTAVisibleWithoutScroll,
} from './shared/helpers'

test.describe('G3 — Ride + Movie, No Auto-fill', () => {
  test.beforeEach(async ({ page }) => {
    await goToCondition(page, 'G3')
  })

  test('lands on experiment page for G3', async ({ page }) => {
    await expect(page).toHaveURL(/\/experiment\/G3/)
    await expect(page.getByTestId('btn-start-ride')).toBeVisible()
  })

  test('G3 Trip Complete: no banner shown', async ({ page }) => {
    await completeRidePhase(page)
    await assertNoBanner(page)
    await expect(page.getByTestId('trip-complete-hint')).toHaveCount(0)
    await expect(page.getByText(/Back to Home.*return home.*explore other services/i)).toHaveCount(0)
    await expect(page.getByTestId('trip-complete-map')).toBeVisible()
    await expect(page.getByTestId('guidance-banner')).toContainText(
      "Task reminder: Tap 'Back to Home' to return home and explore other services.",
      { timeout: 12_000 },
    )

    await page.getByTestId('guidance-banner-dismiss').click()
    await page.getByTestId('btn-back-to-home').click({ force: true })
    await expect(page.getByTestId('input-destination')).toBeVisible()
    await expect(page.getByTestId('tab-cinema')).toBeVisible()
    await expect(page.getByTestId('screen-movie-entry')).toHaveCount(0)
    await expect(page.getByTestId('guidance-banner')).toContainText(
      'Task reminder: Tap Cinema to book your movie tickets.',
      { timeout: 12_000 },
    )
  })

  test('G3 Movie Entry: location is empty (no auto-fill)', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await expect(page.getByTestId('movie-location-empty')).toBeVisible()
    await expect(page.getByTestId('movie-location-autofilled')).not.toBeVisible()

    const locationInput = page.getByTestId('input-movie-location')
    await expect(locationInput).toBeVisible()
    await expect(locationInput).toHaveValue('')
    await expect(locationInput).toHaveAttribute('placeholder', 'Enter a location')
    await expect(page.getByText('Popular cinemas', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Cinemas near you', { exact: true })).toHaveCount(0)
    await expect(page.getByTestId('cinema-list')).toHaveCount(0)
  })

  test('G3 location typing shows three related options after three characters', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await expect(page.getByTestId('movie-saved-places')).toHaveCount(0)
    const locationInput = page.getByTestId('input-movie-location')
    await locationInput.fill('10')
    await expect(page.getByTestId('movie-location-suggestions')).toHaveCount(0)

    await locationInput.fill('100')

    const suggestions = page.getByTestId('movie-location-suggestions')
    await expect(suggestions).toBeVisible()
    await expect(suggestions.getByRole('button')).toHaveCount(3)
    await expect(suggestions.getByRole('button').first()).toContainText(
      '1000 Saint-Catherine Street West',
    )
    await expect(suggestions.getByRole('button').first()).toContainText('RECENT')
    await expect(suggestions).toContainText('1001 Rue Sainte-Catherine Est')
    await expect(suggestions).toContainText('100 Rue McGill')
    await expect(suggestions).not.toContainText('Saved & recent')

    await page.getByTestId('movie-location-suggestion-saint-catherine').click()
    await expect(page.getByTestId('input-movie-location')).toHaveValue('1000 Saint-Catherine Street West')
    await expect(page.getByText('Cinemas near you', { exact: true })).toBeVisible()
    await expect(page.getByTestId('cinema-list')).toBeVisible()
    await expect(page.getByTestId('guidance-banner')).toContainText(
      'Task reminder: Enter 1000 Saint-Catherine Street West, then choose a cinema and showtime.',
      { timeout: 12_000 },
    )
  })

  test('G3 Movie Entry: shows nearby cinemas only after the task address is selected', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await expect(page.getByTestId('cinema-list')).toHaveCount(0)
    await page.getByTestId('input-movie-location').fill('1000')
    await page.getByTestId('movie-location-suggestion-saint-catherine').click()

    await expect(page.getByText('Cinemas near you', { exact: true })).toBeVisible()
    await expect(page.getByText('Cineplex Forum')).toBeVisible()
    await expect(page.getByText('Cinéma Banque Scotia')).toBeVisible()
    await expect(page.getByText('0.4 km').first()).toBeVisible()
    await expect(page.getByText('0.7 km').first()).toBeVisible()
  })

  test('G3 Movie Entry: wrong location is logged and must be corrected', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    const locationInput = page.getByTestId('input-movie-location')
    await locationInput.fill('100')
    await page.getByTestId('movie-location-suggestion-saint-catherine-east').click()
    await expect(page.getByTestId('movie-location-error')).toContainText(
      'Use 1000 Saint-Catherine Street West to continue this task.',
    )
    await expect(page.getByTestId('cinema-list')).toHaveCount(0)

    const taskErrors = await page.evaluate(() => {
      const events = JSON.parse(
        sessionStorage.getItem('hci_experiment_events') ?? '[]',
      ) as Array<{ eventName?: string; payload?: { field?: string } }>
      return events.filter((event) => event.eventName === 'task.error')
    })
    expect(taskErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({ field: 'cinema_location' }),
        }),
      ]),
    )

    await locationInput.fill('100')
    await page.getByTestId('movie-location-suggestion-saint-catherine').click()
    await expect(page.getByTestId('movie-location-error')).toHaveCount(0)
    await expect(page.getByTestId('cinema-list')).toBeVisible()
  })

  test('G3 full flow: location → showtime → seats → Tickets Booked', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await completeMovieEntry(page)

    await expect(page.getByText('Tickets Booked!', { exact: true })).toBeVisible({ timeout: 5000 })
    // No "Explore More" for G3.
    await expect(page.getByText('Explore More')).not.toBeVisible()
  })

  test('G3 Cinema CTAs are fully visible without scrolling', async ({ page }) => {
    await completeRidePhase(page)
    await expectPhoneCTAVisibleWithoutScroll(page, 'btn-back-to-home')
    await advanceToService2(page, false)

    await expectPhoneCTAVisibleWithoutScroll(page, 'btn-select-cinema')
    await page.getByTestId('input-movie-location').fill('1000')
    await page.getByTestId('movie-location-suggestion-saint-catherine').click()
    await page.getByTestId('showtime-forum-710').click()
    await page.getByTestId('btn-select-cinema').click()

    await expect(page.getByTestId('screen-movie-seats')).toBeVisible()
    await expectPhoneCTAVisibleWithoutScroll(page, 'btn-confirm-tickets')
  })
})
