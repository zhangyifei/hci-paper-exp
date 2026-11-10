import { test, expect } from '@playwright/test'
import {
  goToCondition,
  completeRidePhase,
  assertBannerVisible,
  advanceToService2,
  completeCourierEntry,
  expectPhoneCTAVisibleWithoutScroll,
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
    await expect(page.getByTestId('trip-complete-map')).toHaveCSS('height', '96px')
    const ctaIsFullyVisibleWithoutScroll = await page.evaluate(() => {
      const screen = document.querySelector('.device-screen')
      const cta = document.querySelector('[data-testid="btn-banner-cta"]')
      if (!(screen instanceof HTMLElement) || !(cta instanceof HTMLElement)) return false
      const screenBox = screen.getBoundingClientRect()
      const ctaBox = cta.getBoundingClientRect()
      return screen.scrollTop === 0 && ctaBox.bottom <= screenBox.bottom
    })
    expect(ctaIsFullyVisibleWithoutScroll).toBe(true)
    await expect(page.getByTestId('guidance-banner')).toContainText(
      "Task reminder: Tap 'Send Package' to send a package to 3008 Rue McGill.",
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

  test('G2 Courier CTAs are fully visible without scrolling', async ({ page }) => {
    await expectPhoneCTAVisibleWithoutScroll(page, 'btn-start-ride')
    await page.getByTestId('input-destination').fill('1000 Saint-Catherine Street West')
    await page.getByTestId('btn-start-ride').click()

    await expectPhoneCTAVisibleWithoutScroll(page, 'btn-choose-uber-x')
    await page.getByTestId('btn-choose-uber-x').click()
    await expect(page.getByText('Trip Complete', { exact: true })).toBeVisible({ timeout: 10000 })
    await expectPhoneCTAVisibleWithoutScroll(page, 'btn-banner-cta')
    await page.getByTestId('btn-banner-cta').click()

    await expectPhoneCTAVisibleWithoutScroll(page, 'btn-confirm-courier')
    await page.getByTestId('input-recipient-address').fill('3008')
    await page.getByTestId('recipient-suggestion-rue-mcgill').click()
    await page.getByTestId('btn-confirm-courier').click()

    await expect(page.getByTestId('screen-package-details')).toBeVisible()
    await expectPhoneCTAVisibleWithoutScroll(page, 'btn-confirm-pickup')
    await page.getByTestId('btn-confirm-pickup').click()
    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible()
    await expectPhoneCTAVisibleWithoutScroll(page, 'btn-service2-done')
  })

  test('G2 recipient typing shows only prefix-matching options with the task address first', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    await expect(page.getByTestId('recipient-saved-places')).toHaveCount(0)
    await page.getByTestId('input-recipient-address').fill('30')

    const suggestions = page.getByTestId('recipient-suggestions')
    await expect(suggestions).toBeVisible()
    await expect(suggestions.getByRole('button')).toHaveCount(3)
    await expect(suggestions.getByRole('button').first()).toContainText('3008 Rue McGill')
    await expect(suggestions.getByRole('button').first()).toContainText('RECENT')
    await expect(suggestions).toContainText('300 Rue McGill')
    await expect(suggestions).toContainText('3000 Rue Saint-Antoine Ouest')
    await expect(suggestions).not.toContainText('1502 Rue Saint-Louis')
    await expect(suggestions).toContainText('Saved & recent')

    await page.getByTestId('recipient-suggestion-rue-mcgill').click()
    await expect(page.getByTestId('recipient-selected')).toContainText('3008 Rue McGill')
    await expect(page.getByTestId('guidance-banner')).toContainText(
      'Task reminder: Enter 3008 Rue McGill as the recipient and choose a delivery option.',
      { timeout: 12_000 },
    )
  })

  test('G2 removes 1502 and blocks every recipient except 3008 Rue McGill', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    const recipient = page.getByTestId('input-recipient-address')
    await recipient.fill('1')
    await expect(page.getByTestId('recipient-suggestions')).toHaveCount(0)
    await expect(page.getByText('1502 Rue Saint-Louis', { exact: true })).toHaveCount(0)

    await recipient.fill('1502 Rue Saint-Louis')
    const continueButton = page.getByTestId('btn-confirm-courier')
    await continueButton.scrollIntoViewIfNeeded()
    await continueButton.click()
    await expect(page.getByTestId('recipient-error')).toContainText(
      'Use 3008 Rue McGill as the recipient address.',
    )
    await expect(page.getByTestId('screen-courier-entry')).toBeVisible()
    await expect(page.getByTestId('screen-package-details')).toHaveCount(0)

    const recipientErrors = await page.evaluate(() => {
      const events = JSON.parse(
        sessionStorage.getItem('hci_experiment_events') ?? '[]',
      ) as Array<{ eventName?: string; payload?: { field?: string; providedAddress?: string } }>
      return events.filter(
        (event) =>
          event.eventName === 'task.error' && event.payload?.field === 'courier_recipient',
      )
    })
    expect(recipientErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({ providedAddress: '1502 Rue Saint-Louis' }),
        }),
      ]),
    )

    await recipient.fill('3008')
    await page.getByTestId('recipient-suggestion-rue-mcgill').click()
    await continueButton.scrollIntoViewIfNeeded()
    await continueButton.click()
    await expect(page.getByTestId('screen-package-details')).toBeVisible()
  })

  test('G2 full flow: Continue → Delivery Complete without Explore More', async ({ page }) => {
    await completeRidePhase(page)
    await advanceToService2(page, true)

    await completeCourierEntry(page)

    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Explore More')).toHaveCount(0)
  })
})
