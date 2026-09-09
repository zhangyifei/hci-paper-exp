import { test, expect } from '@playwright/test'
import {
  goToCondition,
  completeRidePhase,
  assertNoBanner,
  advanceToService2,
  completeMovieEntry,
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
    await expect(page.getByText(/Back to Home.*return home.*explore other services/i)).toBeVisible()
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
  })

  test('G3 location can be filled by tapping a saved place', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await expect(page.getByTestId('movie-saved-places')).toBeVisible()
    await page.getByTestId('movie-saved-saint-catherine').click({ force: true })
    await expect(page.getByTestId('input-movie-location')).toHaveValue('1000 Saint-Catherine Street West')
  })

  test('G3 Movie Entry: shows popular (citywide) cinema list', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await expect(page.getByText('Popular cinemas')).toBeVisible()
    await expect(page.getByText('Cinéma StarCité')).toBeVisible()
    await expect(page.getByText('Cinéma IMAX du Centre')).toBeVisible()

    // No distance pills for the citywide list.
    await expect(page.getByText('0.4 km')).not.toBeVisible()
  })

  test('G3 full flow: location → showtime → seats → Tickets Booked', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await completeMovieEntry(page)

    await expect(page.getByText('Tickets Booked!', { exact: true })).toBeVisible({ timeout: 5000 })
    // No "Explore More" for G3.
    await expect(page.getByText('Explore More')).not.toBeVisible()
  })
})
