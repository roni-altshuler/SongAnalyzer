import { expect, test, type Page } from '@playwright/test';
import { syntheticClip } from '../fixtures/synthetic-audio';

const originalText = 'Love and sunshine, beautiful day, hope alive and bright. Dancing through the night, joy and freedom forever.';
const recording = { name: 'independent-original-passage.wav', mimeType: 'audio/wav', buffer: syntheticClip({ duration: 6, secondHalfGain: 0.2 }) };
const comparison = (page: Page) => page.getByRole('region', { name: 'Lyrics and audio comparison' });
async function readText(page: Page) {
  await page.goto('/analyze');
  await page.getByRole('textbox').fill(originalText);
  await page.getByRole('button', { name: 'Analyze lyrics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible();
}
async function choose(page: Page, file = recording) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload audio file', exact: true }).click();
  await (await chooser).setFiles(file);
}

for (const width of [390, 1440]) {
  test(`independent readings expose their real evidence and keyboard details at ${width}px`, async ({ page }) => {
    const errors: string[] = [], audioWrites: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (r.method() === 'POST' && (r.headers()['content-type']?.includes('multipart') || /api\/(fingerprints|identify\/fallback|songs\/.*\/features)/.test(r.url()) || r.url().includes('/api/analyses') && JSON.parse(r.postData() ?? '{}').mode !== 'lyrics')) audioWrites.push(r.url()); });
    await page.setViewportSize({ width, height: 900 });
    await readText(page); await expect(comparison(page)).toHaveCount(0);
    await page.getByRole('tab', { name: /Audio/ }).click(); await choose(page);
    const view = comparison(page);
    await expect(view).toBeVisible({ timeout: 35000 });
    await expect(view.getByRole('group', { name: 'Lyrics comparison input' })).toContainText('17 supplied words');
    await expect(view.getByRole('group', { name: 'Lyrics comparison input' })).toContainText('Mood label mapped');
    await expect(view.getByRole('group', { name: 'Audio comparison input' })).toContainText(recording.name);
    await expect(view.getByRole('group', { name: 'Audio comparison input' })).toContainText('Signal estimate');
    await expect(view).toContainText('does not verify they belong to the same song');
    await expect(view).toContainText('does not measure model accuracy');
    await expect(view.getByRole('progressbar', { name: 'Estimated proximity of lyrics and audio' })).toHaveAttribute('aria-valuenow', '53');
    const details = view.locator('details'), summary = view.locator('summary');
    await summary.focus(); await page.keyboard.press('Enter'); await expect(details).toHaveAttribute('open', '');
    await expect(view.getByRole('table', { name: 'Comparison coordinates' })).toBeVisible();
    await expect(view).toContainText('Choosing a listening window does not recalculate');
    const timeline = page.getByRole('region', { name: 'Local listening timeline' });
    await expect(timeline.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
    await timeline.getByRole('button', { name: /^Select window 2,/ }).click();
    await expect(view).toContainText('6.0s analyzed');
    await page.getByRole('button', { name: 'Toggle color theme' }).click();
    await expect(details).toHaveAttribute('open', '');
    await summary.focus(); await page.keyboard.press('Space'); await expect(details).not.toHaveAttribute('open', '');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await choose(page, { ...recording, name: 'replacement-original.wav', buffer: syntheticClip({ duration: 4 }) });
    await expect(view.getByRole('group', { name: 'Audio comparison input' })).toContainText('replacement-original.wav', { timeout: 35000 });
    await expect(view).toContainText('4.0s analyzed'); await expect(view).not.toContainText(recording.name);
    expect(audioWrites).toEqual([]); expect(errors).toEqual([]);
  });
}

test('a real DSP fallback with an unmapped mood withholds the audio coordinates', async ({ page }) => {
  // Fail only feature-worker startup; the existing real DSP fallback reads PCM.
  await page.addInitScript(`const OriginalWorker = Worker; let failed = false; window.Worker = class extends OriginalWorker {
    constructor(url, options) { if (!failed) { failed = true; throw new Error('Controlled feature worker startup failure'); } super(url, options); }
  };`);
  await readText(page); await page.getByRole('tab', { name: /Audio/ }).click(); await choose(page);
  const audio = comparison(page).getByRole('group', { name: 'Audio comparison input' });
  await expect(audio).toContainText('DSP fallback', { timeout: 35000 }); await expect(audio).toContainText('Coordinates unavailable');
  await expect(audio).not.toContainText('Signal estimate');
  await expect(comparison(page).getByRole('status')).toContainText('the audio reading');
  await expect(comparison(page).getByRole('progressbar')).toHaveCount(0);
  await comparison(page).locator('summary').click();
  await expect(comparison(page)).toContainText('This audio reading has no supported coordinates');
});

test('empty, held lyrics, failed lyrics and invalid-file states cannot show a stale comparison', async ({ page }) => {
  await page.goto('/analyze'); await expect(comparison(page)).toHaveCount(0);
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/analyze', async route => { await held; await route.fulfill({ status: 500, json: { error: 'Controlled lyrics error for comparison QA' } }); });
  await page.getByRole('textbox').fill(originalText); await page.getByRole('button', { name: 'Analyze lyrics', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Analyzing…', exact: true })).toBeDisabled(); await expect(comparison(page)).toHaveCount(0); release();
  await expect(page.getByRole('alert').filter({ hasText: 'Controlled lyrics error' })).toBeVisible(); await expect(comparison(page)).toHaveCount(0);
  await page.unroute('**/api/analyze'); await page.getByRole('button', { name: 'Analyze lyrics', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Audio/ }).click(); await choose(page); await expect(comparison(page)).toBeVisible({ timeout: 35000 });
  await choose(page, { name: 'invalid-original.wav', mimeType: 'audio/wav', buffer: Buffer.from('This is original test text, not audio.') });
  await expect(page.getByRole('alert').filter({ hasText: /decode|audio data/i })).toBeVisible({ timeout: 35000 });
  await expect(comparison(page)).toHaveCount(0);
});
