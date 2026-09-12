import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/mathogram/',
    locale: 'en-GB',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: 'npm run preview',
      url: 'http://127.0.0.1:4173/mathogram/',
      reuseExistingServer: false,
    },
    {
      command: 'node tests/fixtures/update-server.mjs',
      url: 'http://127.0.0.1:4174/mathogram/',
      reuseExistingServer: false,
    },
  ],
});
