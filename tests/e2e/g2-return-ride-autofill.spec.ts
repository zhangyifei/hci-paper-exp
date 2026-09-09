import { test, expect } from '@playwright/test'
import {
  goToCondition,
  completeRidePhase,
  assertBannerVisible,
  advanceToService2,
  completeReturnRideEntry,
} from './shared/helpers'

test.describe('G2 — Ride + Return ride, Auto-fill', () => {
  test.beforeEach(async ({ page }) => {
    await goToCondition(page, 'G2')
  })

  test('lands on experiment page for G2', async ({ page }) => {
    await expect(page).toHaveURL(/\/experiment\/G2/)
    await expect(page.getByTestId('btn-start-ride')).toBeVisible()
  })

  test('G2 Trip Complete: return-ride banner shown with Book Ride CTA', async ({ page }) => {
    await completeRidePhase(page)

    await assertBannerVisible(page, 'Book Ride')
    await expect(page.getByText(/Heading back later/i)).toBeVisible()
    await expect(page.getByText(/return ride from 1000 Saint-Catherine Street West/i)).toBeVisible()
  })

  test('G2 banner CTA navigates to Return-ride Entry', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true) // via banner

    await expect(page.getByTestId('screen-return-ride-entry')).toBeVisible()
    await expect(page.getByText('Book a return ride')).toBeVisible()
  })

  test('G2 Return-ride Entry: pickup address auto-populated', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    await expect(page.getByTestId('pickup-address-autofilled')).toBeVisible()
    await expect(page.getByText('SUGGESTED')).toBeVisible()
    await expect(page.getByText(/Downtown, Montreal/i)).toBeVisible()
    await expect(page.getByText('1000 Saint-Catherine Street West')).toBeVisible()
  })

  test('G2 Return-ride Entry: shows ride tiers', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    await expect(page.getByTestId('ride-tier-economy')).toBeVisible()
    await expect(page.getByTestId('ride-tier-comfort')).toBeVisible()
    await expect(page.getByTestId('ride-tier-xl')).toBeVisible()
  })

  test('G2 full flow: Confirm ride → Ride Confirmed with Explore More', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    await completeReturnRideEntry(page)

    await expect(page.getByText('Ride Confirmed!', { exact: true })).toBeVisible({ timeout: 5000 })
    // G2-specific: Explore More section (bridge cell).
    await expect(page.getByText('Explore More')).toBeVisible()
  })
})
