import { expect, test } from '@playwright/test';

import { syntheticClip } from '../fixtures/synthetic-audio';

const fixtureSong = {
  title: 'Synthetic Northern Lights — a long track title for the listening studio',
  artist: 'Original test recording',
  geniusId: 123456,
};

async function searchFixture(page: import('@playwright/test').Page, song: typeof fixtureSong & { previewUrl?: string }) {
  await page.route('**/api/songs/search?*', (route) => route.fulfill({
    json: { hits: [{ id: 'synthetic-track', score: 1, song }] },
  }));
  await page.getByRole('combobox', { name: 'Search for a song' }).fill('Synthetic');
  await page.getByRole('option').first().click();
}

function watchErrors(page: import('@playwright/test').Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

// This test reaches the actual zero-config API. It verifies unavailability,
// not catalog recognition quality (no hosted catalog or RLS is exercised).
test('recognition catalog failure is distinct from a genuine no-match', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/identify');
  await page.locator('input[type="file"]').setInputFiles({ name: 'synthetic.wav', mimeType: 'audio/wav', buffer: syntheticClip() });
  await expect(page.getByRole('status')).toContainText('Recognition catalog unavailable.', { timeout: 30_000 });
  await expect(page.getByText('No catalog match.', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Analyze a local clip', exact: true }).click();
  await expect(page.getByRole('tab', { name: /Audio/ })).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});

// A controlled matched response tests the handoff UI only. Fingerprinting
// still processes our synthetic WAV in the real browser worker.
for (const width of [390, 768, 1440]) {
  test(`identified track without a preview has useful next steps at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = watchErrors(page);
    await page.route('**/api/identify', (route) => route.fulfill({ json: {
      status: 'matched', song: fixtureSong, match: { votes: 40, confidence: 0.8 },
    } }));
    await page.goto('/identify');
    await page.locator('input[type="file"]').setInputFiles({ name: 'synthetic.wav', mimeType: 'audio/wav', buffer: syntheticClip() });
    const context = page.getByLabel('Explore selected track');
    await expect(context).toBeVisible({ timeout: 30_000 });
    await expect(context.getByRole('status')).toHaveText('No audio preview available');
    await expect(context.getByRole('link', { name: 'Analyze a local file' })).toHaveAttribute('href', '/analyze?mode=audio');
    await expect(context.getByRole('link', { name: 'View on Genius' })).toHaveAttribute('href', 'https://genius.com/songs/123456');
    await expect(page.getByRole('heading', { name: 'Audio analysis', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Identify another', exact: true }).click();
    await expect(context).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('Discover shows download failure, retries the synthetic clip, and clears with keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const errors = watchErrors(page);
  let attempts = 0;
  await page.route('**/fixtures/retry.wav', (route) => {
    attempts++;
    return route.fulfill(attempts === 1 ? { status: 404, body: '' } : { contentType: 'audio/wav', body: syntheticClip() });
  });
  await page.goto('/discover');
  await searchFixture(page, { ...fixtureSong, previewUrl: '/fixtures/retry.wav' });
  const context = page.getByLabel('Explore selected track');
  await expect(context.getByRole('alert')).toContainText('Could not load');
  await page.getByRole('button', { name: 'Retry audio clip', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(context.getByRole('status')).toHaveText('Clip insights ready', { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Audio analysis', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear selected track', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(context).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Search for a song' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Audio analysis', exact: true })).toHaveCount(0);
  // The waveform player also downloads the clip after analysis.
  expect(attempts).toBeGreaterThanOrEqual(2);
  expect(errors).toEqual([]);
});

test('clearing a pending clip restores discovery without a late result', async ({ page }) => {
  let release!: () => void;
  let requested!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { requested = resolve; });
  await page.route('**/fixtures/slow.wav', async (route) => {
    requested();
    await pending;
    await route.fulfill({ contentType: 'audio/wav', body: syntheticClip() }).catch(() => undefined);
  });
  await page.goto('/discover');
  await searchFixture(page, { ...fixtureSong, previewUrl: '/fixtures/slow.wav' });
  await started;
  await expect(page.getByRole('status')).toContainText('Loading audio clip');
  await page.getByRole('button', { name: 'Clear selected track', exact: true }).click();
  release();
  await expect(page.getByText('Every analysis grows the map', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Explore selected track')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Audio analysis', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Search for a song' })).toBeFocused();
});

// Unlike the unavailable-store case above, this is a controlled no-match
// response. It validates the distinction in copy, not recognition accuracy.
test('a completed catalog lookup shows a genuine no-match state', async ({ page }) => {
  await page.route('**/api/identify', (route) => route.fulfill({ json: { status: 'no_match', fallbackAvailable: false } }));
  await page.goto('/identify');
  await page.locator('input[type="file"]').setInputFiles({ name: 'synthetic.wav', mimeType: 'audio/wav', buffer: syntheticClip() });
  await expect(page.getByRole('status')).toContainText('No catalog match.', { timeout: 30000 });
  await expect(page.getByText('Recognition catalog unavailable.', { exact: true })).toHaveCount(0);
});

test('exploration links and browser back/forward keep the expected analysis mode', async ({ page }) => {
  await page.goto('/discover');
  await searchFixture(page, fixtureSong);
  await page.getByRole('region', { name: 'Explore selected track' }).getByRole('link', { name: 'Analyze lyrics', exact: true }).click();
  await expect(page).toHaveURL(/analyze\?mode=lyrics/);
  await expect(page.getByRole('tab', { name: /Lyrics/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('textbox')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/discover$/);
  await expect(page.getByRole('combobox', { name: 'Search for a song' })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/analyze\?mode=lyrics/);
  await expect(page.getByRole('tab', { name: /Lyrics/ })).toHaveAttribute('aria-selected', 'true');
});

test('workbench local-file action clears unrelated selected-track attribution', async ({ page }) => {
  const savedBodies: Array<{ song?: unknown }> = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/analyses') && request.method() === 'POST') savedBodies.push(request.postDataJSON());
  });
  await page.goto('/analyze');
  await searchFixture(page, fixtureSong);
  const context = page.getByRole('region', { name: 'Explore selected track' });
  await context.getByRole('button', { name: 'Analyze a local file', exact: true }).click();
  await expect(page.getByRole('tab', { name: /Audio/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /Audio/ })).toBeFocused();
  const chooser = page.waitForEvent('filechooser');
  await context.getByRole('button', { name: 'Analyze a local file', exact: true }).click();
  await (await chooser).setFiles({ name: 'synthetic.wav', mimeType: 'audio/wav', buffer: syntheticClip() });
  await expect(page.getByRole('heading', { name: 'Audio analysis', exact: true })).toBeVisible({ timeout: 30000 });
  await expect(context).toHaveCount(0);
  await expect.poll(() => savedBodies.length).toBe(1);
  expect(savedBodies[0].song).toBeUndefined();
});
