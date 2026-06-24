import { test, expect, Page } from '@playwright/test'
import { goToCondition, completeRidePhase, advanceToService2, completePostTaskSurvey, completeCourierEntry } from './shared/helpers'

/**
 * Coverage for the new onboarding (consent + scenario) screens and the
 * updated 14-item post-task survey.
 */

const RIDE_INSTRUCTION = 'Book a ride to 1000 Saint-Catherine Street West.'

async function landRaw(page: Page, condition: 'G1' | 'G2' | 'G3' | 'G4') {
  const uniqueSessionId = `TEST_SESSION_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  await page.goto(
    `/?PROLIFIC_PID=TEST_PARTICIPANT_001&STUDY_ID=TEST_STUDY&SESSION_ID=${uniqueSessionId}&condition=${condition}`
  )
  await page.waitForURL(`**/experiment/${condition}`, { timeout: 10000 })
}

test.describe('Onboarding — consent gate', () => {
  test('consent screen appears first and blocks until acknowledged', async ({ page }) => {
    await landRaw(page, 'G1')

    // Consent visible, scenario not yet shown
    await expect(page.getByTestId('btn-consent-continue')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Consent to Participate' })).toBeVisible()
    await expect(page.getByTestId('btn-scenario-start')).not.toBeVisible()

    // Continue is disabled before acknowledgement
    await expect(page.getByTestId('btn-consent-continue')).toBeDisabled()

    // Acknowledge → enabled → continue advances to the scenario instruction
    await page.getByTestId('consent-acknowledge').click({ force: true })
    await expect(page.getByTestId('btn-consent-continue')).toBeEnabled()
    await page.getByTestId('btn-consent-continue').click({ force: true })
    await expect(page.getByTestId('btn-scenario-start')).toBeVisible()
  })
})

test.describe('Onboarding — scenario instruction', () => {
  test('G1 scenario shows ride + courier instructions from config', async ({ page }) => {
    await landRaw(page, 'G1')
    await page.getByTestId('consent-acknowledge').click({ force: true })
    await page.getByTestId('btn-consent-continue').click({ force: true })

    await expect(page.getByTestId('btn-scenario-start')).toBeVisible()
    await expect(page.getByTestId('scenario-ride-instruction')).toHaveText(RIDE_INSTRUCTION)
    await expect(page.getByTestId('scenario-service2-instruction')).toContainText(
      'send a package to 1000 Saint-Catherine Street West using the Courier service'
    )

    // Start advances into the Task 1 instruction page, then the ride task
    await page.getByTestId('btn-scenario-start').click({ force: true })
    await expect(page.getByTestId('btn-start-task')).toBeVisible()
    await page.getByTestId('btn-start-task').click({ force: true })
    await expect(page.getByTestId('btn-start-ride')).toBeVisible()
  })

  test('G4 scenario shows ride + eats instructions from config', async ({ page }) => {
    await landRaw(page, 'G4')
    await page.getByTestId('consent-acknowledge').click({ force: true })
    await page.getByTestId('btn-consent-continue').click({ force: true })

    await expect(page.getByTestId('scenario-service2-instruction')).toContainText(
      'use the suggested "Eat" option to order food near the same destination'
    )
  })
})

test.describe('Post-task survey — items + attention check', () => {
  test('G1: survey is paginated, hides codes, AC1 on page 1, MC items on page 2', async ({ page }) => {
    await goToCondition(page, 'G1')
    await completeRidePhase(page)
    await advanceToService2(page, false)
    await completeCourierEntry(page)
    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 8000 })
    await page.getByTestId('btn-delivery-complete').click({ force: true })

    // Page 1 of 2, nothing answered, Continue present, Submit not yet
    await expect(page.getByTestId('survey-page-indicator')).toHaveText('Page 1 of 2')
    await expect(page.getByText('0 of 15 answered', { exact: true })).toBeVisible()
    await expect(page.getByTestId('btn-survey-continue')).toBeVisible()
    await expect(page.getByTestId('btn-submit-survey')).toHaveCount(0)

    // Internal codes are hidden from participants
    await expect(page.getByText('CL1', { exact: true })).toHaveCount(0)

    // AC1 present on page 1 with its numeric legend
    await expect(page.getByText('To show that you are reading carefully, please select "Somewhat agree" for this statement.')).toBeVisible()
    await expect(page.getByText('5 = Somewhat agree')).toBeVisible()
    await expect(page.getByText('I found this super app easy to use for these consecutive tasks.')).toBeVisible()

    // Page 2 holds the manipulation-check items
    await expect(page.getByText('The second service felt different from the ride service.')).toHaveCount(0)
    await page.getByTestId('btn-survey-continue').click({ force: true })
    await expect(page.getByTestId('survey-page-indicator')).toHaveText('Page 2 of 2')
    await expect(page.getByText('The second service felt different from the ride service.')).toBeVisible()
    await expect(page.getByText('The two service tasks required different kinds of actions.')).toBeVisible()
    await expect(page.getByTestId('btn-submit-survey')).toBeVisible()
    await expect(page.getByTestId('btn-survey-back')).toBeVisible()
  })

  test('G1: submitting with a missing answer warns and blocks', async ({ page }) => {
    await goToCondition(page, 'G1')
    await completeRidePhase(page)
    await advanceToService2(page, false)
    await completeCourierEntry(page)
    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 8000 })
    await page.getByTestId('btn-delivery-complete').click({ force: true })

    // Answer page 1 fully (AC1 = 5)
    for (const code of ['CL1', 'CL2', 'CL3', 'PU1', 'AC1', 'PU2', 'PU3', 'PU4']) {
      const value = code === 'AC1' ? 5 : 4
      await page.getByTestId(`likert-${code}-${value}`).evaluate((n) => (n as HTMLButtonElement).click())
    }
    await page.getByTestId('btn-survey-continue').click({ force: true })

    // Leave one page-2 item unanswered, then submit
    for (const code of ['CI1', 'CI2', 'CI3', 'MC1', 'MC2', 'MC3']) {
      await page.getByTestId(`likert-${code}-4`).evaluate((n) => (n as HTMLButtonElement).click())
    }
    await page.getByTestId('btn-submit-survey').click({ force: true })

    // Warning shown; still on the survey (not the questionnaire)
    await expect(page.getByTestId('survey-warning')).toBeVisible()
    await expect(page.getByTestId('btn-submit-questionnaire')).toHaveCount(0)

    // Completing the last item allows submission
    await page.getByTestId('likert-MC4-4').evaluate((n) => (n as HTMLButtonElement).click())
    await page.getByTestId('btn-submit-survey').click({ force: true })
    await expect(page.getByTestId('btn-submit-questionnaire')).toBeVisible({ timeout: 10000 })
  })

  test('G1: background questionnaire is collected after a correct survey', async ({ page }) => {
    await goToCondition(page, 'G1')
    await completeRidePhase(page)
    await advanceToService2(page, false)

    // Drive the courier task to completion
    await completeCourierEntry(page)
    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 8000 })
    await page.getByTestId('btn-delivery-complete').click({ force: true })

    // Answer all 15 items with AC1 correct (5), then submit
    await expect(page.getByTestId('screen-survey')).toBeVisible()
    await completePostTaskSurvey(page, { ac1Value: 5 })

    // Background questionnaire now appears after the survey (docx order)
    await expect(page.getByTestId('btn-submit-questionnaire')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('questionnaire-option-AC2-rarely')).toBeVisible()
  })

  test('G1: failing AC1 ends the test and never reaches the questionnaire', async ({ page }) => {
    await goToCondition(page, 'G1')
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await completeCourierEntry(page)
    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 8000 })
    await page.getByTestId('btn-delivery-complete').click({ force: true })

    // Answer AC1 incorrectly (value 2 instead of 5)
    await expect(page.getByTestId('screen-survey')).toBeVisible()
    await completePostTaskSurvey(page, { ac1Value: 2 })

    // Terminated screen shown; questionnaire never reached
    await expect(page.getByTestId('screen-terminated')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('btn-submit-questionnaire')).not.toBeVisible()
  })

  test('G1: failing AC2 ends the test and never reaches the finished screen', async ({ page }) => {
    await goToCondition(page, 'G1')
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await completeCourierEntry(page)
    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 8000 })
    await page.getByTestId('btn-delivery-complete').click({ force: true })

    // Pass AC1
    await expect(page.getByTestId('screen-survey')).toBeVisible()
    await completePostTaskSurvey(page, { ac1Value: 5 })

    // Background questionnaire: answer AC2 incorrectly ("daily"), rest correct
    await expect(page.getByTestId('btn-submit-questionnaire')).toBeVisible({ timeout: 10000 })
    const wrongAnswers = [
      'questionnaire-option-AC2-daily',
      'questionnaire-option-DEM1-25-34',
      'questionnaire-option-DEM2-male',
      'questionnaire-option-FAM1-weekly',
      'questionnaire-option-FAM2-4',
      'questionnaire-option-SWI1-2',
      'questionnaire-option-SWI2-sometimes',
    ]
    for (const testId of wrongAnswers) {
      const option = page.getByTestId(testId)
      await option.scrollIntoViewIfNeeded()
      await option.evaluate((node) => (node as HTMLButtonElement).click())
    }
    await page.getByTestId('btn-submit-questionnaire').click({ force: true })

    // Terminated, not finished
    await expect(page.getByTestId('screen-terminated')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('screen-finished')).not.toBeVisible()
  })
})
