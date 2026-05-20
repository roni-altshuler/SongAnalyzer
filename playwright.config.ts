import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the SongAnalyzer v2 smoke suite.
 *
 * Boots `next dev` automatically (via `webServer`) and exercises the
 * critical happy paths in Chromium. Designed to run with zero env vars —
 * the app degrades gracefully, so the suite hits the keyword-fallback path
 * for the analyze flow and expects a 503 inline notice for SongSearch.
 *
 * Run locally:   npx playwright test
 * Run headed:    npx playwright test --headed
 * Update snaps:  npx playwright test --update-snapshots
 */
export default defineConfig({
  testDir: './playwright/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // Tests assume the dark brand. The site has a light toggle but the OG
    // identity is dark; locking the colorScheme keeps screenshots stable.
    colorScheme: 'dark',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    // Next 16 + Turbopack cold start can take a while on CI.
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
