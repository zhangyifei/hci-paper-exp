import { test, expect } from '@playwright/test'
import {
  goToCondition,
  completeRidePhase,
  assertNoBanner,
  advanceToService2,
  completeReturnRideEntry,
} from './shared/helpers'

test.describe('G1 — Ride + Return ride, No Auto-fill', () => {
  test.beforeEach(async ({ page }) => {
    await goToCondition(page, 'G1')
  })

  test('lands on experiment page for G1', async ({ page }) => {
    await expect(page).toHaveURL(/\/experiment\/G1/)
    await expect(page.getByTestId('btn-start-ride')).toBeVisible()
  })

  test('home screen shows correct content', async ({ page }) => {
    await expect(page.getByTestId('input-destination')).toBeVisible()
    await expect(page.getByText('Start a Ride')).toBeVisible()
    // Rides / Cinema tab bar visible
    await expect(page.getByText('Rides', { exact: true }).first()).toBeVisible()
    await expect(page.getByTestId('tab-cinema')).toBeVisible()
  })

  test('ride phase completes and shows Trip Complete', async ({ page }) => {
    await completeRidePhase(page)
    await expect(page.getByText('Trip Complete', { exact: true })).toBeVisible()
    await expect(page.getByText('1000 Saint-Catherine Street West')).toBeVisible()
    await expect(page.getByText('$12.59')).toBeVisible()
  })

  test('G1 Trip Complete: no banner shown', async ({ page }) => {
    await completeRidePhase(page)
    await assertNoBanner(page)
    // Footnote text visible for G1
    await expect(page.getByText(/Back to Home.*return home.*explore other services/i)).toBeVisible()
  })

  test('G1 Return-ride Entry: pickup address is empty (no auto-fill)', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await expect(page.getByTestId('pickup-address-empty')).toBeVisible()
    await expect(page.getByTestId('pickup-address-autofilled')).not.toBeVisible()
    await expect(page.getByTestId('input-pickup-address')).toHaveValue('')
    await expect(page.getByText('SUGGESTED')).not.toBeVisible()
  })

  test('G1 Return-ride Entry: shows ride tiers (VoyaX/Comfort/XL)', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await expect(page.getByTestId('ride-tier-economy')).toBeVisible()
    await expect(page.getByTestId('ride-tier-comfort')).toBeVisible()
    await expect(page.getByTestId('ride-tier-xl')).toBeVisible()
    await expect(page.getByText('$10.50')).toBeVisible()
    await expect(page.getByText('$15.00')).toBeVisible()
    await expect(page.getByText('$22.00')).toBeVisible()
  })

  test('G1 full flow: Confirm ride → Driver confirm → Ride Confirmed', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await completeReturnRideEntry(page)

    await expect(page.getByText('Ride Confirmed!', { exact: true })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('3008 Rue McGill')).toBeVisible()
    // Default tier (VoyaX = $10.50) fee carries through.
    await expect(page.getByText('$10.50')).toBeVisible()
    // No "Explore More" section for G1.
    await expect(page.getByText('Explore More')).not.toBeVisible()
  })

  test('G1 Return-ride: driver-confirm step appears before completion', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await page.getByTestId('input-pickup-address').fill('1000 Saint-Catherine Street West')
    await page.getByTestId('dropoff-saved-rue-mcgill').click({ force: true })
    await page.getByTestId('btn-confirm-ride').click({ force: true })

    await expect(page.getByTestId('screen-return-ride-confirm')).toBeVisible()
    await expect(page.getByText('Your driver is nearby')).toBeVisible()
    await page.getByTestId('btn-confirm-return-ride').click({ force: true })

    await expect(page.getByText('Ride Confirmed!', { exact: true })).toBeVisible({ timeout: 5000 })
  })
})
