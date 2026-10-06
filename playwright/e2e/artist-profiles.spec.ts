import { expect, test, type Page } from '@playwright/test';
import type { Song } from '../../lib/sources/types';

const song: Song = {
  title: 'Letters from the harbour', artist: 'Arden, June, The Night Shift', album: 'Paper skies', year: 2024,
  spotifyId: 'fixture-track', metadataSource: 'spotify', previewUrl: 'https://p.scdn.co/prohibited.mp3',
  coverUrl: '/fixtures/album-art.svg',
  artistCredits: [
    { provider: 'spotify', id: 'arden-june', name: 'Arden, June', entityType: 'Unknown' },
    { provider: 'spotify', id: 'night-shift', name: 'The Night Shift', entityType: 'Unknown' },
  ],
};
const storeKey = 'song-analyzer.artist-context.v1';

async function selectTrack(page: Page, selected: Song = song) {
  await page.route('**/api/songs/search?*', route => route.fulfill({ json: { hits: [{ id: selected.spotifyId, score: 1, song: selected }] } }));
  await page.route('**/fixtures/album-art.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#d0c7b9"/></svg>' }));
  await page.goto('/discover');
  await page.getByRole('combobox').fill('harbour');
  await page.getByRole('row').first().getByRole('button').click();
}

test('ordered artists have separate stable profiles and album art never becomes a portrait', async ({ page }) => {
  const errors: string[] = []; const prohibited: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url().includes('p.scdn.co') || /api\/(analyses|fingerprints|identify)/.test(r.url()) || /api\.spotify\.com.*artists/.test(r.url())) prohibited.push(r.url()); });
  await selectTrack(page);
  const credits = page.getByRole('list', { name: 'Credited artists' });
  await expect(credits.getByRole('link')).toHaveCount(2);
  await expect(credits.getByRole('link').nth(0)).toHaveAttribute('href', '/artists/spotify/arden-june');
  await expect(credits.getByRole('link').nth(1)).toHaveAttribute('href', '/artists/spotify/night-shift');
  await credits.getByRole('link').first().focus(); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/artists\/spotify\/arden-june$/);
  await expect(page.getByRole('heading', { name: 'Arden, June', exact: true })).toBeFocused();
  await expect(page.getByText('Artist type: Unknown', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View artist on Spotify (opens in a new tab)' })).toHaveAttribute('href', 'https://open.spotify.com/artist/arden-june');
  await expect(page.getByRole('region', { name: 'Explored track credits' })).toContainText(song.title);
  await expect(page.getByRole('figure', { name: 'Artist visual' }).locator('img')).toHaveCount(0);
  await expect(page.getByText('Related readings unavailable', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'The Night Shift artist profile' }).click();
  await expect(page).toHaveURL(/\/artists\/spotify\/night-shift$/);
  await expect(page.getByRole('heading', { name: 'The Night Shift', exact: true })).toBeVisible();
  await page.goBack(); await expect(page.getByRole('heading', { name: 'Arden, June', exact: true })).toBeVisible();
  await page.goForward(); await expect(page.getByRole('heading', { name: 'The Night Shift', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', { name: 'The Night Shift', exact: true })).toBeVisible();
  expect(prohibited).toEqual([]); expect(errors).toEqual([]);
});

test('direct profile references are honest about missing tab data and add no provider requests', async ({ page }) => {
  const requests: string[] = []; page.on('request', r => { if (r.url().includes('/api/')) requests.push(r.url()); });
  await page.goto('/artists/spotify/no-context');
  await expect(page.getByRole('heading', { name: 'Artist profile', exact: true })).toBeVisible();
  await expect(page.getByText('No track credits are available in this tab.', { exact: false })).toBeVisible();
  await expect(page.getByText('Artist type: Unknown', { exact: true })).toBeVisible();
  expect(requests).toEqual([]);
});

test('invalid artist namespaces cannot masquerade as artist profiles', async ({ page }) => {
  const response = await page.goto('/artists/album/not-an-artist'); expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
});

test('legacy comma-joined credits remain unlinked instead of being split into identities', async ({ page }) => {
  await selectTrack(page, { ...song, artistCredits: [] });
  await expect(page.getByLabel('Explore selected track')).toContainText(song.artist);
  await expect(page.getByLabel('Explore selected track')).toContainText('source artist IDs missing');
  await expect(page.getByRole('link', { name: /artist profile$/ })).toHaveCount(0);
});

test('long unbroken artist names fit selected credits and the phone profile without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const name = 'TheNightsBetweenTheHarbourAndTheHillsWithAnUnusuallyLongUnbrokenArtistName';
  await selectTrack(page, { ...song, artistCredits: [{ provider: 'spotify', id: 'long-name', name, entityType: 'Unknown' }] });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: `${name} artist profile` }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('storage denial gives a temporary useful profile without promising reload persistence', async ({ page }) => {
  await page.addInitScript(`const originalSet = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === '${storeKey}') throw new Error('Storage blocked for QA'); return originalSet.call(this, key, value); };`);
  await selectTrack(page);
  await page.getByRole('link', { name: 'Arden, June artist profile' }).click();
  await expect(page.getByRole('heading', { name: 'Arden, June', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('could not keep it for a page reload');
});

test('corrupt tab context has a retryable error rather than a false empty collection', async ({ page }) => {
  await page.goto('/artists/spotify/corrupt-context');
  await page.evaluate(key => sessionStorage.setItem(key, '{broken'), storeKey);
  await page.reload();
  const alert = page.getByRole('region', { name: 'Artist profile' }).getByRole('alert');
  await expect(alert).toContainText('Artist context could not load');
  await expect(page.getByRole('region', { name: 'Explored track credits' })).toContainText('Track credits could not load');
  await expect(page.getByText('No track credits are available in this tab.', { exact: false })).toHaveCount(0);
  await expect(page.getByText('This tab has no name or track credits', { exact: false })).toHaveCount(0);
  await page.evaluate(key => sessionStorage.removeItem(key), storeKey);
  await page.getByRole('button', { name: 'Try loading again' }).click();
  await expect(alert).toHaveCount(0);
  await expect(page.getByText('No track credits are available in this tab.', { exact: false })).toBeVisible();
});

for (const entityType of ['Person', 'Group'] as const) {
  test(`explicit ${entityType} evidence is shown with a visual fallback, never inferred from a name`, async ({ page }) => {
    const name = entityType === 'Person' ? 'Nora, Vale & Company' : 'Vale';
    await selectTrack(page, { ...song, artistCredits: [{ provider: 'musicbrainz', id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', name, entityType, typeEvidence: 'musicbrainz:artist.type' }] });
    await page.getByRole('link', { name: `${name} artist profile` }).click();
    await expect(page.getByText(`Artist type: ${entityType}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${entityType} · supplied by MusicBrainz`, { exact: true })).toBeVisible();
    await expect(page.getByRole('figure', { name: 'Artist visual' }).locator('img')).toHaveCount(0);
  });
}

test('artist hydration shows genuine loading before tab context is read', async ({ page }) => {
  let release!: () => void; const scripts = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/*.js*', async route => { await scripts; await route.continue(); });
  try {
    await page.goto('/artists/spotify/loading-context', { waitUntil: 'commit' });
    await expect(page.getByRole('region', { name: 'Artist profile' })).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('status')).toContainText('Loading artist context…');
  } finally { release(); }
  await expect(page.getByRole('region', { name: 'Artist profile' })).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByText('No track credits are available in this tab.', { exact: false })).toBeVisible();
});
