import { Page, expect } from '@playwright/test'

async function completeBackgroundQuestionnaire(page: Page) {
  const submitButton = page.getByTestId('btn-submit-questionnaire')
  if (!(await submitButton.isVisible().catch(() => false))) {
    return
  }

  const answers = [
    'questionnaire-option-DEM1-25-34',
    'questionnaire-option-DEM2-male',
    'questionnaire-option-FAM1-weekly',
    'questionnaire-option-FAM2-4',
    'questionnaire-option-SWI1-2',
    'questionnaire-option-SWI2-sometimes',
  ]

  for (const [index, answerTestId] of answers.entries()) {
    const option = page.getByTestId(answerTestId)
    await option.scrollIntoViewIfNeeded()
    await option.evaluate((node) => {
      ;(node as HTMLButtonElement).click()
    })
    await expect(page.getByText(`${index + 1} of 6 answered`, { exact: true })).toBeVisible()
  }

  await submitButton.click({ force: true })
  await expect(page.getByTestId('btn-start-ride')).toBeVisible({ timeout: 10000 })
}

/**
 * Navigate to the experiment landing page for a specific condition.
 * Uses ?condition=Gx override so we don't rely on hash assignment.
 */
export async function goToCondition(
  page: Page,
  condition: 'G1' | 'G2' | 'G3' | 'G4'
) {
  const uniqueSessionId = `TEST_SESSION_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  await page.goto(
    `/?PROLIFIC_PID=TEST_PARTICIPANT_001&STUDY_ID=TEST_STUDY&SESSION_ID=${uniqueSessionId}&condition=${condition}`
  )
  // Wait for redirect to experiment page
  await page.waitForURL(`**/experiment/${condition}`, { timeout: 10000 })
  await completeBackgroundQuestionnaire(page)
}

/**
 * Complete the Ride phase: Home → Map → RideAlmostThere → TripComplete
 */
export async function completeRidePhase(page: Page) {
  // Home screen → tap Start a Ride
  await page.getByTestId('btn-start-ride').click({ force: true })

  // Map screen → tap Choose Uber X
  await page.getByTestId('btn-choose-uber-x').click({ force: true })

  // RideAlmostThere screen auto-advances after 2.5s
  // Wait longer to ensure transition happens even on slow CI/local
  await page.waitForTimeout(4000)

  // Now on Trip Complete screen
  await expect(page.getByText('Trip Complete', { exact: true })).toBeVisible({ timeout: 10000 })
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
    await page.getByTestId('btn-banner-cta').click({ force: true })
    return
  }

  await page.getByTestId('btn-back-to-home').click({ force: true })

  const service2Markers = [
    page.getByTestId('sender-address-empty'),
    page.getByTestId('sender-address-autofilled'),
    page.getByTestId('deliver-address-empty'),
    page.getByTestId('deliver-address-autofilled'),
  ]

  if (await service2Markers[0].isVisible().catch(() => false)) return
  if (await service2Markers[2].isVisible().catch(() => false)) return

  await page.getByTestId('tab-eats').click({ force: true })
  if (
    (await page.getByTestId('deliver-address-empty').isVisible().catch(() => false)) ||
    (await page.getByTestId('deliver-address-autofilled').isVisible().catch(() => false))
  ) {
    return
  }

  await page.getByTestId('tab-courier').click({ force: true })
  await expect(
    page
      .getByTestId('sender-address-empty')
      .or(page.getByTestId('sender-address-autofilled')),
  ).toBeVisible({ timeout: 10000 })
}
