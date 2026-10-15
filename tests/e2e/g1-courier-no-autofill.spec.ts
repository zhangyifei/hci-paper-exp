import { test, expect } from '@playwright/test'
import {
  goToCondition,
  completeRidePhase,
  assertNoBanner,
  advanceToService2,
  completeCourierEntry,
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
    await expect(page.getByTestId('input-destination')).toBeVisible()
    await expect(page.getByText('Start a Ride')).toBeVisible()
    // Rides / Courier tab bar visible
    await expect(page.getByText('Rides', { exact: true }).first()).toBeVisible()
    await expect(page.getByTestId('tab-courier')).toBeVisible()
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
    await expect(page.getByTestId('trip-complete-hint')).not.toBeVisible()
    await expect(page.getByTestId('guidance-banner')).toContainText(
      "Task reminder: Tap 'Back to Home' to return home and explore other services.",
      { timeout: 12_000 },
    )

    await page.getByTestId('guidance-banner-dismiss').click()
    await page.getByTestId('btn-back-to-home').click({ force: true })
    await expect(page.getByTestId('input-destination')).toBeVisible()
    await expect(page.getByTestId('tab-courier')).toBeVisible()
    await expect(page.getByTestId('screen-courier-entry')).toHaveCount(0)
    await expect(page.getByTestId('guidance-banner')).toContainText(
      'Task reminder: Tap Courier to send your package.',
      { timeout: 12_000 },
    )
  })

  test('G1 Courier Entry: sender address is empty (no auto-fill)', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await expect(page.getByTestId('sender-address-empty')).toBeVisible()
    await expect(page.getByTestId('sender-address-autofilled')).not.toBeVisible()
    await expect(page.getByTestId('input-sender-address')).toHaveValue('')
    await expect(page.getByText('SUGGESTED')).not.toBeVisible()
  })

  test('G1 sender and recipient require typing and show three task-ranked options', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await expect(page.getByTestId('sender-saved-places')).toHaveCount(0)
    await expect(page.getByTestId('recipient-saved-places')).toHaveCount(0)

    await page.getByTestId('input-sender-address').fill('10')
    await expect(page.getByTestId('sender-suggestions')).toHaveCount(0)
    await page.getByTestId('input-sender-address').fill('100')
    const senderSuggestions = page.getByTestId('sender-suggestions')
    await expect(senderSuggestions.getByRole('button')).toHaveCount(3)
    await expect(senderSuggestions.getByRole('button').first()).toContainText(
      '1000 Saint-Catherine Street West',
    )
    await expect(senderSuggestions.getByRole('button').first()).toContainText('RECENT')
    await page.getByTestId('sender-suggestion-saint-catherine').click()

    await page.getByTestId('input-recipient-address').fill('30')
    await expect(page.getByTestId('recipient-suggestions')).toHaveCount(0)
    await page.getByTestId('input-recipient-address').fill('300')
    const recipientSuggestions = page.getByTestId('recipient-suggestions')
    await expect(recipientSuggestions.getByRole('button')).toHaveCount(3)
    await expect(recipientSuggestions).not.toContainText('Saved & recent')
    await expect(recipientSuggestions.getByRole('button').first()).toContainText('3008 Rue McGill')
    await expect(recipientSuggestions.getByRole('button').first()).toContainText('RECENT')
  })

  test('G1 Courier Entry: shows delivery options (Small/Medium/Large)', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await expect(page.getByTestId('courier-option-small')).toBeVisible()
    await expect(page.getByTestId('courier-option-medium')).toBeVisible()
    await expect(page.getByTestId('courier-option-large')).toBeVisible()
    await expect(page.getByText('$8.00')).toBeVisible()
    await expect(page.getByText('$12.00')).toBeVisible()
    await expect(page.getByText('$24.00')).toBeVisible()
  })

  test('G1 full flow: Continue → Package details → Delivery Complete', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await completeCourierEntry(page)

    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('3008 Rue McGill')).toBeVisible()
    // Default option (Small = $8.00) fee carries through.
    await expect(page.getByText('$8.00')).toBeVisible()
    // No "Explore More" section for G1.
    await expect(page.getByText('Explore More')).not.toBeVisible()
  })

  test('G1 Courier: package-details step appears before completion', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await page.getByTestId('input-sender-address').fill('1000 Saint-Catherine Street West')
    await page.getByTestId('input-recipient-address').fill('300')
    await page.getByTestId('recipient-suggestion-rue-mcgill').click({ force: true })
    await page.getByTestId('btn-confirm-courier').click({ force: true })

    await expect(page.getByTestId('screen-package-details')).toBeVisible()
    await expect(page.getByText('Package details')).toBeVisible()
    await page.getByTestId('btn-confirm-pickup').click({ force: true })

    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 5000 })
  })
})
