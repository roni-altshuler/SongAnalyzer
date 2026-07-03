/**
 * Smoke E2E for the SongAnalyzer v3 happy path.
 *
 * The suite intentionally runs without any environment configuration —
 * no Supabase, no Hugging Face token, no Spotify creds, no AudD — so it
 * exercises the keyword-fallback engine, the fail-soft data-layer paths,
 * and the Identify flow's degraded states.
 *
 * Coverage:
 *   1. Landing page renders the hero + nav shell with the four sections
 *   2. /analyze lyrics flow returns a result via the keyword fallback and
 *      cascades a mood accent gradient through the page
 *   3. /identify renders, mic capture starts (fake media stream), and the
 *      no-match/degraded state resolves without a crash
 *   4. /discover renders its empty state
 *   5. Design-system showcase loads
 *   6. Mood Atlas overview renders (empty-state or seeded — both fine)
 *   7. Share page with a bogus slug returns a 404 (not 500)
 */

import { expect, test } from '@playwright/test';

test.describe('SongAnalyzer v3 smoke', () => {
  test('landing renders the hero and nav shell', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('fingerprint');
    const nav = page.getByRole('navigation', { name: 'Primary' });
    for (const label of ['Identify', 'Analyze', 'Discover', 'Atlas']) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('analyze lyrics flow returns a result via the keyword fallback', async ({ page }) => {
    await page.goto('/analyze');

    await expect(page.getByRole('tab', { name: /Lyrics/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Audio/i })).toBeVisible();

    const textarea = page.getByRole('textbox');
    await textarea.fill(
      'Love and sunshine, beautiful day, hope alive and bright. ' +
        'Dancing through the night, joy and freedom forever.',
    );

    await page.getByRole('button', { name: /^Analyze lyrics/i }).click();

    await expect(page.getByRole('heading', { name: 'Analysis' })).toBeVisible({
      timeout: 20_000,
    });

    // Engine provenance: without HF token, transformer shows as skipped.
    await expect(page.getByText(/transformer/i).first()).toBeVisible();
    await expect(page.getByText(/keyword/i).first()).toBeVisible();

    // Mood color cascade: --accent-from is set on <html> after a result.
    const accentFrom = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent-from').trim(),
    );
    expect(accentFrom).toMatch(/^#[0-9a-f]{3,8}$/i);
  });

  test('analyze mode is deep-linkable via ?mode=audio', async ({ page }) => {
    await page.goto('/analyze?mode=audio');
    await expect(page.getByText(/Ready to listen/i)).toBeVisible();
  });

  test('identify listens on a fake mic and resolves without crashing', async ({ page }) => {
    await page.goto('/identify');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('beat');

    // Start listening — fake media stream grants a silent mic.
    await page.getByRole('button', { name: /Start listening/i }).click();
    await expect(page.getByText(/Listening…/)).toBeVisible({ timeout: 10_000 });

    // Cut the capture short and let the pipeline resolve. With no Supabase
    // configured the store degrades to no_match; silence may also fail to
    // produce hashes. Either terminal state is fine — never a crash.
    await page.getByRole('button', { name: /Match now/i }).click();
    await expect(
      page
        .getByText(/Not in the catalog yet|Still no match|didn’t work|Hmm/i)
        .first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('discover renders its empty state', async ({ page }) => {
    await page.goto('/discover');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('feels the same');
    await expect(page.getByText(/Every analysis grows the map/i)).toBeVisible();
  });

  test('design-system showcase renders', async ({ page }) => {
    await page.goto('/dev/components');
    await expect(page).toHaveURL(/\/dev\/components$/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('Mood Atlas overview responds with 200', async ({ page }) => {
    const response = await page.goto('/atlas');
    expect(response?.status()).toBe(200);
  });

  test('share page with a bogus slug returns 404 (not 500)', async ({ page }) => {
    const response = await page.goto('/share/this-slug-does-not-exist');
    expect(response?.status()).toBe(404);
  });
});
