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
    await expect(page.getByTestId('btn-back-to-home')).toHaveText('Back to Home')
    await expect(page.getByTestId('trip-complete-map')).toBeVisible()
    await expect(page.getByTestId('guidance-banner')).toContainText(
      'Task reminder: Send a package to 3008 Rue McGill.',
      { timeout: 12_000 },
    )

    await page.getByTestId('guidance-banner-dismiss').click()
    await page.getByTestId('btn-back-to-home').click({ force: true })
    await expect(page.getByTestId('screen-courier-entry')).toBeVisible()
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

  test('G2 recipient typing shows two saved and recent options with the task address first', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    await expect(page.getByTestId('recipient-saved-places')).toHaveCount(0)
    await page.getByTestId('input-recipient-address').fill('3008')

    const suggestions = page.getByTestId('recipient-suggestions')
    await expect(suggestions).toBeVisible()
    await expect(suggestions.getByRole('button')).toHaveCount(2)
    await expect(suggestions.getByRole('button').first()).toContainText('3008 Rue McGill')
    await expect(suggestions).toContainText('Saved & recent')

    await page.getByTestId('recipient-suggestion-rue-mcgill').click()
    await expect(page.getByTestId('recipient-selected')).toContainText('3008 Rue McGill')
    await expect(page.getByTestId('guidance-banner')).toContainText(
      'Task reminder: Enter 3008 Rue McGill as the recipient and choose a delivery option.',
      { timeout: 12_000 },
    )
  })

  test('G2 full flow: Continue → Delivery Complete without Explore More', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    await completeCourierEntry(page)

    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Explore More')).toHaveCount(0)
  })
})
