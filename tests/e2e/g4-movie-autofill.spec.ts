import { test, expect } from '@playwright/test'
import {
  goToCondition,
  completeRidePhase,
  assertBannerVisible,
  advanceToService2,
  completeMovieEntry,
} from './shared/helpers'

test.describe('G4 — Ride + Movie, Auto-fill', () => {
  test.beforeEach(async ({ page }) => {
    await goToCondition(page, 'G4')
  })

  test('lands on experiment page for G4', async ({ page }) => {
    await expect(page).toHaveURL(/\/experiment\/G4/)
    await expect(page.getByTestId('btn-start-ride')).toBeVisible()
  })

  test('G4 Trip Complete: movie banner shown with Book Tickets CTA', async ({ page }) => {
    await completeRidePhase(page)

    await assertBannerVisible(page, 'Book Tickets')
    await expect(page.getByText(/Catch a movie nearby/i)).toBeVisible()
    await expect(page.getByText(/Cinemas near 1000 Saint-Catherine Street West/i)).toBeVisible()
  })

  test('G4 banner CTA navigates to Movie Entry', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true) // via Book Tickets banner

    await expect(page.getByTestId('screen-movie-entry')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('cinema-list')).toBeVisible()
  })

  test('G4 Movie Entry: location auto-populated', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    await expect(page.getByTestId('movie-location-autofilled')).toBeVisible()
    await expect(page.getByTestId('movie-location-empty')).not.toBeVisible()
    await expect(page.getByText('1000 Saint-Catherine Street West')).toBeVisible()
    await expect(page.getByText(/Downtown, Montreal/i)).toBeVisible()
  })

  test('G4 Movie Entry: shows distance-anchored nearby cinemas', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    await expect(page.getByText('Cinemas near you')).toBeVisible()
    await expect(page.getByText('Cineplex Forum')).toBeVisible()
    // Distance pills present for the nearby list.
    await expect(page.getByText('0.4 km').first()).toBeVisible()
  })

  test('G4 full flow: showtime → seats → Tickets Booked with Explore More', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    await completeMovieEntry(page)

    await expect(page.getByText('Tickets Booked!', { exact: true })).toBeVisible({ timeout: 5000 })
    // G4-specific: Explore More section.
    await expect(page.getByText('Explore More')).toBeVisible()
  })
})
