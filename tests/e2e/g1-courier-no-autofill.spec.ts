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
    // Uber/Eats/Courier tab bar visible
    await expect(page.getByText('Rides', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Eats', { exact: true }).first()).toBeVisible()
    await expect(page.getByTestId('tab-courier')).toBeVisible()
  })

  test('destination can be filled by tapping a saved place', async ({ page }) => {
    // Focusing the field surfaces selectable saved/recent destinations.
    await page.getByTestId('input-destination').click({ force: true })
    await expect(page.getByTestId('destination-suggestions')).toBeVisible()

    await page.getByTestId('destination-suggestion-saint-catherine').click({ force: true })
    await expect(page.getByTestId('input-destination')).toHaveValue('1000 Saint-Catherine Street West')

    // A valid selection lets the ride start without typing.
    await page.getByTestId('btn-start-ride').click({ force: true })
    await page.getByTestId('btn-choose-uber-x').click({ force: true })
    await page.waitForTimeout(4000)
    await expect(page.getByText('Trip Complete', { exact: true })).toBeVisible({ timeout: 10000 })
  })

  test('ride phase completes and shows Trip Complete', async ({ page }) => {
    await completeRidePhase(page)
    await expect(page.getByText('Trip Complete', { exact: true })).toBeVisible()
    await expect(page.getByText('1000 Saint-Catherine Street West')).toBeVisible()
    await expect(page.getByText('$12.59')).toBeVisible()
  })

  test('selected ride option price carries to Trip Complete', async ({ page }) => {
    const destination = page.getByTestId('input-destination')
    await destination.click({ force: true })
    await destination.fill('1000 Saint-Catherine Street West')
    await page.getByTestId('btn-start-ride').click({ force: true })
    await page.getByTestId('ride-option-comfort').click({ force: true })
    await page.getByTestId('btn-choose-uber-x').click({ force: true })
    await page.waitForTimeout(4000)
    await expect(page.getByText('Trip Complete', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('$14.33')).toBeVisible()
  })

  test('G1 Trip Complete: no banner shown', async ({ page }) => {
    await completeRidePhase(page)
    await assertNoBanner(page)
    // Footnote text visible for G1
    await expect(page.getByText(/Back to Home.*return home.*explore other services/i)).toBeVisible()
  })

  test('G1 Courier Entry: sender address is empty (no auto-fill)', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    // Sender input present and empty (no auto-fill)
    await expect(page.getByTestId('input-sender-address')).toBeVisible()
    await expect(page.getByTestId('input-sender-address')).toHaveValue('')
    await expect(page.getByText('SUGGESTED')).not.toBeVisible()
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

    // Select first option, fill addresses, then confirm
    await page.getByTestId('pickup-option-small').click({ force: true })
    await completeCourierEntry(page)

    // Delivery in progress screen
    await expect(page.getByText(/Your delivery is.*almost here/i)).toBeVisible({ timeout: 5000 })

    // Auto-advances to Delivery Complete
    await page.waitForTimeout(3000)
    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 5000 })

    // Courier fee carries from the selected pickup option (Small = $8).
    await expect(page.getByText('$8.00')).toBeVisible()

    // No "Popular nearby" section for G1
    await expect(page.getByText('Popular nearby')).not.toBeVisible()
  })

  test('G1 Courier: delivery-details page appears before pickup confirmation', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await page.getByTestId('pickup-option-small').click({ force: true })
    await page.getByTestId('input-sender-address').fill('1000 Saint-Catherine Street West')
    await page.getByTestId('saved-address-rue-mcgill').click({ force: true })
    await page.getByTestId('btn-courier-continue').click({ force: true })

    // New dedicated delivery-details step (selector moved off the entry screen).
    await expect(page.getByTestId('screen-package-details')).toBeVisible()
    await expect(page.getByText('Add delivery details')).toBeVisible()
    await expect(page.getByText('What are you sending?')).toBeVisible()
    await page.getByTestId('item-type-documents').click({ force: true })
    await page.getByTestId('btn-confirm-pickup').click({ force: true })

    await expect(page.getByText(/Your delivery is.*almost here/i)).toBeVisible({ timeout: 5000 })
  })
})
