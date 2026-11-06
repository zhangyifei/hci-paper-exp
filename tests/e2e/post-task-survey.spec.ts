import { test, expect, Page } from '@playwright/test'
import { goToCondition, completeRidePhase, advanceToService2, completePostTaskSurvey, completeCourierEntry } from './shared/helpers'

/**
 * Coverage for the new onboarding (consent + scenario) screens and the
 * updated 24-item post-task survey.
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
    await expect(page.getByTestId('scenario-super-app-term-definition')).toHaveCSS(
      'font-weight',
      '700'
    )
    await expect(page.getByTestId('scenario-super-app-term')).toHaveCount(0)
    await expect(page.getByTestId('scenario-super-app-term-note')).toHaveCount(0)
    await expect(page.getByTestId('super-app-definition')).toHaveText(
      'A super app combines multiple services in one application—for example, ride booking, food delivery, shopping, and payments.'
    )
    await expect(page.getByTestId('scenario-description')).toContainText(
      'You’re visiting a friend and need to send a package afterward.'
    )
    await expect(page.getByTestId('scenario-ride-instruction')).toHaveText(RIDE_INSTRUCTION)
    await expect(page.getByTestId('scenario-service2-instruction')).toContainText(
      'send a package from 1000 Saint-Catherine Street West to 3008 Rue McGill'
    )
    await expect(page.getByTestId('scenario-description')).not.toContainText(
      '1000 Saint-Catherine Street West'
    )
    await expect(page.getByTestId('scenario-description')).not.toContainText('3008 Rue McGill')
    await expect(page.getByText('RIDE TASK', { exact: true })).toHaveCSS('font-weight', '700')
    await expect(page.getByText('COURIER TASK', { exact: true })).toHaveCSS('font-weight', '700')
    await expect(page.getByText('RIDE TASK', { exact: true })).toHaveCSS('text-decoration-line', 'underline')
    await expect(page.getByText('COURIER TASK', { exact: true })).toHaveCSS('text-decoration-line', 'underline')
    await expect(page.getByTestId('scenario-ride-instruction')).toHaveCSS('font-weight', '400')
    await expect(page.getByTestId('scenario-service2-instruction')).toHaveCSS('font-weight', '400')
    await expect(
      page.getByTestId('scenario-ride-instruction').getByText('1000 Saint-Catherine Street West', { exact: true })
    ).toHaveCSS('text-decoration-line', 'none')
    await expect(
      page.getByTestId('scenario-ride-instruction').getByText('1000 Saint-Catherine Street West', { exact: true })
    ).toHaveCSS('font-weight', '700')
    await expect(
      page.getByTestId('scenario-service2-instruction').getByText('3008 Rue McGill', { exact: true })
    ).toHaveCSS('text-decoration-line', 'none')
    await expect(
      page.getByTestId('scenario-service2-instruction').getByText('3008 Rue McGill', { exact: true })
    ).toHaveCSS('font-weight', '700')

    // Continue advances directly into the ride task; there is no separate
    // Task 1 instruction page.
    await page.getByTestId('btn-scenario-start').click({ force: true })
    await expect(page.getByTestId('btn-start-task')).toHaveCount(0)
    await expect(page.getByTestId('btn-start-ride')).toBeVisible()
  })

  test('G2 scenario does not underline task addresses', async ({ page }) => {
    await landRaw(page, 'G2')
    await page.getByTestId('consent-acknowledge').click({ force: true })
    await page.getByTestId('btn-consent-continue').click({ force: true })

    await expect(page.getByTestId('scenario-description')).not.toContainText(
      '1000 Saint-Catherine Street West'
    )
    await expect(page.getByTestId('scenario-description')).not.toContainText('3008 Rue McGill')
    await expect(
      page.getByTestId('scenario-ride-instruction').getByText('1000 Saint-Catherine Street West', { exact: true })
    ).toHaveCSS('text-decoration-line', 'none')
    await expect(
      page.getByTestId('scenario-service2-instruction').getByText('3008 Rue McGill', { exact: true })
    ).toHaveCSS('text-decoration-line', 'none')
  })

  test('G4 scenario shows ride + movie instructions from config', async ({ page }) => {
    await landRaw(page, 'G4')
    await page.getByTestId('consent-acknowledge').click({ force: true })
    await page.getByTestId('btn-consent-continue').click({ force: true })

    await expect(page.getByTestId('scenario-service2-instruction')).toContainText(
      'book two movie tickets at a cinema near 1000 Saint-Catherine Street West'
    )
    await expect(page.getByTestId('scenario-description')).toContainText(
      'use the Cinema service to find a nearby cinema and book two movie tickets'
    )
    await expect(page.getByTestId('scenario-description')).not.toContainText(
      '1000 Saint-Catherine Street West'
    )
    await expect(page.getByText('RIDE TASK', { exact: true })).toHaveCSS('font-weight', '700')
    await expect(page.getByText('CINEMA TASK', { exact: true })).toHaveCSS('font-weight', '700')
    await expect(page.getByText('RIDE TASK', { exact: true })).toHaveCSS('text-decoration-line', 'underline')
    await expect(page.getByText('CINEMA TASK', { exact: true })).toHaveCSS('text-decoration-line', 'underline')
    await expect(page.getByTestId('scenario-ride-instruction')).toHaveCSS('font-weight', '400')
    await expect(page.getByTestId('scenario-service2-instruction')).toHaveCSS('font-weight', '400')
    await expect(
      page.getByTestId('scenario-service2-instruction').getByText('1000 Saint-Catherine Street West', { exact: true })
    ).toHaveCSS('text-decoration-line', 'none')
    await expect(
      page.getByTestId('scenario-service2-instruction').getByText('1000 Saint-Catherine Street West', { exact: true })
    ).toHaveCSS('font-weight', '700')
  })
})

test.describe('Post-task survey — items + attention check', () => {
  test('G1: survey is paginated, hides codes, and places AC1 on page 2', async ({ page }) => {
    await goToCondition(page, 'G1')
    await completeRidePhase(page)
    await advanceToService2(page, false)
    await completeCourierEntry(page)
    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 8000 })
    await page.getByTestId('btn-service2-done').click({ force: true })

    // Page 1 of 3, Continue present, Submit not yet
    await expect(page.getByTestId('survey-page-indicator')).toHaveText('Page 1 of 3')
    await expect(page.getByTestId('btn-survey-continue')).toBeVisible()
    await expect(page.getByTestId('btn-survey-continue')).toHaveText('Continue')
    await expect(page.getByTestId('btn-submit-survey')).toHaveCount(0)

    // Internal codes are hidden from participants
    await expect(page.getByText('CL1', { exact: true })).toHaveCount(0)

    // Page 1 uses the exact supplied wording for questions 1–10; the attention check is not here.
    for (const question of [
      'How much mental activity was required to complete the two tasks?',
      'How hard did you have to work mentally to complete these two tasks?',
      'Using this app required a lot of thinking.',
      'While using this app, I had to think carefully about what to do next.',
      'Overall, using this app was mentally demanding.',
      'I found this app easy to use for these consecutive tasks.',
      'I felt I could efficiently complete my goal using this app.',
      'The transition between the two services felt smooth.',
      'The app made it easy to continue from the first service to the second service.',
      'Using this app was a frustrating experience.',
    ]) {
      await expect(page.getByText(question, { exact: true })).toBeVisible()
    }
    for (const code of ['CL1', 'CL2', 'CL3', 'CL4', 'CL5', 'PU1', 'PU2', 'PU3', 'PU4', 'PU5']) {
      await expect(page.getByTestId(`survey-item-${code}`).getByRole('radio')).toHaveCount(7)
    }
    await expect(page.getByText('To show that you are reading carefully, please select "Somewhat agree" for this statement.')).toHaveCount(0)

    // Continue is blocked until every page-1 item has an answer.
    await expect(page.getByText('The second service was a clearly different type of task from booking a ride.')).toHaveCount(0)
    await page.getByTestId('btn-survey-continue').click({ force: true })
    await expect(page.getByTestId('survey-page-indicator')).toHaveText('Page 1 of 3')
    await expect(page.getByTestId('survey-warning')).toContainText(
      'Please answer all required questions before continuing.'
    )
    await expect(page.getByText('The second service was a clearly different type of task from booking a ride.')).toHaveCount(0)

    for (const code of ['CL1', 'CL2', 'CL3', 'CL4', 'CL5', 'PU1', 'PU2', 'PU3', 'PU4', 'PU5']) {
      await page.getByTestId(`likert-${code}-4`).evaluate((n) => (n as HTMLButtonElement).click())
    }

    // Page 2 holds questions 11–24, with the attention check at question 15.
    await page.getByTestId('btn-survey-continue').click({ force: true })
    await expect(page.getByTestId('survey-page-indicator')).toHaveText('Page 2 of 3')
    await expect(page.getByTestId('survey-warning')).toHaveCount(0)
    for (const question of [
      'I intend to continue using this app rather than discontinue its use.',
      'My intentions are to continue using this app rather than use any alternative app.',
      'I would choose this super app again for similar tasks.',
      'I would like to continue my use of this app.',
      'To show that you are reading carefully, please select "Somewhat agree" for this statement.',
      'The app provided a direct link from the first service to the second service.',
      'The app allowed me to go straight from the first service to the second service.',
      'Information from the first service was automatically carried over to the second service.',
      'The destination address from my ride booking was automatically filled in for the second service.',
      'The two services served different purposes.',
      'The main functions performed by the two services are different.',
      'The two services belong to different broad service categories.',
      'The two services follow different steps to complete their main tasks.',
      'The two services involve different types of activities.',
    ]) {
      await expect(page.getByText(question, { exact: true })).toBeVisible()
    }
    for (const code of [
      'CI1', 'CI2', 'CI3', 'CI4', 'AC1',
      'MC1', 'MC2', 'MC3', 'MC4', 'MC5', 'MC6', 'MC7', 'MC8', 'MC9',
    ]) {
      await expect(page.getByTestId(`survey-item-${code}`).getByRole('radio')).toHaveCount(7)
    }
    await expect(page.getByText('To show that you are reading carefully, please select "Somewhat agree" for this statement.')).toBeVisible()
    for (const [index, label] of [
      'Strongly disagree',
      'Disagree',
      'Somewhat disagree',
      'Neither agree nor disagree',
      'Somewhat agree',
      'Agree',
      'Strongly agree',
    ].entries()) {
      await expect(page.getByTestId(`likert-inline-label-AC1-${index + 1}`)).toHaveText(label)
    }
    await expect(page.getByText('The second service was a clearly different type of task from booking a ride.')).toHaveCount(0)
    await expect(page.getByTestId('btn-submit-survey')).toHaveText('Continue')
    await expect(page.getByTestId('btn-survey-back')).toHaveCount(0)
  })

  test('G1: submitting with a missing answer warns and blocks', async ({ page }) => {
    await goToCondition(page, 'G1')
    await completeRidePhase(page)
    await advanceToService2(page, false)
    await completeCourierEntry(page)
    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 8000 })
    await page.getByTestId('btn-service2-done').click({ force: true })

    // Answer page 1 fully
    for (const code of ['CL1', 'CL2', 'CL3', 'CL4', 'CL5', 'PU1', 'PU2', 'PU3', 'PU4', 'PU5']) {
      await page.getByTestId(`likert-${code}-4`).evaluate((n) => (n as HTMLButtonElement).click())
    }
    await page.getByTestId('btn-survey-continue').click({ force: true })

    // Leave MC9 (question 24) unanswered, then submit (AC1 = 5).
    for (const code of [
      'CI1', 'CI2', 'CI3', 'CI4', 'AC1',
      'MC1', 'MC2', 'MC3', 'MC4', 'MC5', 'MC6', 'MC7', 'MC8',
    ]) {
      const value = code === 'AC1' ? 5 : 4
      await page.getByTestId(`likert-${code}-${value}`).evaluate((n) => (n as HTMLButtonElement).click())
    }
    await page.getByTestId('btn-submit-survey').click({ force: true })

    // Warning shown; still on the survey (not the questionnaire)
    await expect(page.getByTestId('survey-warning')).toBeVisible()
    await expect(page.getByTestId('btn-submit-questionnaire')).toHaveCount(0)

    // Completing the last item allows submission.
    await page.getByTestId('likert-MC9-4').evaluate((n) => (n as HTMLButtonElement).click())
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
    await page.getByTestId('btn-service2-done').click({ force: true })

    // Answer all 24 items with AC1 correct (5), then submit
    await expect(page.getByTestId('screen-survey')).toBeVisible()
    await completePostTaskSurvey(page, { ac1Value: 5 })

    // Background questionnaire now appears after the survey (docx order)
    await expect(page.getByTestId('btn-submit-questionnaire')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('btn-submit-questionnaire')).toHaveText('Submit')
    await expect(page.getByTestId('questionnaire-page-indicator')).toHaveText('Page 3 of 3')

    const questions = [
      'What is your age range?',
      'What is your gender?',
      'How familiar are you with super apps such as Uber, Grab, WeChat, or similar?',
      'How clear an idea do you have about which characteristics of a super app are important for you to have a satisfying experience using it?',
      'How would you rate your knowledge about super apps relative to the general population?',
      'I know a lot about super apps.',
      'How frequently do you use super apps?',
      'How familiar are you with switching between different services (e.g. ride → food) within the same app?',
      'How often do you switch between services mid-session (e.g. finish a ride, then order food without closing the app)?',
    ]
    for (const question of questions) {
      await expect(page.getByText(question, { exact: true })).toBeVisible()
    }

    const sevenPointItems: Record<string, string[]> = {
      FAM1: ['Not at all familiar', 'Very slightly familiar', 'Slightly familiar', 'Moderately familiar', 'Quite familiar', 'Very familiar', 'Extremely familiar'],
      FAM2: ['Not at all clear', 'Very slightly clear', 'Slightly clear', 'Moderately clear', 'Quite clear', 'Very clear', 'Extremely clear'],
      KNW1: ['Far below average', 'Below average', 'Slightly below average', 'About average', 'Slightly above average', 'Above average', 'Far above average'],
      KNW2: ['Strongly disagree', 'Disagree', 'Somewhat disagree', 'Neither agree nor disagree', 'Somewhat agree', 'Agree', 'Strongly agree'],
      USE1: ['Never', 'Very rarely', 'Rarely', 'Sometimes', 'Often', 'Very often', 'All the time'],
    }
    for (const [code, labels] of Object.entries(sevenPointItems)) {
      const item = page.getByTestId(`survey-item-${code}`)
      await expect(item.getByRole('radio')).toHaveCount(7)
      for (const [index, label] of labels.entries()) {
        await expect(page.getByTestId(`likert-inline-label-${code}-${index + 1}`)).toHaveText(label)
      }
    }

    await expect(page.locator('[id^="q-"]')).toHaveCount(9)
    await expect(page.getByText('How often do you use multi-service super apps?', { exact: true })).toHaveCount(0)

    // Page 3 is the final survey page, uses Q25–Q33, and requires every answer.
    await page.getByTestId('btn-submit-questionnaire').click({ force: true })
    await expect(page.getByTestId('questionnaire-warning')).toContainText(
      'Question 25 still needs an answer'
    )
    await expect(page.getByTestId('screen-questionnaire')).toBeVisible()
  })

  test('G1: failing AC1 ends the test and never reaches the questionnaire', async ({ page }) => {
    await goToCondition(page, 'G1')
    await completeRidePhase(page)
    await advanceToService2(page, false)

    await completeCourierEntry(page)
    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 8000 })
    await page.getByTestId('btn-service2-done').click({ force: true })

    // Answer AC1 incorrectly (value 2 instead of 5)
    await expect(page.getByTestId('screen-survey')).toBeVisible()
    await completePostTaskSurvey(page, { ac1Value: 2 })

    // Terminated screen shown; questionnaire never reached
    await expect(page.getByTestId('screen-terminated')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('btn-submit-questionnaire')).not.toBeVisible()
  })
})
