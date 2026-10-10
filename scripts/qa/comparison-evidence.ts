/** Production-browser evidence. No app dependency, provider clip or audio-feature mock. */
import { chromium, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { syntheticClip } from '../../playwright/fixtures/synthetic-audio';

type AxeResult = { violations: Array<{ id: string; nodes: unknown[] }> };
type AxeInstance = { withTags(tags: string[]): AxeInstance; analyze(): Promise<AxeResult> };
type AxeConstructor = new (options: { page: Page }) => AxeInstance;
type QAWindow = Window & {
  comparisonSignals: Array<{ valence: number; arousal: number; duration: number }>;
  releaseComparisonWave?: () => void;
};
const require = createRequire(import.meta.url);
if (!process.env.COMPARISON_AXE_PATH) throw new Error('Set COMPARISON_AXE_PATH to an externally installed @axe-core/playwright package.');
const axeModule = require(process.env.COMPARISON_AXE_PATH) as AxeConstructor & { default?: AxeConstructor };
const Axe = axeModule.default ?? axeModule;
const baseURL = process.env.COMPARISON_QA_BASE_URL ?? 'http://localhost:3141';
const output = process.env.COMPARISON_QA_OUTPUT ?? '/tmp/song-comparison-qa';
mkdirSync(output, { recursive: true });
const originalText = 'Love and sunshine, beautiful day, hope alive and bright. Dancing through the night, joy and freedom forever.';
const recording = { name: 'independent-original-passage.wav', mimeType: 'audio/wav', buffer: syntheticClip({ duration: 6, secondHalfGain: 0.2 }) };
const view = (page: Page) => page.getByRole('region', { name: 'Lyrics and audio comparison' });
const states: Array<{ state: string; width: number; theme: string; violations: string[]; overflow: number; mapContrast: { text: number; outline: number } | null }> = [];
const journeys: Array<{ width: number; theme: string; scenario: string; signals: QAWindow['comparisonSignals']; posts: unknown[]; externalRequests: string[]; pageErrors: string[] }> = [];

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
  // Literal browser JS avoids tsx's named-function helper leaking into evaluate.
  const mapContrast = await page.evaluate<{ text: number; outline: number } | null>(`(() => {
    const map = document.querySelector('[aria-label="Lyrics and audio comparison"] svg');
    if (!map) return null;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    const luminance = (color) => {
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
      const rgb = Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map(c => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const surface = luminance(getComputedStyle(map.querySelector('rect')).fill);
    const ratio = (color) => { const l = luminance(color); return (Math.max(l, surface) + 0.05) / (Math.min(l, surface) + 0.05); };
    return {
      text: Math.min(...Array.from(map.querySelectorAll('text')).map(t => ratio(getComputedStyle(t).fill))),
      outline: Math.min(...Array.from(map.querySelectorAll('circle, polygon')).map(t => ratio(getComputedStyle(t).stroke))),
    };
  })()`);
  expect(Boolean(mapContrast), `${state}: map contrast measurement available`).toBe(Boolean(await view(page).getByRole('img').count()));
  states.push({ state, width, theme, violations: result.violations.map(v => v.id), overflow, mapContrast });
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.length })), state).toEqual([]);
  expect(overflow, state).toBeLessThanOrEqual(0);
  if (mapContrast) { expect(mapContrast.text, `${state}: SVG text contrast`).toBeGreaterThanOrEqual(4.5); expect(mapContrast.outline, `${state}: marker outline contrast`).toBeGreaterThanOrEqual(3); }
}
async function choose(page: Page, file = recording) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload audio file', exact: true }).click();
  await (await chooser).setFiles(file);
}
async function capture(page: Page, name: string, width: number) {
  // Tall component capture avoids the sticky navigation obscuring a long card.
  await page.setViewportSize({ width, height: 6000 }); await settled(page);
  await view(page).screenshot({ path: join(output, name) });
  await page.setViewportSize({ width, height: 900 });
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] });
  const browserVersion = browser.version();
  try {
    const scenarios = [
      ...[390, 1440].flatMap(width => (['light', 'dark'] as const).map(theme => ({ width, theme, scenario: 'real-engines' }))),
      { width: 390, theme: 'light' as const, scenario: 'controlled-unmapped-text' },
      { width: 390, theme: 'dark' as const, scenario: 'real-dsp-fallback' },
      { width: 390, theme: 'light' as const, scenario: 'controlled-translated-text' },
    ];
    for (const { width, theme, scenario } of scenarios) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme === 'light' ? 'dark' : 'light', reducedMotion: theme === 'light' ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const posts: Array<{ path: string; type?: string; mode?: string }> = [], externalRequests: string[] = [], pageErrors: string[] = [];
      page.on('pageerror', e => pageErrors.push(e.message));
      page.on('request', request => {
        const url = new URL(request.url());
        if (!['blob:', 'data:'].includes(url.protocol) && url.origin !== new URL(baseURL).origin) externalRequests.push(url.origin + url.pathname);
        if (request.method() === 'POST') posts.push({ path: url.pathname, type: request.headers()['content-type'], mode: url.pathname === '/api/analyses' ? JSON.parse(request.postData() ?? '{}').mode : undefined });
      });
      await page.addInitScript(({ theme, fallback }) => {
        localStorage.setItem('theme', theme);
        const qa = window as unknown as QAWindow; qa.comparisonSignals = [];
        // Observe actual worker replies without replacing any extracted value.
        const NativeWorker = Worker; let first = true;
        window.Worker = class extends NativeWorker {
          constructor(url: string | URL, options?: WorkerOptions) {
            if (fallback && first) { first = false; throw new Error('Controlled feature-worker startup failure'); }
            super(url, options);
            this.addEventListener('message', event => {
              const features = event.data?.ok && event.data?.features;
              if (features && Number.isFinite(features.valence) && Number.isFinite(features.arousal)) qa.comparisonSignals.push({ valence: features.valence, arousal: features.arousal, duration: features.duration });
            });
          }
        };
      }, { theme, fallback: scenario === 'real-dsp-fallback' });
      if (scenario === 'controlled-unmapped-text' || scenario === 'controlled-translated-text') {
        await page.route('**/api/analyze', async route => {
          const real = await route.fetch();
          const result = await real.json();
          if (scenario === 'controlled-unmapped-text') result.mood = 'Controlled unmapped mood';
          else {
            // Presentation fixture: translation is not performed or validated.
            result.translated = true; result.originalLanguage = 'Spanish'; result.wordCount = 9;
          }
          await route.fulfill({ response: real, json: result });
        });
        // Never persist deliberately altered metadata, even in a configured setup.
        await page.route('**/api/analyses', route => route.fulfill({ status: 503, json: { error: 'Controlled QA metadata is not persisted' } }));
      }
      await page.goto(`${baseURL}/analyze`);
      await expect(page.locator('html')).toHaveAttribute('class', new RegExp(`\\b${theme}\\b`));
      await expect(view(page)).toHaveCount(0); await audit(page, `${scenario}:empty`, width, theme);
      await page.getByRole('textbox').fill(originalText);
      if (scenario === 'real-engines') {
        let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
        await page.route('**/api/analyze', async route => { await held; await route.fulfill({ status: 500, json: { error: 'Controlled lyrics error for comparison QA' } }); });
        await page.getByRole('button', { name: 'Analyze lyrics', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Analyzing…', exact: true })).toBeDisabled();
        await audit(page, 'lyrics-loading', width, theme); release();
        await expect(page.getByRole('alert').filter({ hasText: 'Controlled lyrics error' })).toBeVisible();
        await expect(view(page)).toHaveCount(0); await audit(page, 'lyrics-error', width, theme);
        await page.unroute('**/api/analyze');
      }
      await page.getByRole('button', { name: 'Analyze lyrics', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible();
      await expect(view(page)).toHaveCount(0); await audit(page, `${scenario}:text-only`, width, theme);
      await page.getByRole('tab', { name: /Audio/ }).click();
      if (scenario === 'real-engines') await page.evaluate(() => {
        // Hold only WaveSurfer's decode at its declared 22050 Hz rate; MIR stays real.
        const qa = window as unknown as QAWindow, nativeDecode = AudioContext.prototype.decodeAudioData;
        const held = new Promise<void>(resolve => { qa.releaseComparisonWave = resolve; });
        AudioContext.prototype.decodeAudioData = function(data: ArrayBuffer) {
          return (this.sampleRate === 22050 ? held : Promise.resolve()).then(() => nativeDecode.call(this, data));
        };
      });
      await choose(page); await expect(view(page)).toBeVisible({ timeout: 35000 });
      if (scenario === 'real-engines') {
        await expect(page.getByText('Preparing local waveform…', { exact: true })).toBeVisible();
        await audit(page, 'waveform-loading-comparison-ready', width, theme);
        await page.evaluate(() => (window as unknown as QAWindow).releaseComparisonWave?.());
      }
      const timeline = page.getByRole('region', { name: 'Local listening timeline' });
      await expect(timeline.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({ timeout: 35000 });
      await audit(page, `${scenario}:collapsed`, width, theme);
      await view(page).locator('summary').focus(); await page.keyboard.press('Enter');
      await expect(view(page).locator('details')).toHaveAttribute('open', '');
      await expect(view(page).getByRole('table', { name: 'Comparison coordinates' })).toBeVisible();
      const signals = await page.evaluate(() => (window as unknown as QAWindow).comparisonSignals);
      if (scenario === 'real-engines' || scenario === 'controlled-translated-text') {
        expect(signals).toHaveLength(1); expect(signals[0].duration).toBe(6);
        const format = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`;
        for (const [axis, number] of [['Valence', signals[0].valence], ['Arousal', signals[0].arousal]] as const) {
          await expect(view(page).getByRole('row', { name: new RegExp(`^${axis}`) }).getByRole('cell').nth(1)).toHaveText(format(number));
        }
        await expect(view(page).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '53');
      } else {
        await expect(view(page).getByRole('progressbar')).toHaveCount(0);
        await expect(view(page).getByRole('img')).toHaveCount(0);
        await expect(view(page).getByRole('status')).toContainText(scenario === 'real-dsp-fallback' ? 'the audio reading' : 'the lyrics reading');
      }
      const lyricsInput = view(page).getByRole('group', { name: 'Lyrics comparison input' });
      await expect(lyricsInput).toContainText(scenario === 'controlled-translated-text' ? '9 analyzed words' : '17 analyzed words');
      await expect(lyricsInput).toContainText(scenario === 'controlled-translated-text' ? 'Translated text reading' : 'Supplied text reading');
      await expect(lyricsInput).not.toContainText('supplied words');
      await audit(page, `${scenario}:expanded`, width, theme);
      await capture(page, `${scenario}-${width}-${theme}.png`, width);
      if (scenario === 'real-engines') {
        await timeline.getByRole('button', { name: /^Select window 2,/ }).focus(); await page.keyboard.press('Enter');
        await timeline.getByRole('button', { name: 'Play', exact: true }).click();
        await expect(timeline.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
        await expect(timeline.getByRole('button', { name: 'Play', exact: true })).toBeVisible({ timeout: 7000 });
        await expect(view(page)).toContainText('6.0s analyzed'); await audit(page, 'window-two-boundary-stop', width, theme);
        await page.getByRole('button', { name: 'Toggle color theme' }).click();
        await expect(view(page).locator('details')).toHaveAttribute('open', '');
        await page.getByRole('button', { name: 'Toggle color theme' }).click();
        await choose(page, { ...recording, name: 'replacement-original.wav', buffer: syntheticClip({ duration: 4 }) });
        await expect(view(page)).toContainText('4.0s analyzed', { timeout: 35000 });
        await expect(view(page)).not.toContainText(recording.name); await audit(page, 'replacement-recording', width, theme);
        await choose(page, { name: 'invalid-original.wav', mimeType: 'audio/wav', buffer: Buffer.from('Original test text, not audio.') });
        await expect(page.getByRole('alert').filter({ hasText: /decode|audio data/i })).toBeVisible({ timeout: 35000 });
        await expect(view(page)).toHaveCount(0); await audit(page, 'invalid-recording', width, theme);
        if (width < 768) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
        await page.getByRole('navigation', { name: width < 768 ? 'Primary mobile' : 'Primary', exact: true }).getByRole('link', { name: 'Discover', exact: true }).click();
        await expect(page).toHaveURL(/\/discover$/); await page.goBack(); await expect(page).toHaveURL(/\/analyze(?:\?|$)/);
        await expect(view(page)).toHaveCount(0); await audit(page, 'navigate-back-local-state-cleared', width, theme);
      }
      expect(posts.filter(p => p.type?.includes('multipart') || p.path !== '/api/analyze' && !(p.path === '/api/analyses' && p.mode === 'lyrics'))).toEqual([]);
      expect(externalRequests).toEqual([]); expect(pageErrors).toEqual([]);
      journeys.push({ width, theme, scenario, signals, posts, externalRequests, pageErrors });
      await context.close();
    }
  } finally {
    await browser.close();
    writeFileSync(join(output, 'report.json'), JSON.stringify({ date: new Date().toISOString(), baseURL, browser: `Chromium ${browserVersion}; production next start`, viewportHeight: 900, componentCaptureHeight: 6000, axeTags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'], scenarios: 'Real keyword/MIR engines; controlled lyrics errors/unmapped/translated metadata and real DSP fallback via worker startup failure', states, journeys }, null, 2));
  }
  console.log(JSON.stringify({ states: states.length, screenshots: journeys.length, journeys: journeys.length, violations: states.flatMap(s => s.violations) }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
