import { test, expect, type Page } from '@playwright/test'

import type { BatchSummary } from '../../lib/types'

const PASSWORD = 'test-admin-password'
const BATCH: BatchSummary = {
  id: '5df44e4d-8503-425b-b700-9e0a2515d8ca',
  name: 'Prolific US-CA 18-50 (12)',
  status: 'closed',
  groupSize: 3,
  createdAt: '2026-10-01T00:00:00.000Z',
  closedAt: '2026-10-02T00:00:00.000Z',
  groups: (['G1', 'G2', 'G3', 'G4'] as const).map((group) => ({ group, assigned: 3, completed: 3, invalid: 0, capacity: 3 })),
  totalAssigned: 12,
  totalCompleted: 12,
  totalInvalid: 0,
  capacity: 12,
}

async function openDashboard(page: Page) {
  await page.route('**/api/admin/batches', (route) => route.fulfill({ json: { batches: [BATCH] } }))
  await page.goto('/admin')
  await page.getByPlaceholder('Access password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Enter' }).click()
  await expect(page.getByRole('heading', { name: BATCH.name })).toBeVisible()
}

test.describe('Admin Excel export', () => {
  test('downloads the batch workbook with the admin password header', async ({ page }) => {
    let passwordHeader: string | null = null
    await page.route(`**/api/admin/batches/${BATCH.id}/export`, (route) => {
      passwordHeader = route.request().headers()['x-stats-password'] ?? null
      return route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="prolific-us-ca-18-50-12-raw-data-2026-10-03.xlsx"',
        },
        body: Buffer.from('PK-fake-xlsx'),
      })
    })
    await openDashboard(page)

    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId(`export-excel-${BATCH.id}`).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('prolific-us-ca-18-50-12-raw-data-2026-10-03.xlsx')
    expect(passwordHeader).toBe(PASSWORD)
    await expect(page.getByTestId(`export-excel-${BATCH.id}`)).toHaveText('Export Excel')
  })

  test('shows an error when the export fails', async ({ page }) => {
    await page.route(`**/api/admin/batches/${BATCH.id}/export`, (route) =>
      route.fulfill({ status: 500, json: { error: 'Export failed' } }),
    )
    await openDashboard(page)

    await page.getByTestId(`export-excel-${BATCH.id}`).click()

    await expect(page.getByText('Excel export failed (500)')).toBeVisible()
  })
})
