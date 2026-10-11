import { expect, test, type Page } from '@playwright/test';
import { navigationTrack } from '../fixtures/navigation-track';
import { syntheticClip } from '../fixtures/synthetic-audio';

const selected = (page: Page) => page.getByRole('region', { name: 'Explore selected track' });
async function navigate(page: Page, name: 'Identify' | 'Discover') {
  const menu = page.getByRole('button', { name: 'Open menu', exact: true });
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole('navigation', { name: 'Primary mobile', exact: true }).getByRole('link', { name, exact: true }).click();
  } else {
    await page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name, exact: true }).click();
  }
}
async function pick(page: Page, title = navigationTrack.title, id = navigationTrack.spotifyId) {
  await page.route('**/api/songs/search?*', route => route.fulfill({ json: { hits: [{ id, song: { ...navigationTrack, title, spotifyId: id } }] } }));
  await page.getByRole('combobox').fill(title);
  await page.getByRole('row').first().getByRole('button').click();
  await expect(selected(page)).toContainText(title);
}

for (const width of [390, 768, 1440]) {
  test(`selected metadata follows artist and workbench links at ${width}px, clear survives back`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const prohibited: string[] = [];
    page.on('request', r => { if (r.url().includes('p.scdn.co') || r.method() === 'POST') prohibited.push(r.url()); });
    await page.goto('/discover'); await pick(page);
    await selected(page).getByRole('link', { name: 'Demo ensemble artist profile' }).focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Demo ensemble', exact: true })).toBeFocused();
    await page.getByRole('link', { name: 'Back to exploring' }).click();
    await expect(selected(page)).toContainText(navigationTrack.title);
    await expect(page.getByRole('combobox')).toHaveAttribute('placeholder', 'Find another track…');
    await selected(page).getByRole('link', { name: 'Analyze lyrics', exact: true }).click();
    await expect(selected(page)).toContainText(navigationTrack.title);
    await navigate(page, 'Identify');
    await expect(selected(page)).toContainText(navigationTrack.title);
    await page.goBack(); await expect(selected(page)).toContainText(navigationTrack.title);
    await page.getByRole('button', { name: 'Clear selected track' }).click();
    await page.goBack(); await expect(selected(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    expect(prohibited).toEqual([]);
  });
}

test('known artist credits explicitly reopen either track after reload; ordinary return does not restore a saved selection', async ({ page }) => {
  await page.goto('/discover'); await pick(page);
  await selected(page).getByRole('link', { name: 'Demo ensemble artist profile' }).click();
  await page.getByRole('link', { name: 'Back to exploring' }).click();
  await expect(selected(page)).toContainText(navigationTrack.title);
  await pick(page, 'Another original demo', 'navigation-replacement');
  await selected(page).getByRole('link', { name: 'Demo ensemble artist profile' }).click();
  await expect(page.getByRole('heading', { name: 'Demo ensemble', exact: true })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Explored track credits' }).getByRole('link', { name: /^Explore track:/ })).toHaveCount(2);
  await page.getByRole('link', { name: 'Back to exploring' }).click();
  await expect(selected(page)).toHaveCount(0);
  await page.goBack();
  await page.getByRole('link', { name: `Explore track: ${navigationTrack.title}`, exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(selected(page)).toContainText(navigationTrack.title);
  await expect(selected(page).getByRole('link', { name: 'Open in Spotify (opens in a new tab)' })).toHaveAttribute('href', 'https://open.spotify.com/track/navigation-demo');
  await selected(page).getByRole('link', { name: 'Demo ensemble artist profile' }).click();
  await page.getByRole('link', { name: 'Explore track: Another original demo', exact: true }).click();
  await expect(selected(page)).toContainText('Another original demo');
  await expect(selected(page)).not.toContainText(navigationTrack.title);
  await page.reload(); await expect(selected(page)).toHaveCount(0);
});

test('a real local clip clears the retained identity and its measurements stay on the audio page', async ({ page }) => {
  const posts: string[] = []; page.on('request', r => { if (r.method() === 'POST') posts.push(r.url()); });
  await page.goto('/discover'); await pick(page);
  await selected(page).getByRole('link', { name: 'Analyze a local file', exact: true }).click();
  await expect(selected(page)).toContainText(navigationTrack.title);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload audio file', exact: true }).click();
  await (await chooser).setFiles({ name: 'original-navigation.wav', mimeType: 'audio/wav', buffer: syntheticClip() });
  await expect(selected(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Local listening timeline' })).toBeVisible();
  await navigate(page, 'Discover');
  await expect(selected(page)).toHaveCount(0); await expect(page.getByRole('region', { name: 'Local listening timeline' })).toHaveCount(0);
  await page.goBack(); await expect(selected(page)).toHaveCount(0); await expect(page.getByRole('region', { name: 'Local listening timeline' })).toHaveCount(0);
  expect(posts).toEqual([]);
});

test('an interrupted search cannot replace retained metadata after leaving its page', async ({ page }) => {
  await page.goto('/discover'); await pick(page);
  await page.unroute('**/api/songs/search?*');
  let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void; const requested = new Promise<void>(resolve => { started = resolve; });
  await page.route('**/api/songs/search?*', async route => { started(); await pending; await route.fulfill({ json: { hits: [{ id: 'late', song: { ...navigationTrack, title: 'Late original demo', spotifyId: 'late' } }] } }).catch(() => {}); });
  await page.getByRole('combobox').fill('another track'); await requested;
  await selected(page).getByRole('link', { name: 'Demo ensemble artist profile' }).click(); release();
  await page.getByRole('link', { name: 'Back to exploring' }).click();
  await expect(selected(page)).toContainText(navigationTrack.title);
  await expect(page.getByRole('row')).toHaveCount(0);
});
