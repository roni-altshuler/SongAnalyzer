/** Production-browser evidence using original metadata/text/PCM; no provider-success or accuracy claim. */
import { chromium, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { navigationTrack } from '../../playwright/fixtures/navigation-track';
import { syntheticClip } from '../../playwright/fixtures/synthetic-audio';
import { analyzeKeyword } from '../../lib/analysis/keyword';
import { blendResults } from '../../lib/analysis/blend';

type AxeInstance = { withTags(tags: string[]): AxeInstance; analyze(): Promise<{ violations: Array<{ id: string; nodes: unknown[] }> }> };
type AxeConstructor = new (options: { page: Page }) => AxeInstance;
const require = createRequire(import.meta.url);
if (!process.env.HANDOFF_AXE_PATH) throw new Error('Set HANDOFF_AXE_PATH to an externally installed @axe-core/playwright package.');
const axeModule = require(process.env.HANDOFF_AXE_PATH) as AxeConstructor & { default?: AxeConstructor };
const Axe = axeModule.default ?? axeModule;
const base = process.env.HANDOFF_QA_URL ?? 'http://localhost:3157';
const output = process.env.HANDOFF_QA_OUTPUT ?? '/tmp/song-handoff-qa';
mkdirSync(output, { recursive: true });
const originalText = 'Love and sunshine, beautiful day, hope alive and bright. Dancing through the night, joy and freedom forever.';
const keyword = analyzeKeyword(originalText);
const reading = { ...blendResults({ keyword, transformer: null, transformerStatus: 'skipped' }), originalLanguage: 'English', translated: false };
const clip = { name: 'original-handoff.wav', mimeType: 'audio/wav', buffer: syntheticClip() };
const selected = (page: Page) => page.getByRole('region', { name: 'Explore selected track' });
const states: Array<{ state: string; width: number; theme: string; violations: string[]; overflow: number }> = [];
const journeys: unknown[] = [];
const focusMeasurements: unknown[] = [];

async function settled(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().endTime !== Infinity).map(a => a.finished.catch(() => {})));
  });
}
async function audit(page: Page, state: string, width: number, theme: string) {
  await settled(page);
  const axe = await new Axe({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  states.push({ state, width, theme, violations: axe.violations.map(v => v.id), overflow });
  expect(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.length })), state).toEqual([]); expect(overflow, state).toBeLessThanOrEqual(0);
}
async function capture(page: Page, name: string, top = true) {
  if (top) await page.evaluate(() => scrollTo(0, 0)); await settled(page);
  await page.screenshot({ path: join(output, name), fullPage: top });
}
async function pick(page: Page, title = navigationTrack.title, id = navigationTrack.spotifyId) {
  await page.route('**/api/songs/search?*', r => r.fulfill({ json: { hits: [{ id, song: { ...navigationTrack, title, spotifyId: id } }] } }));
  await page.getByRole('combobox').fill(title); await page.getByRole('row').first().getByRole('button').click(); await expect(selected(page)).toContainText(title);
}
async function choose(page: Page) {
  const pending = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Upload audio file', exact: true }).click(); await (await pending).setFiles(clip);
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] });
  let liveSearchStatus: number | null = null;
  try {
    for (const width of [390, 768, 1440]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme === 'light' ? 'dark' : 'light', reducedMotion: theme === 'light' ? 'reduce' : 'no-preference' });
      await context.addInitScript(theme => localStorage.setItem('theme', theme), theme);
      const page = await context.newPage(), posts: string[] = [], externalRequests: string[] = [], errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => { const url = new URL(r.url()); if (r.method() === 'POST') posts.push(url.pathname); if (!['blob:', 'data:'].includes(url.protocol) && url.origin !== new URL(base).origin) externalRequests.push(url.origin + url.pathname); });
      await page.route('**/api/analyses', r => r.fulfill({ status: 503, json: { status: 'unavailable' } }));
      await page.goto(`${base}/discover`);
      if (liveSearchStatus === null) liveSearchStatus = (await page.request.get(`${base}/api/songs/search?q=original-demo`)).status();
      await pick(page); await expect(selected(page).getByRole('link', { name: 'Analyze a local file' })).toHaveCount(0);
      await audit(page, 'selected-primary-action', width, theme); await capture(page, `selected-${width}-${theme}.png`);
      const summary = selected(page).locator('summary'), details = selected(page).locator('details');
      await summary.focus(); await page.keyboard.press('Enter'); await expect(details).toHaveAttribute('open', '');
      await expect(details.getByRole('status')).toHaveText('Audio insights unavailable'); await audit(page, 'optional-audio-open', width, theme);
      if (width === 390 && theme === 'dark') await capture(page, 'audio-options-390-dark.png');
      await summary.focus(); await page.keyboard.press('Space'); await expect(details).not.toHaveAttribute('open', '');
      await selected(page).getByRole('link', { name: 'Demo ensemble artist profile' }).focus(); await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: 'Demo ensemble', exact: true })).toBeFocused(); await audit(page, 'artist-context', width, theme);
      await page.getByRole('link', { name: 'Back to exploring' }).click(); await expect(page).toHaveURL(/\/discover$/); await expect(selected(page)).toContainText(navigationTrack.title);
      await selected(page).getByRole('link', { name: 'Add lyrics', exact: true }).focus(); await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/analyze\?mode=lyrics#lyrics$/); await expect(page.locator('#lyrics')).toBeFocused(); await settled(page);
      const measurement = await page.locator('#lyrics').evaluate(el => { const box = el.getBoundingClientRect(); return { lyricsY: box.y, lyricsHeight: box.height, viewportHeight: innerHeight, focusedId: document.activeElement?.id, withinViewport: box.y >= 60 && box.bottom <= innerHeight }; });
      expect(measurement.withinViewport).toBe(true); focusMeasurements.push({ width, theme, ...measurement, submitControls: await page.getByRole('button', { name: 'Analyze lyrics', exact: true }).count() });
      await expect(page.getByRole('button', { name: 'Analyze lyrics', exact: true })).toHaveCount(1); await audit(page, 'focused-lyrics-handoff', width, theme);
      if (theme === 'light' && width !== 768) await capture(page, `lyrics-handoff-${width}-light.png`, false);
      await page.locator('#lyrics').fill(originalText); await selected(page).getByRole('button', { name: 'Add lyrics', exact: true }).click();
      await expect(page.locator('#lyrics')).toBeFocused(); await expect(page.locator('#lyrics')).toHaveValue(originalText); await audit(page, 'repeated-handoff-keeps-draft', width, theme);
      await page.getByRole('tab', { name: /Audio/ }).click(); await expect(page).toHaveURL(/\/analyze\?mode=audio$/);
      await selected(page).getByRole('button', { name: 'Add lyrics', exact: true }).click(); await expect(page.locator('#lyrics')).toBeFocused(); await expect(page.locator('#lyrics')).toHaveValue(originalText);
      await page.goBack(); await expect(page).toHaveURL(/\/discover$/); await expect(selected(page)).toContainText(navigationTrack.title);
      await page.goForward(); await expect(page).toHaveURL(/\/analyze\?mode=lyrics$/); await expect(page.locator('#lyrics')).toHaveValue('');
      await audit(page, 'history-discards-draft-keeps-metadata', width, theme);
      if (width === 768 && theme === 'light') {
        await page.route('**/api/analyze', r => r.fulfill({ json: reading }));
        await page.locator('#lyrics').fill(originalText); await page.getByRole('button', { name: 'Analyze lyrics', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible(); await audit(page, 'actual-keyword-engine-reading', width, theme); await capture(page, 'keyword-reading-768-light.png');
      }
      if (width === 390 && theme === 'light') {
        await selected(page).locator('summary').click(); await selected(page).getByRole('button', { name: 'Analyze a local file', exact: true }).click();
        await expect(page.getByRole('tab', { name: /Audio/ })).toBeFocused(); await choose(page);
        await expect(page.getByRole('region', { name: 'Local listening timeline' })).toBeVisible({ timeout: 35000 }); await expect(selected(page)).toHaveCount(0); await audit(page, 'real-local-clip-clears-context', width, theme);
      }
      expect(externalRequests).toEqual([]); expect(errors).toEqual([]);
      expect(posts).toEqual(width === 768 && theme === 'light' ? ['/api/analyze', '/api/analyses'] : []);
      journeys.push({ width, theme, posts, externalRequests, pageErrors: errors, passed: true }); await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' }); await context.addInitScript(() => localStorage.setItem('theme', 'light'));
    const page = await context.newPage(); const errors: string[] = [], persistence: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/analyses', r => { persistence.push(r.request().method()); return r.fulfill({ status: 503, json: { status: 'unavailable' } }); });
    await page.goto(`${base}/discover`); await page.getByRole('combobox').fill('original-demo'); await expect(page.getByRole('status').filter({ hasText: 'Search unavailable' })).toBeVisible(); await audit(page, 'live-search-unavailable', 390, 'light');
    await pick(page); await selected(page).getByRole('link', { name: 'Add lyrics', exact: true }).click(); await expect(page.locator('#lyrics')).toBeFocused();
    let release!: () => void, started!: () => void; const held = new Promise<void>(r => { release = r; }), request = new Promise<void>(r => { started = r; });
    await page.route('**/api/analyze', async r => { started(); await held; await r.fulfill({ json: reading }); });
    await page.locator('#lyrics').fill(originalText); await page.getByRole('button', { name: 'Analyze lyrics', exact: true }).click(); await request;
    await expect(page.getByRole('button', { name: 'Analyzing…' })).toBeDisabled(); await audit(page, 'held-lyrics-loading', 390, 'light');
    await page.getByRole('navigation', { name: 'Footer', exact: true }).getByRole('link', { name: 'Discover', exact: true }).click(); await expect(page).toHaveURL(/\/discover$/); release();
    await page.goBack(); await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toHaveCount(0); await expect(page.locator('#lyrics')).toHaveValue(''); expect(persistence).toEqual([]);
    await page.unroute('**/api/analyze'); await page.route('**/api/analyze', r => r.fulfill({ status: 500, json: { error: 'Original controlled lyric error' } }));
    await page.locator('#lyrics').fill(originalText); await page.getByRole('button', { name: 'Analyze lyrics', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'Original controlled lyric error' })).toBeVisible(); await audit(page, 'retryable-lyrics-error', 390, 'light');
    await page.goto(`${base}/identify`); await page.route('**/api/identify', r => r.fulfill({ json: { status: 'matched', song: navigationTrack, match: {} } }));
    const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: '…or choose a short clip', exact: true }).click(); await (await chooser).setFiles(clip);
    await expect(selected(page)).toBeVisible(); await audit(page, 'controlled-recognition-metadata-handoff', 390, 'light');
    await selected(page).getByRole('link', { name: 'Add lyrics', exact: true }).click(); await expect(page.locator('#lyrics')).toBeFocused(); await audit(page, 'recognition-to-focused-text', 390, 'light');
    await page.reload(); await expect(selected(page)).toHaveCount(0); await expect(page.locator('#lyrics')).toBeFocused(); await audit(page, 'reload-empty-selection-requested-input', 390, 'light');
    expect(errors).toEqual([]); expect(persistence).toEqual([]); await context.close();
    const report = { recordedAt: new Date().toISOString(), runtime: 'next start production build in saved cloud environment', buildId: readFileSync('.next/BUILD_ID', 'utf8').trim(), browser: browser.version(), fixture: 'Original controlled metadata and recognition response (no match scores). Keyword reading computed by existing pure keyword/blend code on original text. Local clip uses real browser engines and original synthetic PCM. No live provider success or model accuracy claimed.', liveSearchStatus, themes: 'Saved themes opposite OS; light reduced motion, dark normal motion', focusMeasurements, states, journeys, limits: 'Spotify/live recognition, Supabase/RLS and hosted browser behavior remain unverified. Existing OG/Twitter missing-config limitation unchanged.' };
    writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ scans: states.length, journeys: journeys.length, focusMeasurements, output }));
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
