import { test, expect } from '@playwright/test'
import {
  goToCondition,
  completeRidePhase,
  assertBannerVisible,
  advanceToService2,
} from './shared/helpers'

test.describe('G4 — Ride + Eats, Auto-fill', () => {
  test.beforeEach(async ({ page }) => {
    await goToCondition(page, 'G4')
  })

  test('lands on experiment page for G4', async ({ page }) => {
    await expect(page).toHaveURL(/\/experiment\/G4/)
    await expect(page.getByTestId('btn-start-ride')).toBeVisible()
  })

  test('G4 Trip Complete: eats banner shown with Eat CTA', async ({ page }) => {
    await completeRidePhase(page)

    await assertBannerVisible(page, 'Eat')
    await expect(page.getByText(/Arrived at your destination/i)).toBeVisible()
    await expect(page.getByText(/3\+ restaurants nearby/i)).toBeVisible()

    // No footnote
    await expect(page.getByText(/To continue, tap/)).not.toBeVisible()
  })

  test('G4 banner CTA navigates to Eats Entry', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true) // via Eat banner

    // Should now be on eats entry — Eats tab active
    await expect(page.getByText('Delivery')).toBeVisible()
    await expect(page.getByText('Pickup')).toBeVisible()
  })

  test('G4 Eats Entry: delivery address auto-populated', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    // Auto-filled address visible
    await expect(page.getByTestId('deliver-address-autofilled')).toBeVisible()
    await expect(page.getByTestId('deliver-address-empty')).not.toBeVisible()

    // Address content
    await expect(page.getByText('Rue Saint-Laurent - spot 01')).toBeVisible()
    await expect(page.getByText(/Near 100 Rue saint-LAURENT/i)).toBeVisible()

    // Edit link
    await expect(page.getByText('[Edit]')).toBeVisible()
  })

  test('G4 Eats Entry: shows distance-filtered nearby restaurant list', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    // G4 header: "Nearby Popular"
    await expect(page.getByText('Nearby Popular')).toBeVisible()
    // "Popular" badge
    await expect(page.getByText('Popular').first()).toBeVisible()

    // Restaurants listed
    await expect(page.getByText('Souvlaki Bar')).toBeVisible()
    await expect(page.getByText('Pop-Pop')).toBeVisible()

    // Distance pills present for G4
    await expect(page.getByText('0.9km')).toBeVisible()
    await expect(page.getByText('0.5km')).toBeVisible()
  })

  test('G4 full flow: select restaurant → restaurant page → order → complete with Explore More', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    // Tap Pop-Pop
    await page.getByText('Pop-Pop').first().click()

    // Restaurant detail page
    await expect(page.getByTestId('btn-order-food')).toBeVisible()

    // Tap Order Food
    await page.getByTestId('btn-order-food').click()

    // Complete screen
    await expect(page.getByText('Enjoy your order 🎉')).toBeVisible({ timeout: 5000 })

    // G4-specific: "Explore More Serves" section
    await expect(page.getByText('Explore More Services')).toBeVisible()
  })
})
