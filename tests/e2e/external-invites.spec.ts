import { expect, test } from '@playwright/test'
import {
  claimExternalInvite,
  hashInviteToken,
  type ExternalClaimRow,
} from '../../lib/external-invites'
import {
  acceptConsent,
  advanceToService2,
  completeBackgroundQuestionnaire,
  completeCourierEntry,
  completePostTaskSurvey,
  completeRidePhase,
  continueScenarioInstruction,
} from './shared/helpers'

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv'
const SESSION = '3f2b8c1e-5d4a-4b6e-9c7d-1a2b3c4d5e6f'

test.describe('External invite claims', () => {
  test('claims with the stored condition and participant, hashing the token', async () => {
    const calls: [string, string][] = []
    const result = await claimExternalInvite(TOKEN, SESSION, async (hash, session) => {
      calls.push([hash, session])
      return { out_outcome: 'claimed', out_group: 'G2', out_participant: 'ext_0a1b2c3d4e' }
    })

    expect(result).toEqual({ outcome: 'claimed', condition: 'G2', participantId: 'ext_0a1b2c3d4e' })
    expect(calls).toEqual([[hashInviteToken(TOKEN), SESSION]])
    expect(calls[0][0]).not.toContain(TOKEN)
  })

  test('rejects malformed tokens and sessions without touching storage', async () => {
    let calls = 0
    const rpc = async (): Promise<ExternalClaimRow> => {
      calls += 1
      return { out_outcome: 'claimed', out_group: 'G1', out_participant: 'ext_0a1b2c3d4e' }
    }

    for (const [token, session] of [
      ['short', SESSION],
      [`${TOKEN}x`, SESSION],
      [TOKEN, 'not-a-session'],
      [null, SESSION],
    ]) {
      expect((await claimExternalInvite(token, session, rpc)).outcome).toBe('invalid_invite')
    }
    expect(calls).toBe(0)
  })

  test('passes through used, full, and closed outcomes without an assignment', async () => {
    for (const outcome of ['used', 'full', 'closed', 'invalid_invite']) {
      const result = await claimExternalInvite(TOKEN, SESSION, async () => ({
        out_outcome: outcome,
        out_group: null,
        out_participant: null,
      }))
      expect(result).toEqual({ outcome, condition: null, participantId: null })
    }
  })

  test('refuses a claim row with an unexpected condition or participant id', async () => {
    await expect(
      claimExternalInvite(TOKEN, SESSION, async () => ({
        out_outcome: 'claimed',
        out_group: 'G9',
        out_participant: 'ext_0a1b2c3d4e',
      })),
    ).rejects.toThrow()
    await expect(
      claimExternalInvite(TOKEN, SESSION, async () => ({
        out_outcome: 'claimed',
        out_group: 'G1',
        out_participant: '6a08c54900faffdc114eb097',
      })),
    ).rejects.toThrow()
  })
})

test.describe('External invite landing', () => {
  test('a claimed invite starts the server-assigned condition without the access code', async ({ page }) => {
    let claimBody: Record<string, unknown> | null = null
    await page.route('**/api/external/claim', async (route) => {
      claimBody = route.request().postDataJSON()
      await route.fulfill({ json: { outcome: 'claimed', condition: 'G3', participantId: 'ext_0a1b2c3d4e' } })
    })
    await page.route('**/api/gate', (route) => route.fulfill({ json: { enabled: true } }))
    await page.route('**/api/events', (route) => route.fulfill({ json: { ok: true } }))

    await page.goto(`/?invite=${TOKEN}`)
    await page.waitForURL('**/experiment/G3')

    expect(claimBody).toMatchObject({ invite: TOKEN })
    const stored = await page.evaluate(() => ({
      pid: sessionStorage.getItem('prolific_pid'),
      debug: sessionStorage.getItem('exp_debug_override'),
    }))
    expect(stored).toEqual({ pid: 'ext_0a1b2c3d4e', debug: null })
  })

  test('a used invite shows a non-Prolific message', async ({ page }) => {
    await page.route('**/api/external/claim', (route) =>
      route.fulfill({ status: 409, json: { outcome: 'used', condition: null, participantId: null } }),
    )

    await page.goto(`/?invite=${TOKEN}`)

    await expect(page.getByTestId('screen-invite-used')).toBeVisible()
    await expect(page.getByText('Prolific')).toHaveCount(0)
  })

  test('an external completion confirms the stored trail and never hands off to Prolific', async ({ page }) => {
    const uploaded: string[] = []
    let completeCalls = 0
    await page.route('**/api/external/claim', (route) =>
      route.fulfill({ json: { outcome: 'claimed', condition: 'G1', participantId: 'ext_0a1b2c3d4e' } }),
    )
    await page.route('**/api/events', async (route) => {
      const body = route.request().postDataJSON() as { events?: { eventName: string; participantId: string }[] }
      for (const event of body.events ?? []) {
        expect(event.participantId).toBe('ext_0a1b2c3d4e')
        uploaded.push(event.eventName)
      }
      await route.fulfill({ json: { ok: true } })
    })
    await page.route('**/api/complete', async (route) => {
      completeCalls += 1
      // The server confirms only once the full trail has been uploaded.
      await route.fulfill({
        json: {
          outcome: uploaded.includes('experiment.completed') ? 'valid' : 'incomplete',
          url: null,
          code: null,
          external: true,
        },
      })
    })

    await page.goto(`/?invite=${TOKEN}`)
    await page.waitForURL('**/experiment/G1')
    await acceptConsent(page)
    await continueScenarioInstruction(page)
    await completeRidePhase(page)
    await advanceToService2(page)
    await completeCourierEntry(page)
    await expect(page.getByText('Delivery Complete', { exact: true })).toBeVisible({ timeout: 8_000 })
    await page.getByTestId('btn-service2-done').click({ force: true })
    await completePostTaskSurvey(page)
    await completeBackgroundQuestionnaire(page)

    await expect(page.getByTestId('external-saved')).toBeVisible({ timeout: 10_000 })
    expect(completeCalls).toBeGreaterThan(0)
    for (const name of ['service2.task.complete', 'survey.completed', 'questionnaire.completed', 'experiment.completed']) {
      expect(uploaded).toContain(name)
    }
    await expect(page.getByText('Return to Prolific')).toHaveCount(0)
  })
})
