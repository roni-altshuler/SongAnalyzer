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
// Overridable so the suite can dodge an unrelated server squatting on :3000
// (e.g. another project's `next start`): PW_PORT=3100 npx playwright test
const PORT = process.env.PW_PORT ?? '3000';

export default defineConfig({
  testDir: './playwright/e2e',
  // Dev-server cold compiles (several routes, in parallel workers) can eat
  // most of the default 30s before the actual assertions run.
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    // Tests assume the dark brand. The site has a light toggle but the OG
    // identity is dark; locking the colorScheme keeps screenshots stable.
    colorScheme: 'dark',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Fake mic input + auto-granted permission so the Identify listening
        // state is testable headlessly (no real audio hardware on CI).
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        },
        permissions: ['microphone'],
      },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Next 16 + Turbopack cold start can take a while on CI.
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
