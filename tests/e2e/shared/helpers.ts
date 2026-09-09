import { Page, expect } from '@playwright/test'

/**
 * Tap a target by test id, scrolling it into view first and using a real
 * (non-force) click. `click({ force: true })` skips scrolling AND hit-testing,
 * so elements below the fold in the scrollable phone frame (deep cinema list,
 * bottom CTAs on the taller service-2 screens) get clicked at off-screen
 * coordinates and silently missed. A normal click auto-scrolls, waits for the
 * element to receive events, and retries — the idle GuidanceBanner overlay is
 * pointer-events-none so it never intercepts.
 */
async function tap(page: Page, testId: string) {
  const el = page.getByTestId(testId)
  await el.scrollIntoViewIfNeeded()
  await el.click()
}

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

  // Task 1 instruction page → Start Task 1
  const startTask = page.getByTestId('btn-start-task')
  await expect(startTask).toBeVisible({ timeout: 10000 })
  await startTask.click({ force: true })

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
  // Home screen → enter destination address (now required), then Start a Ride
  const destination = page.getByTestId('input-destination')
  await destination.click({ force: true })
  await destination.fill('1000 Saint-Catherine Street West')

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
  const page1 = ['CL1', 'CL2', 'CL3', 'PU1', 'PU2', 'PU3', 'PU4', 'PU5', 'PU6']
  const page2 = ['CI1', 'CI2', 'CI3', 'CI4', 'AC1', 'MC1', 'MC2', 'MC5', 'MC3', 'MC4', 'MC6']

  const answer = async (code: string) => {
    const value = code === 'AC1' ? ac1Value : 4
    const btn = page.getByTestId(`likert-${code}-${value}`)
    await btn.scrollIntoViewIfNeeded()
    await btn.evaluate((node) => (node as HTMLButtonElement).click())
  }

  for (const code of page1) await answer(code)
  await page.getByTestId('btn-survey-continue').click({ force: true })
  for (const code of page2) await answer(code)

  await page.getByTestId('btn-submit-survey').click({ force: true })
}

/**
 * Complete the Return-ride entry (G1/G2): ensure the pickup is valid, pick a
 * saved drop-off, keep the default ride tier, confirm, then confirm on the
 * driver screen. Works for both auto-fill (G2) and empty (G1) conditions.
 */
export async function completeReturnRideEntry(page: Page) {
  // Pickup: only fill when the empty field is shown (auto-fill hides it).
  const pickupEmpty = page.getByTestId('pickup-address-empty')
  if (await pickupEmpty.isVisible().catch(() => false)) {
    await page.getByTestId('input-pickup-address').fill('1000 Saint-Catherine Street West')
  }

  // Drop-off: pick a saved place.
  await tap(page, 'dropoff-saved-rue-mcgill')
  await expect(page.getByTestId('dropoff-selected')).toBeVisible()

  // Default ride tier is pre-selected; confirm the ride.
  await tap(page, 'btn-confirm-ride')

  // Driver-confirm step (common to G1 & G2): confirm the return ride.
  await expect(page.getByTestId('screen-return-ride-confirm')).toBeVisible({ timeout: 10000 })
  await tap(page, 'btn-confirm-return-ride')
}

/**
 * Complete the Movie entry (G3/G4): ensure the location is valid, select a
 * showtime, choose two seats, then confirm tickets. Works for both auto-fill
 * (G4) and empty (G3) conditions.
 */
export async function completeMovieEntry(page: Page) {
  // Location: only fill when the empty field is shown (auto-fill hides it).
  const locationEmpty = page.getByTestId('movie-location-empty')
  if (await locationEmpty.isVisible().catch(() => false)) {
    await page.getByTestId('input-movie-location').fill('1000 Saint-Catherine Street West')
  }

  // Pick a 7:10 PM showtime at the Forum cinema.
  await tap(page, 'showtime-forum-710')
  await tap(page, 'btn-select-cinema')

  // Seat-selection step (common to G3 & G4): pick two available seats.
  await expect(page.getByTestId('screen-movie-seats')).toBeVisible({ timeout: 10000 })
  await tap(page, 'seat-A1')
  await tap(page, 'seat-A2')
  await tap(page, 'btn-confirm-tickets')
}

/**
 * Advance from Trip Complete to Service 2. The transition cue differs by
 * condition (banner CTA vs neutral continue), then a Task 2 instruction page
 * gates entry into the second service for all conditions.
 */
export async function advanceToService2(page: Page, viaBanner = false) {
  if (viaBanner) {
    await page.getByTestId('btn-banner-cta').click({ force: true })
  } else {
    await page.getByTestId('btn-back-to-home').click({ force: true })
  }

  // Task 2 instruction page → Start Task 2
  const startTask = page.getByTestId('btn-start-task')
  await expect(startTask).toBeVisible({ timeout: 10000 })
  await startTask.click({ force: true })

  await expect(
    page
      .getByTestId('pickup-address-empty')
      .or(page.getByTestId('pickup-address-autofilled'))
      .or(page.getByTestId('movie-location-empty'))
      .or(page.getByTestId('movie-location-autofilled')),
  ).toBeVisible({ timeout: 10000 })
}
