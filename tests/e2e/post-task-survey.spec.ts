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
    await expect(page.getByTestId('scenario-description')).toContainText(
      'You are visiting a friend at 1000 Saint-Catherine Street West'
    )
    await expect(page.getByTestId('scenario-ride-instruction')).toHaveText(RIDE_INSTRUCTION)
    await expect(page.getByTestId('scenario-service2-instruction')).toContainText(
      'send a package from 1000 Saint-Catherine Street West to 3008 Rue McGill'
    )

    // Start advances into the Task 1 instruction page, then the ride task
    await page.getByTestId('btn-scenario-start').click({ force: true })
    await expect(page.getByTestId('btn-start-task')).toBeVisible()
    await page.getByTestId('btn-start-task').click({ force: true })
    await expect(page.getByTestId('btn-start-ride')).toBeVisible()
  })

  test('G4 scenario shows ride + movie instructions from config', async ({ page }) => {
    await landRaw(page, 'G4')
    await page.getByTestId('consent-acknowledge').click({ force: true })
    await page.getByTestId('btn-consent-continue').click({ force: true })

    await expect(page.getByTestId('scenario-service2-instruction')).toContainText(
      'book two movie tickets at a cinema near 1000 Saint-Catherine Street West'
    )
    await expect(page.getByTestId('scenario-description')).toContainText(
      'use the Cinema service to book two movie tickets'
    )
  })
})

test.describe('Post-task survey — doc items verbatim + attention check', () => {
  test('G1: survey is paginated, hides codes, doc wording, AC1 on page 2', async ({ page }) => {
    await goToCondition(page, 'G1')
    await completeRidePhase(page)
    await advanceToService2(page, false)
    await completeCourierEntry(page)
    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 8000 })
    await page.getByTestId('btn-service2-done').click({ force: true })

    // Page 1 of 3, Continue present, Submit not yet
    await expect(page.getByTestId('survey-page-indicator')).toHaveText('Page 1 of 3')
    await expect(page.getByTestId('btn-survey-continue')).toBeVisible()
    await expect(page.getByTestId('btn-submit-survey')).toHaveCount(0)

    // Internal codes are hidden from participants
    await expect(page.getByText('CL1', { exact: true })).toHaveCount(0)

    // Page 1 holds CL + PU items with the doc's exact wording
    await expect(page.getByText('How much mental activity was required to complete this task?')).toBeVisible()
    await expect(page.getByText('I found this system easy to use for these consecutive tasks.')).toBeVisible()
    await expect(page.getByText('The transition between the two services felt smooth.')).toBeVisible()
    await expect(page.getByText('To show that you are reading carefully', { exact: false })).toHaveCount(0)

    // Page 2 holds CI items, the attention check (with its numeric legend) and MC items
    await expect(page.getByText('The second service felt different from the ride service.')).toHaveCount(0)
    await page.getByTestId('btn-survey-continue').click({ force: true })
    await expect(page.getByTestId('survey-page-indicator')).toHaveText('Page 2 of 3')
    await expect(page.getByText('I intend to continue using this app if similar services are available.')).toBeVisible()
    await expect(page.getByText('To show that you are reading carefully, please select "Somewhat agree" for this statement.')).toBeVisible()
    await expect(page.getByText('5 = Somewhat agree')).toBeVisible()
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
    await page.getByTestId('btn-service2-done').click({ force: true })

    // Answer page 1 fully
    for (const code of ['CL1', 'CL2', 'CL3', 'PU1', 'PU2', 'PU7', 'PU4']) {
      await page.getByTestId(`likert-${code}-4`).evaluate((n) => (n as HTMLButtonElement).click())
    }
    await page.getByTestId('btn-survey-continue').click({ force: true })

    // Leave one page-2 item unanswered, then submit (AC1 = 5)
    for (const code of ['CI1', 'CI3', 'CI2', 'AC1', 'MC1', 'MC2', 'MC5', 'MC3', 'MC4']) {
      const value = code === 'AC1' ? 5 : 4
      await page.getByTestId(`likert-${code}-${value}`).evaluate((n) => (n as HTMLButtonElement).click())
    }
    await page.getByTestId('btn-submit-survey').click({ force: true })

    // Warning shown; still on the survey (not the questionnaire)
    await expect(page.getByTestId('survey-warning')).toBeVisible()
    await expect(page.getByTestId('btn-submit-questionnaire')).toHaveCount(0)

    // Completing the last item allows submission
    await page.getByTestId('likert-MC6-4').evaluate((n) => (n as HTMLButtonElement).click())
    await page.getByTestId('btn-submit-survey').click({ force: true })
    await expect(page.getByTestId('btn-submit-questionnaire')).toBeVisible({ timeout: 10000 })
  })

  test('G1: background questionnaire is collected after the survey', async ({ page }) => {
    await goToCondition(page, 'G1')
    await completeRidePhase(page)
    await advanceToService2(page, false)

    // Drive the courier task to completion
    await completeCourierEntry(page)
    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 8000 })
    await page.getByTestId('btn-service2-done').click({ force: true })

    await expect(page.getByTestId('screen-survey')).toBeVisible()
    await completePostTaskSurvey(page, { ac1Value: 5 })

    // Background questionnaire now appears after the survey, with the doc's exact wording
    await expect(page.getByTestId('btn-submit-questionnaire')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('What is your age group?')).toBeVisible()
    await expect(page.getByText('How often do you switch between different services or features within the same app?')).toBeVisible()
    await expect(page.getByTestId('questionnaire-option-DEM1-65+')).toBeVisible()
  })

  test('G1: failing AC1 ends the test and never reaches the questionnaire', async ({ page }) => {
    await goToCondition(page, 'G1')
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await completeCourierEntry(page)
    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 8000 })
    await page.getByTestId('btn-service2-done').click({ force: true })

    await expect(page.getByTestId('screen-survey')).toBeVisible()
    await completePostTaskSurvey(page, { ac1Value: 2 })

    await expect(page.getByTestId('screen-terminated')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('btn-submit-questionnaire')).not.toBeVisible()
  })
})
