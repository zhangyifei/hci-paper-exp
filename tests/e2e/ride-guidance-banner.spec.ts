import { expect, test } from '@playwright/test'

const CONDITIONS = ['G1', 'G2', 'G3', 'G4'] as const
const RIDE_REMINDER =
  'Task reminder: Enter 1000 Saint-Catherine Street West, then tap Start a Ride.'

for (const condition of CONDITIONS) {
  test(`${condition}: ride reminder includes the emphasized destination`, async ({ page }) => {
    await page.route('**/api/events', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
    )

    await page.goto(`/experiment/${condition}`)
    await page.getByTestId('consent-acknowledge').click()
    await page.getByTestId('btn-consent-continue').click()
    await page.getByTestId('btn-scenario-start').click()
    await page.getByTestId('btn-start-task').click()

    const banner = page.getByTestId('guidance-banner')
    await expect(banner).toBeVisible({ timeout: 12_000 })
    await expect(banner).toContainText(RIDE_REMINDER)

    const address = banner.locator('[data-address-emphasis]')
    await expect(address).toHaveText('1000 Saint-Catherine Street West')
    await expect(address).toHaveCSS('font-weight', '700')
    await expect(address).toHaveCSS('text-decoration-line', 'underline')

    await banner.locator('p').click()
    await expect(banner).toBeVisible()

    await page.getByText('Ways to ride', { exact: true }).click()
    await expect(banner).not.toBeVisible()
  })
}
