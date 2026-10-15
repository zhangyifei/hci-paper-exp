import { expect, test } from '@playwright/test'

const CONDITIONS = ['G1', 'G2', 'G3', 'G4'] as const

for (const condition of CONDITIONS) {
  test(`${condition}: ride destination suggestions require typing and rank the task address first`, async ({ page }) => {
    await page.route('**/api/events', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
    )

    await page.goto(`/experiment/${condition}`)
    await page.getByTestId('consent-acknowledge').click()
    await page.getByTestId('btn-consent-continue').click()
    await page.getByTestId('btn-scenario-start').click()

    const destination = page.getByTestId('input-destination')
    const suggestions = page.getByTestId('destination-suggestions')
    const mcgillRecentTrip = page.getByText('3008 Rue McGill', { exact: true })

    await expect(mcgillRecentTrip).toHaveCSS('font-weight', '700')
    await expect(mcgillRecentTrip).toHaveCSS('text-decoration-line', 'underline')

    await destination.click()
    await expect(suggestions).not.toBeVisible()

    await destination.fill('10')
    await expect(suggestions).not.toBeVisible()

    await destination.fill('100')
    await expect(suggestions).toBeVisible()
    await expect(suggestions.getByRole('option')).toHaveCount(3)
    await expect(suggestions.getByRole('option').first()).toContainText(
      '1000 Saint-Catherine Street West',
    )

    await page.getByTestId('destination-suggestion-saint-catherine').click()
    await expect(destination).toHaveValue('1000 Saint-Catherine Street West')
    await expect(suggestions).not.toBeVisible()
  })
}
