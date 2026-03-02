import { test, expect } from '@playwright/test'
import {
  goToCondition,
  completeRidePhase,
  assertBannerVisible,
  advanceToService2,
} from './shared/helpers'

test.describe('G2 — Ride + Courier, Auto-fill', () => {
  test.beforeEach(async ({ page }) => {
    await goToCondition(page, 'G2')
  })

  test('lands on experiment page for G2', async ({ page }) => {
    await expect(page).toHaveURL(/\/experiment\/G2/)
    await expect(page.getByTestId('btn-start-ride')).toBeVisible()
  })

  test('G2 Trip Complete: courier banner shown with Send Now CTA', async ({ page }) => {
    await completeRidePhase(page)

    await assertBannerVisible(page, 'Send Now')
    await expect(page.getByText(/Need to send a package/i)).toBeVisible()
    await expect(page.getByText(/5\+ Courier drivers available nearby/i)).toBeVisible()

    // No footnote (banner is present)
    await expect(page.getByText(/To continue, tap/)).not.toBeVisible()
  })

  test('G2 banner CTA navigates to Courier Entry', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true) // via banner

    // Courier tab active
    await expect(page.getByText('Courier')).toBeVisible()
  })

  test('G2 Courier Entry: sender address auto-populated', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    // Auto-filled address visible
    await expect(page.getByTestId('sender-address-autofilled')).toBeVisible()
    await expect(page.getByTestId('sender-address-empty')).not.toBeVisible()

    // Address content
    await expect(page.getByText('Rue Saint-Laurent - spot 01')).toBeVisible()
    await expect(page.getByText(/Near 100 Rue saint-LAURENT/i)).toBeVisible()

    // Edit link
    await expect(page.getByText('Edit')).toBeVisible()
  })

  test('G2 Courier Entry: categorized pickup options (Express/Standard)', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    // G2 options
    await expect(page.getByTestId('pickup-option-express')).toBeVisible()
    await expect(page.getByTestId('pickup-option-standard')).toBeVisible()

    await expect(page.getByText('Express (15min)')).toBeVisible()
    await expect(page.getByText('$12')).toBeVisible()
    await expect(page.getByText('Standard (1hr)')).toBeVisible()
    await expect(page.getByText('$8')).toBeVisible()

    // G2 heading: "Choose by Destination"
    await expect(page.getByText('Choose by Destination')).toBeVisible()
  })

  test('G2 full flow: Confirm pickup → Delivery Complete with Popular nearby', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    // Select express option
    await page.getByTestId('pickup-option-express').click()
    await page.getByTestId('btn-confirm-pickup').click()

    // Delivery in progress
    await expect(page.getByText(/Your delivery is.*almost here/i)).toBeVisible({ timeout: 5000 })

    // Auto-advances
    await page.waitForTimeout(3000)
    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 5000 })

    // G2-specific: Popular nearby section
    await expect(page.getByText('Popular nearby')).toBeVisible()
  })
})
