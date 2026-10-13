import { expect, test, type Page } from '@playwright/test';
import { analyzeKeyword } from '../../lib/analysis/keyword';
import { blendResults } from '../../lib/analysis/blend';
import { navigationTrack } from '../fixtures/navigation-track';

const originalText = 'Love and sunshine, beautiful day, hope alive and bright. Dancing through the night, joy and freedom forever.';
const reading = {
  ...blendResults({ keyword: analyzeKeyword(originalText), transformer: null, transformerStatus: 'skipped' }),
  originalLanguage: 'English', translated: false,
};

async function analyze(page: Page) {
  // Existing pure engines on original text; no provider or persistence calls.
  await page.route('**/api/analyze', route => route.fulfill({ json: reading }));
  await page.route('**/api/analyses', route => route.fulfill({ status: 503, json: { status: 'unavailable' } }));
  await page.locator('#lyrics').fill(originalText);
  await page.getByRole('button', { name: 'Analyze lyrics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible();
}

for (const width of [390, 768, 1440]) for (const theme of ['light', 'dark'] as const) {
  test(`engine details returns focus through dismissal and reopening at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light', reducedMotion: theme === 'light' ? 'reduce' : 'no-preference' });
    await page.addInitScript(savedTheme => localStorage.setItem('theme', savedTheme), theme);
    await page.goto('/analyze?mode=lyrics'); await analyze(page);
    const opener = page.getByRole('button', { name: 'Show engine details' });
    const dialog = page.getByRole('dialog', { name: 'Engine details' });
    await opener.focus(); await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    // The open modal correctly hides its background opener from the accessibility tree.
    await expect(page.getByRole('button', { name: 'Show engine details', includeHidden: true })).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
    await expect(opener).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press('Space'); await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();

    await page.keyboard.press('Enter'); await expect(dialog).toBeVisible();
    // A genuine pointer dismissal on the overlay, outside the dialog at every width.
    await page.mouse.click(2, 450);
    await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
    await page.keyboard.press('Enter'); await expect(dialog).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    await page.keyboard.press('Escape'); await expect(opener).toBeFocused();

    await expect(page).toHaveURL(/\/analyze\?mode=lyrics$/);
    await expect(page.locator('#lyrics')).toHaveValue(originalText);
    await expect(page.getByRole('progressbar', { name: 'Analysis confidence' })).toHaveAttribute('aria-valuenow', '55');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
}

for (const width of [390, 1440]) {
  test(`navigation away from open engine details keeps the destination focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/songs/search?*', route => route.fulfill({ json: { hits: [{ id: navigationTrack.spotifyId, song: navigationTrack }] } }));
    await page.goto('/discover'); await page.getByRole('combobox').fill(navigationTrack.title);
    await page.getByRole('row').first().getByRole('button').click();
    await page.getByRole('region', { name: 'Explore selected track' }).getByRole('link', { name: 'Add lyrics', exact: true }).click();
    await expect(page.locator('#lyrics')).toBeFocused(); await analyze(page);
    await page.getByRole('button', { name: 'Show engine details' }).focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Engine details' })).toBeVisible();
    await page.goBack(); await expect(page).toHaveURL(/\/discover$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const search = page.getByRole('combobox'); await search.focus();
    // Let deferred dialog cleanup complete before checking the intentional destination focus.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(search).toBeFocused();
    await expect(page.getByRole('region', { name: 'Explore selected track' })).toContainText(navigationTrack.title);
    await page.goForward(); await expect(page).toHaveURL(/\/analyze\?mode=lyrics#lyrics$/);
    await expect(page.locator('#lyrics')).toHaveValue('');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toHaveCount(0);
  });
}
