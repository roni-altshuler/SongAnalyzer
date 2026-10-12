/** Production-browser journey evidence. Original metadata fixtures are not provider successes. */
import { chromium, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { navigationTrack } from '../../playwright/fixtures/navigation-track';
import { syntheticClip } from '../../playwright/fixtures/synthetic-audio';

type AxeInstance = { withTags(tags: string[]): AxeInstance; analyze(): Promise<{ violations: Array<{ id: string; nodes: unknown[] }> }> };
type AxeConstructor = new (options: { page: Page }) => AxeInstance;
const require = createRequire(import.meta.url);
if (!process.env.NAVIGATION_AXE_PATH) throw new Error('Set NAVIGATION_AXE_PATH to an externally installed @axe-core/playwright package.');
const axeModule = require(process.env.NAVIGATION_AXE_PATH) as AxeConstructor & { default?: AxeConstructor };
const Axe = axeModule.default ?? axeModule;
const baseURL = process.env.NAVIGATION_QA_BASE_URL ?? 'http://localhost:3147';
const output = process.env.NAVIGATION_QA_OUTPUT ?? '/tmp/song-navigation-qa';
mkdirSync(output, { recursive: true });
const storeKey = 'song-analyzer.artist-context.v1';
const selected = (page: Page) => page.getByRole('region', { name: 'Explore selected track' });
const states: Array<{ state: string; width: number; theme: string; violations: string[]; overflow: number }> = [];
const journeys: Array<{ width: number; theme: string; actions: string[]; posts: string[]; externalRequests: string[]; pageErrors: string[] }> = [];
async function settled(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().endTime !== Infinity).map(a => a.finished.catch(() => {})));
  });
}
async function audit(page: Page, state: string, width: number, theme: string) {
  await settled(page);
  const result = await new Axe({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  states.push({ state, width, theme, violations: result.violations.map(v => v.id), overflow });
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.length })), state).toEqual([]);
  expect(overflow, state).toBeLessThanOrEqual(0);
}
async function pick(page: Page, title = navigationTrack.title, id = navigationTrack.spotifyId) {
  await page.route('**/api/songs/search?*', route => route.fulfill({ json: { hits: [{ id, song: { ...navigationTrack, title, spotifyId: id } }] } }));
  await page.getByRole('combobox').fill(title); await page.getByRole('row').first().getByRole('button').click();
  await expect(selected(page)).toContainText(title);
}
async function artist(page: Page) {
  await selected(page).getByRole('link', { name: 'Demo ensemble artist profile' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Demo ensemble', exact: true })).toBeFocused();
}
async function snapshot(page: Page, name: string) {
  await page.evaluate(() => scrollTo(0, 0)); await settled(page);
  await page.screenshot({ path: join(output, name), fullPage: true });
}
async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] });
  let liveSearchStatus: number | null = null;
  try {
    for (const width of [390, 768, 1440]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme === 'light' ? 'dark' : 'light', reducedMotion: theme === 'light' ? 'reduce' : 'no-preference' });
      await context.addInitScript(theme => localStorage.setItem('theme', theme), theme);
      const page = await context.newPage(), actions: string[] = [], posts: string[] = [], externalRequests: string[] = [], pageErrors: string[] = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      page.on('request', request => {
        const url = new URL(request.url());
        if (!['blob:', 'data:'].includes(url.protocol) && url.origin !== new URL(baseURL).origin) externalRequests.push(url.origin + url.pathname);
        if (request.method() === 'POST') posts.push(url.pathname);
      });
      await page.goto(`${baseURL}/discover`);
      if (liveSearchStatus === null) liveSearchStatus = (await page.request.get(`${baseURL}/api/songs/search?q=harbour`)).status();
      await pick(page); actions.push('Selected controlled original metadata'); await audit(page, 'selected-track', width, theme);
      await artist(page); actions.push('Keyboard artist link and focused heading'); await audit(page, 'artist-credits', width, theme);
      const explore = page.getByRole('link', { name: `Explore track: ${navigationTrack.title}`, exact: true });
      expect((await explore.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await snapshot(page, `artist-${width}-${theme}.png`);
      await page.getByRole('link', { name: 'Back to exploring' }).click();
      await expect(page).toHaveURL(/\/discover$/);
      await expect(selected(page)).toContainText(navigationTrack.title); await audit(page, 'returned-track', width, theme);
      if (width === 390) await snapshot(page, `returned-${width}-${theme}.png`);
      await selected(page).getByRole('link', { name: 'Add lyrics', exact: true }).click();
      await expect(page).toHaveURL(/\/analyze\?mode=lyrics#lyrics$/);
      await expect(selected(page)).toContainText(navigationTrack.title); await audit(page, 'lyrics-workbench', width, theme);
      await page.getByRole('navigation', { name: 'Footer', exact: true }).getByRole('link', { name: 'Identify', exact: true }).click();
      await expect(page).toHaveURL(/\/identify$/);
      await expect(selected(page)).toContainText(navigationTrack.title); await audit(page, 'identify-with-selected-metadata', width, theme);
      actions.push('Selected metadata retained through lyrics and Identify links; no recognition asserted');
      await page.goBack(); await expect(page).toHaveURL(/\/analyze\?mode=lyrics#lyrics$/); await expect(selected(page)).toContainText(navigationTrack.title);
      await page.goForward(); await expect(page).toHaveURL(/\/identify$/); await expect(selected(page)).toContainText(navigationTrack.title);
      await page.goBack(); await expect(page).toHaveURL(/\/analyze\?mode=lyrics#lyrics$/);
      await page.getByRole('button', { name: 'Clear selected track' }).click();
      await expect(selected(page)).toHaveCount(0); await audit(page, 'cleared-track', width, theme);
      await page.goBack(); await expect(page).toHaveURL(/\/discover$/); await expect(selected(page)).toHaveCount(0);
      await page.goForward(); await expect(page).toHaveURL(/\/analyze\?mode=lyrics#lyrics$/); await expect(selected(page)).toHaveCount(0);
      await page.goBack(); await expect(page).toHaveURL(/\/discover$/); await page.goBack();
      await expect(page).toHaveURL(/\/artists\/spotify\/demo-ensemble$/);
      await page.getByRole('link', { name: `Explore track: ${navigationTrack.title}`, exact: true }).focus(); await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/discover$/);
      await expect(selected(page)).toContainText(navigationTrack.title); await audit(page, 'explicit-credit-reselection', width, theme);
      actions.push('Selection and Clear persist through browser Back/Forward; keyboard Explore explicitly reselects known metadata');
      await pick(page, 'Another original demo', 'navigation-replacement'); await artist(page);
      await page.getByRole('link', { name: `Explore track: ${navigationTrack.title}`, exact: true }).click();
      await expect(page).toHaveURL(/\/discover$/);
      await expect(selected(page)).toContainText(navigationTrack.title);
      await expect(selected(page).getByRole('link', { name: 'Open in Spotify (opens in a new tab)' })).toHaveAttribute('href', 'https://open.spotify.com/track/navigation-demo');
      actions.push('Repeated replacement and reopening preserve exact source track ID');
      if (width === 390 && theme === 'light') {
        await page.unroute('**/api/songs/search?*');
        let release!: () => void, started!: () => void;
        const pending = new Promise<void>(resolve => { release = resolve; }), requested = new Promise<void>(resolve => { started = resolve; });
        await page.route('**/api/songs/search?*', async route => { started(); await pending; await route.fulfill({ json: { hits: [{ id: 'late', song: { ...navigationTrack, title: 'Late original demo' } }] } }).catch(() => {}); });
        await page.getByRole('combobox').fill('another track'); await requested;
        await artist(page); release(); await page.getByRole('link', { name: 'Back to exploring' }).click();
        await expect(page).toHaveURL(/\/discover$/);
        await expect(selected(page)).toContainText(navigationTrack.title); await expect(page.getByRole('row')).toHaveCount(0);
        actions.push('Interrupted search cannot affect the selected metadata after navigation');
        await selected(page).locator('summary').click();
        await selected(page).getByRole('link', { name: 'Analyze a local file', exact: true }).click();
        await expect(page).toHaveURL(/\/analyze\?mode=audio$/);
        const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Upload audio file', exact: true }).click();
        await (await chooser).setFiles({ name: 'original-navigation.wav', mimeType: 'audio/wav', buffer: syntheticClip() });
        await expect(page.getByRole('region', { name: 'Local listening timeline' })).toBeVisible({ timeout: 35000 });
        await expect(selected(page)).toHaveCount(0); await audit(page, 'real-local-file-clears-attribution', width, theme);
        await page.getByRole('navigation', { name: 'Footer', exact: true }).getByRole('link', { name: 'Discover', exact: true }).click();
        await expect(page).toHaveURL(/\/discover$/); await expect(selected(page)).toHaveCount(0); await page.goBack();
        await expect(page).toHaveURL(/\/analyze\?mode=audio$/);
        await expect(page.getByRole('region', { name: 'Local listening timeline' })).toHaveCount(0);
        actions.push('Real original WAV measured locally; unrelated metadata cleared; leaving discards page-local audio/results');
      }
      await page.reload(); await expect(selected(page)).toHaveCount(0);
      actions.push('Reload starts without selected metadata');
      expect(posts).toEqual([]); expect(externalRequests).toEqual([]); expect(pageErrors).toEqual([]);
      journeys.push({ width, theme, actions, posts, externalRequests, pageErrors }); await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => localStorage.setItem('theme', 'light'));
    const page = await context.newPage(), pageErrors: string[] = []; page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(`${baseURL}/discover`); await page.getByRole('combobox').fill('harbour');
    await expect(page.getByRole('status').filter({ hasText: 'Search unavailable' })).toContainText('Song search is unavailable right now'); await audit(page, 'live-search-unconfigured', 390, 'light');
    await snapshot(page, 'live-search-error-390-light.png');
    await page.goto(`${baseURL}/artists/spotify/no-context`);
    await expect(page.getByText('No track credits are available in this tab.', { exact: false })).toBeVisible(); await audit(page, 'new-visit-empty-profile', 390, 'light');
    await page.evaluate(key => sessionStorage.setItem(key, '{broken'), storeKey); await page.reload();
    await expect(page.getByRole('region', { name: 'Artist profile' }).getByRole('alert')).toContainText('Artist context could not load');
    await audit(page, 'retryable-context-error', 390, 'light');
    await page.evaluate(key => sessionStorage.removeItem(key), storeKey); await page.getByRole('button', { name: 'Try loading again' }).click();
    await expect(page.getByText('No track credits are available in this tab.', { exact: false })).toBeVisible();
    await page.addInitScript(`const originalSet = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === '${storeKey}') throw new Error('Storage blocked for QA'); return originalSet.call(this, key, value); };`);
    await page.goto(`${baseURL}/discover`); await pick(page); await artist(page);
    await expect(page.getByRole('status')).toContainText('could not keep it for a page reload');
    await audit(page, 'temporary-context', 390, 'light');
    await page.getByRole('link', { name: `Explore track: ${navigationTrack.title}`, exact: true }).click();
    await expect(selected(page)).toContainText(navigationTrack.title); expect(pageErrors).toEqual([]);
    await context.close();
    writeFileSync(join(output, 'report.json'), JSON.stringify({
      recordedAt: new Date().toISOString(), runtime: 'next start production build in the saved cloud environment', browser: browser.version(),
      fixture: 'Original controlled metadata; no real provider success, artist identity, match score or model accuracy asserted. Local file uses the original synthetic WAV generator and real browser engines.',
      liveSearchStatus, themes: 'Saved light/dark opposite OS; reduced motion on light; normal motion on dark', states, journeys,
      limitations: 'Live Spotify search unconfigured; Supabase/RLS and hosted preview browser unavailable. Existing OG/Twitter missing-config behavior unchanged.',
    }, null, 2));
    console.log(JSON.stringify({ browser: browser.version(), liveSearchStatus, scans: states.length, journeys: journeys.length, output }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
