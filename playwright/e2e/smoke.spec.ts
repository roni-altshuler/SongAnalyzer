/**
 * Smoke E2E for the SongAnalyzer v2 happy path.
 *
 * The suite intentionally runs without any environment configuration —
 * no Supabase, no Hugging Face token, no Spotify creds — so it exercises
 * the keyword-fallback engine and the fail-soft data-layer paths.
 *
 * Coverage:
 *   1. Home page renders the new dark hero with display-serif headline
 *   2. Lyrics analyze flow returns a result, surfaces engine provenance,
 *      and cascades a mood accent gradient through the page
 *   3. Design-system showcase loads
 *   4. Mood Atlas overview renders (empty-state or seeded — both fine)
 *   5. Share page with a bogus slug returns a 404 (not 500)
 */

import { expect, test } from '@playwright/test';

test.describe('SongAnalyzer v2 smoke', () => {
  test('home renders the dark v2 hero', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('The mood of');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('decoded');
    await expect(page.getByRole('tab', { name: /Lyrics/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Audio/i })).toBeVisible();
  });

  test('lyrics analyze flow returns a result via the keyword fallback', async ({ page }) => {
    await page.goto('/');

    const textarea = page.getByRole('textbox');
    await textarea.fill(
      'Love and sunshine, beautiful day, hope alive and bright. ' +
        'Dancing through the night, joy and freedom forever.',
    );

    await page.getByRole('button', { name: /^Analyze lyrics/i }).click();

    // Wait for the analysis card to land — its accent dot has a known style.
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

  test('design-system showcase renders', async ({ page }) => {
    await page.goto('/dev/components');
    await expect(page).toHaveURL(/\/dev\/components$/);
    // Showcase always renders the wordmark / heading region.
    await expect(page.locator('body')).toBeVisible();
  });

  test('Mood Atlas overview responds with 200', async ({ page }) => {
    const response = await page.goto('/atlas');
    // 200 whether or not Supabase is configured — Atlas pages render an
    // empty-state Card on missing data instead of crashing.
    expect(response?.status()).toBe(200);
  });

  test('share page with a bogus slug returns 404 (not 500)', async ({ page }) => {
    const response = await page.goto('/share/this-slug-does-not-exist');
    expect(response?.status()).toBe(404);
  });
});
