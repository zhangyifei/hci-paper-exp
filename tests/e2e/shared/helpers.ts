import { Page, expect } from '@playwright/test'

async function acceptConsent(page: Page) {
  const continueButton = page.getByTestId('btn-consent-continue')
  if (!(await continueButton.isVisible().catch(() => false))) {
    return
  }

  await page.getByTestId('consent-acknowledge').click({ force: true })
  await continueButton.click({ force: true })
  await expect(page.getByTestId('btn-scenario-start')).toBeVisible({ timeout: 10000 })
}

async function continueScenarioInstruction(page: Page) {
  const startButton = page.getByTestId('btn-scenario-start')
  await expect(startButton).toBeVisible({ timeout: 10000 })
  await startButton.click({ force: true })
  await expect(page.getByTestId('btn-start-ride')).toBeVisible({ timeout: 10000 })
}

/**
 * Complete the background questionnaire shown at the END of the study,
 * after the post-task survey.
 */
export async function completeBackgroundQuestionnaire(page: Page) {
  const submitButton = page.getByTestId('btn-submit-questionnaire')
  if (!(await submitButton.isVisible().catch(() => false))) {
    return
  }

  // AC2 attention check must be answered "Rarely" to avoid termination.
  const answers = [
    'questionnaire-option-AC2-rarely',
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
    await expect(page.getByText(`${index + 1} of ${answers.length} answered`, { exact: true })).toBeVisible()
  }

  await submitButton.click({ force: true })
}

/**
 * Navigate to the experiment landing page for a specific condition.
 * Uses ?condition=Gx override so we don't rely on hash assignment.
 * Passes through consent and scenario onboarding to reach the ride task.
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
  await acceptConsent(page)
  await continueScenarioInstruction(page)
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
 * Complete the 15-item post-task survey (14 constructs + AC1 attention check).
 * AC1 must be answered "Somewhat agree" (value 5) to avoid termination; all
 * other items default to value 4 unless overridden.
 */
export async function completePostTaskSurvey(
  page: Page,
  opts: { ac1Value?: number } = {},
) {
  const ac1Value = opts.ac1Value ?? 5
  const codes = [
    'CL1', 'CL2', 'CL3',
    'PU1', 'PU2', 'PU3', 'PU4',
    'CI1', 'CI2', 'CI3',
    'MC1', 'MC2', 'MC3', 'MC4',
    'AC1',
  ]

  for (const code of codes) {
    const value = code === 'AC1' ? ac1Value : 4
    const btn = page.getByTestId(`likert-${code}-${value}`)
    await btn.scrollIntoViewIfNeeded()
    await btn.evaluate((node) => (node as HTMLButtonElement).click())
  }

  await page.getByTestId('btn-submit-survey').click({ force: true })
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
