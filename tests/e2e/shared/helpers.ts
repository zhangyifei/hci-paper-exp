import { Page, expect } from '@playwright/test'

/**
 * Navigate to the experiment landing page for a specific condition.
 * Uses ?condition=Gx override so we don't rely on hash assignment.
 */
export async function goToCondition(
  page: Page,
  condition: 'G1' | 'G2' | 'G3' | 'G4'
) {
  await page.goto(
    `/?PROLIFIC_PID=TEST_PARTICIPANT_001&STUDY_ID=TEST_STUDY&SESSION_ID=TEST_SESSION&condition=${condition}`
  )
  // Wait for redirect to experiment page
  await page.waitForURL(`**/experiment/${condition}`, { timeout: 10000 })
}

/**
 * Complete the Ride phase: Home → Map → RideAlmostThere → TripComplete
 */
export async function completeRidePhase(page: Page) {
  // Home screen → tap Start a Ride
  await page.getByTestId('btn-start-ride').click()

  // Map screen → tap Choose Uber X
  await page.getByTestId('btn-choose-uber-x').click()

  // RideAlmostThere screen auto-advances after 2.5s
  await page.waitForTimeout(3000)

  // Now on Trip Complete screen
  await expect(page.getByText('Trip Complete 🎉')).toBeVisible({ timeout: 5000 })
}

/**
 * Assert banner is visible with the given CTA text
 */
export async function assertBannerVisible(page: Page, ctaText: string) {
  await expect(page.getByTestId('btn-banner-cta')).toBeVisible()
  await expect(page.getByTestId('btn-banner-cta')).toContainText(ctaText)
}

/**
 * Assert banner is NOT present
 */
export async function assertNoBanner(page: Page) {
  await expect(page.getByTestId('btn-banner-cta')).not.toBeVisible()
}

/**
 * Advance from Trip Complete to Service 2 (via banner CTA or Back to Home)
 */
export async function advanceToService2(page: Page, viaBanner = false) {
  if (viaBanner) {
    await page.getByTestId('btn-banner-cta').click()
  } else {
    await page.getByTestId('btn-back-to-home').click()
  }
}
