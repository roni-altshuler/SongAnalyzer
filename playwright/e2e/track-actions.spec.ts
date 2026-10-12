import { expect, test, type Page } from '@playwright/test';
import { navigationTrack } from '../fixtures/navigation-track';

const selected = (page: Page) => page.getByRole('region', { name: 'Explore selected track' });
async function pick(page: Page, title = navigationTrack.title, id = navigationTrack.spotifyId) {
  await page.route('**/api/songs/search?*', r => r.fulfill({ json: { hits: [{ id, song: { ...navigationTrack, title, spotifyId: id } }] } }));
  await page.getByRole('combobox').fill(title); await page.getByRole('row').first().getByRole('button').click();
  await expect(selected(page)).toContainText(title);
}

for (const width of [390, 768, 1440]) test(`lyrics handoff reaches its input with one unambiguous submit control at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const posts: string[] = []; page.on('request', r => { if (r.method() === 'POST') posts.push(r.url()); });
  await page.goto('/discover'); await pick(page);
  await expect(selected(page).getByRole('link', { name: 'Analyze a local file', exact: true })).toHaveCount(0);
  await selected(page).getByRole('link', { name: 'Add lyrics', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/analyze\?mode=lyrics#lyrics$/);
  await expect(page.locator('#lyrics')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Analyze lyrics', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Analyze lyrics', exact: true })).toBeDisabled();
  await expect.poll(async () => {
    const box = await page.locator('#lyrics').boundingBox();
    return Boolean(box && box.y >= 60 && box.y + box.height <= 900);
  }).toBe(true);
  await page.goBack(); await expect(page).toHaveURL(/\/discover$/); await expect(selected(page)).toContainText(navigationTrack.title);
  await page.goForward(); await expect(page).toHaveURL(/\/analyze\?mode=lyrics#lyrics$/); await expect(page.locator('#lyrics')).toBeFocused();
  expect(posts).toEqual([]);
});

test('audio options use native keyboard disclosure and reset on a replacement track', async ({ page }) => {
  await page.goto('/discover'); await pick(page);
  const details = selected(page).locator('details'), summary = details.locator('summary');
  await summary.focus(); await page.keyboard.press('Enter'); await expect(details).toHaveAttribute('open', '');
  await expect(details.getByRole('status')).toContainText('Audio insights unavailable');
  await expect(details).toContainText('Remote previews are not available for analysis here');
  await summary.focus(); await page.keyboard.press('Space'); await expect(details).not.toHaveAttribute('open', '');
  await summary.click(); await pick(page, 'Another original action demo', 'another-action-demo');
  await expect(details).not.toHaveAttribute('open', '');
  await expect(selected(page)).toContainText('Another original action demo');
});

test('same-page Add lyrics switches audio mode to the input and preserves a draft on repeated activation', async ({ page }) => {
  await page.goto('/analyze?mode=audio'); await pick(page);
  await selected(page).getByRole('button', { name: 'Add lyrics', exact: true }).click();
  await expect(page).toHaveURL(/\/analyze\?mode=lyrics$/); await expect(page.locator('#lyrics')).toBeFocused();
  await page.locator('#lyrics').fill('Original draft for an action check.');
  await selected(page).getByRole('button', { name: 'Add lyrics', exact: true }).click();
  await expect(page.locator('#lyrics')).toBeFocused(); await expect(page.locator('#lyrics')).toHaveValue('Original draft for an action check.');
  await page.getByRole('navigation', { name: 'Footer', exact: true }).getByRole('link', { name: 'Discover', exact: true }).click();
  await expect(page).toHaveURL(/\/discover$/); await expect(selected(page)).toContainText(navigationTrack.title);
  await page.goBack(); await expect(page).toHaveURL(/\/analyze\?mode=lyrics$/); await expect(page.locator('#lyrics')).toHaveValue('');
});
