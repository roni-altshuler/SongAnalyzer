import { expect, test } from '@playwright/test';
import { syntheticClip } from '../fixtures/synthetic-audio';

const fixtureSong = {
  title: 'Synthetic Northern Lights — a long track title for the listening studio',
  artist: 'Original test recording',
  geniusId: 123456,
};
const spotifySong = { ...fixtureSong, spotifyId: 'synthetic-track', metadataSource: 'spotify', previewUrl: 'https://p.scdn.co/prohibited.mp3' };
async function searchFixture(page: import('@playwright/test').Page, song: typeof fixtureSong & { previewUrl?: string }) {
  await page.route('**/api/songs/search?*', (route) => route.fulfill({ json: { hits: [{ id: 'synthetic-track', score: 1, song }] } }));
  await page.getByRole('combobox', { name: 'Search for a song' }).fill('Synthetic');
  await page.getByRole('row').first().getByRole('button').click();
}
function watchErrors(page: import('@playwright/test').Page) {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message)); return errors;
}
const localClip = { name: 'synthetic.wav', mimeType: 'audio/wav', buffer: syntheticClip() };

// Actual zero-config lookup: availability, not recognition accuracy or RLS.
test('catalog failure is distinct from a genuine no-match', async ({ page }) => {
  const errors = watchErrors(page); await page.goto('/identify');
  await page.locator('input[type="file"]').setInputFiles(localClip);
  await expect(page.getByRole('status')).toContainText('Recognition catalog unavailable.', { timeout: 30_000 });
  await expect(page.getByText('No catalog match.', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Analyze a local clip', exact: true }).click();
  await expect(page.getByRole('tab', { name: /Audio/ })).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});

for (const width of [390, 768, 1440]) {
  test(`matched Spotify metadata stays useful without preview analysis at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); const errors = watchErrors(page);
    const prohibited: string[] = [];
    page.on('request', (r) => { if (r.url().includes('p.scdn.co') || (r.method() === 'POST' && /api\/(analyses|fingerprints|songs\/.*\/features)/.test(r.url()))) prohibited.push(r.url()); });
    await page.route('**/api/identify', (route) => route.fulfill({ json: { status: 'matched', song: spotifySong, match: { votes: 40, confidence: 0.8 } } }));
    await page.goto('/identify'); await page.locator('input[type="file"]').setInputFiles(localClip);
    const context = page.getByLabel('Explore selected track'); await expect(context).toBeVisible({ timeout: 30_000 });
    await expect(context.getByRole('status')).toHaveText('Audio insights unavailable');
    await expect(context).toContainText('Track metadata supplied by Spotify');
    await expect(context.getByRole('link', { name: 'Analyze a local file' })).toHaveAttribute('href', '/analyze?mode=audio');
    await expect(context.getByRole('link', { name: 'Open in Spotify' })).toHaveAttribute('href', 'https://open.spotify.com/track/synthetic-track');
    await expect(context.getByRole('button', { name: /Retry/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Audio analysis', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Identify another', exact: true }).click();
    await expect(context).toHaveCount(0); expect(prohibited).toEqual([]); expect(errors).toEqual([]);
  });
}

test('search selection cannot fetch an unreviewed preview and clears with keyboard focus', async ({ page }) => {
  const prohibited: string[] = []; page.on('request', (r) => { if (r.url().includes('/fixtures/unreviewed.wav')) prohibited.push(r.url()); });
  await page.goto('/discover'); await searchFixture(page, { ...fixtureSong, previewUrl: '/fixtures/unreviewed.wav' });
  const context = page.getByLabel('Explore selected track');
  await expect(context.getByRole('status')).toHaveText('Audio insights unavailable');
  await expect(context).toContainText('original source unverified');
  await expect(page.getByRole('button', { name: 'Retry audio clip', exact: true })).toHaveCount(0);
  await context.getByRole('button', { name: 'Clear selected track' }).focus(); await page.keyboard.press('Enter');
  await expect(context).toHaveCount(0); await expect(page.getByRole('combobox', { name: 'Search for a song' })).toBeFocused();
  expect(prohibited).toEqual([]);
});

test('a completed lookup shows a genuine no-match', async ({ page }) => {
  await page.route('**/api/identify', (route) => route.fulfill({ json: { status: 'no_match', fallbackAvailable: false } }));
  await page.goto('/identify'); await page.locator('input[type="file"]').setInputFiles(localClip);
  await expect(page.getByRole('status')).toContainText('No catalog match.', { timeout: 30_000 });
  await expect(page.getByText('Recognition catalog unavailable.', { exact: true })).toHaveCount(0);
});

test('exploration links and browser back/forward preserve the expected mode', async ({ page }) => {
  await page.goto('/discover'); await searchFixture(page, fixtureSong);
  await page.getByRole('region', { name: 'Explore selected track' }).getByRole('link', { name: 'Analyze lyrics', exact: true }).click();
  await expect(page).toHaveURL(/analyze\?mode=lyrics/); await expect(page.getByRole('tab', { name: /Lyrics/ })).toHaveAttribute('aria-selected', 'true');
  await page.goBack(); await expect(page).toHaveURL(/discover$/); await expect(page.getByRole('combobox', { name: 'Search for a song' })).toBeVisible();
  await page.goForward(); await expect(page).toHaveURL(/analyze\?mode=lyrics/); await expect(page.getByRole('tab', { name: /Lyrics/ })).toHaveAttribute('aria-selected', 'true');
});

test('local fixture uses the real worker without saved results or unrelated metadata', async ({ page }) => {
  const errors = watchErrors(page); const writes: string[] = [];
  page.on('request', (r) => { if (r.method() === 'POST') writes.push(r.url()); });
  await page.goto('/analyze'); await searchFixture(page, spotifySong);
  const context = page.getByRole('region', { name: 'Explore selected track' });
  await context.getByRole('button', { name: 'Analyze a local file', exact: true }).click();
  await expect(page.getByRole('tab', { name: /Audio/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /Audio/ })).toBeFocused();
  await page.locator('#audio-file').setInputFiles(localClip);
  await expect(page.getByRole('heading', { name: 'Audio analysis', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await expect(context).toHaveCount(0); await expect(page.getByText('not added to the recognition catalog', { exact: false })).toBeVisible();
  expect(writes).toEqual([]); expect(errors).toEqual([]);
});

test('AudD disclosure and declining consent never upload the clip', async ({ page }) => {
  let uploads = 0;
  await page.route('**/api/identify', (route) => route.fulfill({ json: { status: 'no_match', fallbackAvailable: true } }));
  await page.route('**/api/identify/fallback', (route) => { uploads++; return route.fulfill({ json: { status: 'no_match' } }); });
  await page.goto('/identify'); await page.locator('input[type="file"]').setInputFiles(localClip);
  await page.getByRole('button', { name: 'Try AudD recognition' }).click();
  const consent = page.getByRole('region', { name: 'AudD audio sharing consent' });
  await expect(consent).toContainText('will leave your device'); expect(uploads).toBe(0);
  await consent.getByRole('button', { name: 'Keep audio on device' }).click();
  await expect(page.getByRole('button', { name: 'Start listening' })).toBeVisible(); expect(uploads).toBe(0);
});

test('only explicit AudD confirmation reaches the mocked relay', async ({ page }) => {
  let uploads = 0;
  await page.route('**/api/identify', (route) => route.fulfill({ json: { status: 'no_match', fallbackAvailable: true } }));
  await page.route('**/api/identify/fallback', (route) => { uploads++; expect(route.request().postData()).toContain('audd-recognition'); return route.fulfill({ json: { status: 'no_match' } }); });
  await page.goto('/identify'); await page.locator('input[type="file"]').setInputFiles(localClip);
  await page.getByRole('button', { name: 'Try AudD recognition' }).click(); expect(uploads).toBe(0);
  await page.getByRole('button', { name: 'Send clip to AudD' }).click();
  await expect(page.getByRole('status')).toContainText('Still no match.'); expect(uploads).toBe(1);
});

test('navigating away during a catalog lookup cannot select or analyze a late match', async ({ page }) => {
  let release!: () => void; let requested!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; }); const started = new Promise<void>((resolve) => { requested = resolve; });
  const prohibited: string[] = []; page.on('request', (r) => { if (r.url().includes('p.scdn.co') || (r.method() === 'POST' && /api\/(analyses|fingerprints)/.test(r.url()))) prohibited.push(r.url()); });
  await page.route('**/api/identify', async (route) => { requested(); await pending; await route.fulfill({ json: { status: 'matched', song: spotifySong, match: { confidence: 0.8 } } }).catch(() => undefined); });
  await page.goto('/identify'); await page.locator('input[type="file"]').setInputFiles(localClip); await started;
  await page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name: 'Discover' }).click();
  await expect(page).toHaveURL(/discover$/); release();
  await expect(page.getByLabel('Explore selected track')).toHaveCount(0); expect(prohibited).toEqual([]);
});

test('audio and indexing server endpoints fail closed even without configuration', async ({ request }) => {
  for (const [url, body] of [
    ['/api/analyses', { mode: 'audio', result: { mood: 'Happy' }, source: 'upload', permission: 'granted' }],
    ['/api/fingerprints', { source: 'upload', hashes: [{ h: 42, t: 100 }] }],
    ['/api/songs/00000000-0000-4000-8000-000000000001/features', { vector: [] }],
  ] as const) {
    const response = await request.post(url, { data: body }); expect(response.status()).toBe(403);
    expect(await response.json()).toMatchObject({ status: 'audio_persistence_disabled' });
  }
});

test('search grid supports keyboard selection without reopening for the selected label', async ({ page }) => {
  let searches = 0;
  await page.route('**/api/songs/search?*', (route) => {
    searches++;
    return route.fulfill({ json: { hits: [
      { id: 'first', score: 1, song: spotifySong },
      { id: 'second', score: 0.8, song: { ...spotifySong, title: 'Second recording', spotifyId: 'second' } },
    ] } });
  });
  await page.goto('/discover'); const search = page.getByRole('combobox'); await search.fill('Synthetic');
  await expect(page.getByRole('grid', { name: 'Song results' })).toBeVisible();
  await search.press('ArrowDown'); await expect(page.getByRole('row').nth(1)).toHaveAttribute('aria-selected', 'true');
  await search.press('Enter'); await expect(page.getByLabel('Explore selected track')).toContainText('Second recording');
  await expect(page.getByRole('grid')).toHaveCount(0);
  await expect(page.getByLabel('Explore selected track').getByRole('link', { name: 'Open in Spotify' })).toHaveAttribute('href', 'https://open.spotify.com/track/second');
  await page.getByRole('button', { name: 'Clear selected track' }).click(); await expect(search).toBeFocused();
  await expect(page.getByRole('grid')).toHaveCount(0); expect(searches).toBe(1);
});
