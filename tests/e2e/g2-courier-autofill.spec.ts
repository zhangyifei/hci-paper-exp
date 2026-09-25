import { test, expect } from '@playwright/test'
import {
  goToCondition,
  completeRidePhase,
  assertBannerVisible,
  advanceToService2,
  completeCourierEntry,
} from './shared/helpers'

test.describe('G2 — Ride + Courier, Auto-fill', () => {
  test.beforeEach(async ({ page }) => {
    await goToCondition(page, 'G2')
  })

  test('lands on experiment page for G2', async ({ page }) => {
    await expect(page).toHaveURL(/\/experiment\/G2/)
    await expect(page.getByTestId('btn-start-ride')).toBeVisible()
  })

  test('G2 Trip Complete: courier banner shown with Send Package CTA', async ({ page }) => {
    await completeRidePhase(page)

    await assertBannerVisible(page, 'Send Package')
    await expect(page.getByText(/Need to send something/i)).toBeVisible()
    await expect(page.getByText(/Send a package from 1000 Saint-Catherine Street West/i)).toBeVisible()
  })

  test('G2 banner CTA navigates to Courier Entry', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true) // via banner

    await expect(page.getByTestId('screen-courier-entry')).toBeVisible()
    await expect(page.getByText('Send a package')).toBeVisible()
  })

  test('G2 Courier Entry: sender address auto-populated', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    await expect(page.getByTestId('sender-address-autofilled')).toBeVisible()
    await expect(page.getByText('SUGGESTED').first()).toBeVisible()
    await expect(page.getByText(/Downtown, Montreal/i)).toBeVisible()
    await expect(page.getByText('1000 Saint-Catherine Street West')).toBeVisible()
  })

  test('G2 Courier Entry: shows delivery options', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    await expect(page.getByTestId('courier-option-small')).toBeVisible()
    await expect(page.getByTestId('courier-option-medium')).toBeVisible()
    await expect(page.getByTestId('courier-option-large')).toBeVisible()
  })

  test('G2 full flow: Continue → Delivery Complete with Explore More', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    await completeCourierEntry(page)

    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 5000 })
    // G2-specific: Explore More section (bridge cell).
    await expect(page.getByText('Explore More')).toBeVisible()
  })
})
