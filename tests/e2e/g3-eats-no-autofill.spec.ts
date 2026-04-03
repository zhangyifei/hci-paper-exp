import { test, expect } from '@playwright/test'
import {
  goToCondition,
  completeRidePhase,
  assertNoBanner,
  advanceToService2,
} from './shared/helpers'

test.describe('G3 — Ride + Eats, No Auto-fill', () => {
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
    // Footnote visible
    await expect(page.getByText(/Back to Home.*return home.*explore other services/i)).toBeVisible()
  })

  test('G3 Eats Entry: delivery address is empty (no auto-fill)', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    // Empty address field
    await expect(page.getByTestId('deliver-address-empty')).toBeVisible()
    await expect(page.getByTestId('deliver-address-autofilled')).not.toBeVisible()

    // Placeholder text
    await expect(page.getByText('Enter delivery address')).toBeVisible()
  })

  test('G3 Eats Entry: shows citywide popular restaurant list', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    // G3 header: "Top Rated"
    await expect(page.getByText('Top Rated')).toBeVisible()

    // Restaurants listed
    await expect(page.getByText('Souvlaki Bar')).toBeVisible()
    await expect(page.getByText('Pop-Pop')).toBeVisible()

    // No distance pills for G3
    await expect(page.getByText('0.9 km')).not.toBeVisible()
    await expect(page.getByText('0.5 km')).not.toBeVisible()

    // Cuisine filters
    await expect(page.getByText('Asian')).toBeVisible()
    await expect(page.getByText('Healthy')).toBeVisible()
  })

  test('G3 full flow: select restaurant → restaurant page → order → complete', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    // Tap Souvlaki Bar
    await page.getByText('Souvlaki Bar').first().click()

    // Restaurant detail page
    await expect(page.getByText('Souvlaki Bar')).toBeVisible()
    await expect(page.getByTestId('btn-order-food')).toBeVisible()

    // Tap Order Food
    await page.getByTestId('btn-order-food').click()

    // Complete screen
    await expect(page.getByText('Order Confirmed')).toBeVisible({ timeout: 5000 })

    // No "Explore More" for G3
    await expect(page.getByText('Explore More')).not.toBeVisible()
  })
})
