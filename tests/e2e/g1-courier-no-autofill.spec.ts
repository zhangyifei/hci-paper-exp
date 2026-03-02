import { test, expect } from '@playwright/test'
import {
  goToCondition,
  completeRidePhase,
  assertNoBanner,
  advanceToService2,
} from './shared/helpers'

test.describe('G1 — Ride + Courier, No Auto-fill', () => {
  test.beforeEach(async ({ page }) => {
    await goToCondition(page, 'G1')
  })

  test('lands on experiment page for G1', async ({ page }) => {
    await expect(page).toHaveURL(/\/experiment\/G1/)
    await expect(page.getByTestId('btn-start-ride')).toBeVisible()
  })

  test('home screen shows correct content', async ({ page }) => {
    await expect(page.getByText('Where to?')).toBeVisible()
    await expect(page.getByText('Start a Ride')).toBeVisible()
    // Uber/Eats/Courier tab bar visible
    await expect(page.getByText('Rides', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Eats', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Courier')).toBeVisible()
  })

  test('ride phase completes and shows Trip Complete', async ({ page }) => {
    await completeRidePhase(page)
    await expect(page.getByText('Trip Complete', { exact: true })).toBeVisible()
    await expect(page.getByText('Rue Saint-Laurent')).toBeVisible()
    await expect(page.getByText('$28.92')).toBeVisible()
  })

  test('G1 Trip Complete: no banner shown', async ({ page }) => {
    await completeRidePhase(page)
    await assertNoBanner(page)
    // Footnote text visible for G1
    await expect(page.getByText(/Tap.*Done.*to go home/)).toBeVisible()
  })

  test('G1 Courier Entry: sender address is empty (no auto-fill)', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    // Courier tab active
    await expect(page.getByText('Courier')).toBeVisible()

    // Sender address field is empty placeholder
    await expect(page.getByTestId('sender-address-empty')).toBeVisible()
    await expect(page.getByTestId('sender-address-autofilled')).not.toBeVisible()
  })

  test('G1 Courier Entry: shows generic pricing options (Small/Medium/Large)', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await expect(page.getByTestId('pickup-option-small')).toBeVisible()
    await expect(page.getByTestId('pickup-option-medium')).toBeVisible()
    await expect(page.getByTestId('pickup-option-large')).toBeVisible()

    // G1-specific labels
    await expect(page.getByText('Small')).toBeVisible()
    await expect(page.getByText('$8')).toBeVisible()
    await expect(page.getByText('Medium')).toBeVisible()
    await expect(page.getByText('$12')).toBeVisible()
    await expect(page.getByText('Large')).toBeVisible()
    await expect(page.getByText('$24')).toBeVisible()
  })

  test('G1 full flow: Confirm pickup → Delivery → Delivery Complete', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    // Select first option and confirm
    await page.getByTestId('pickup-option-small').click()
    await page.getByTestId('btn-confirm-pickup').click()

    // Delivery in progress screen
    await expect(page.getByText(/Your delivery is.*almost here/i)).toBeVisible({ timeout: 5000 })

    // Auto-advances to Delivery Complete
    await page.waitForTimeout(3000)
    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 5000 })

    // No "Popular nearby" section for G1
    await expect(page.getByText('Popular nearby')).not.toBeVisible()
  })
})
