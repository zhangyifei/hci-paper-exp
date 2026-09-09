import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // workers: undefined, // Let Playwright determine based on CPU cores
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    // Use 127.0.0.1 (IPv4) not localhost: another project may bind IPv6 [::1]:3000,
    // which wins localhost resolution. Our Next server binds all interfaces, so IPv4 hits us.
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    // Mobile viewport matching our 390px constraint
    viewport: { width: 390, height: 844 },
  },
  projects: [
    {
      name: 'chromium',
      // Keep the Chrome browser but force the mobile viewport. Without the
      // explicit viewport, devices['Desktop Chrome'] (1280x720) overrides the
      // top-level 390x844, pushing bottom CTAs below the 720px fold.
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
  // Start dev server before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    // env: {
    //   // Dummy blob token so API route doesn't crash during tests
    //   BLOB_READ_WRITE_TOKEN: 'test_token_placeholder',
    // },
  },
})
