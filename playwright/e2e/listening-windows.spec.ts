import { expect, test, type Page } from '@playwright/test';
import { syntheticClip } from '../fixtures/synthetic-audio';

const recording = { name: 'original-passage.wav', mimeType: 'audio/wav', buffer: syntheticClip({ duration: 6, secondHalfGain: 0.2 }) };
const timeline = (page: Page) => page.getByRole('region', { name: 'Local listening timeline' });
async function load(page: Page) {
  await page.goto('/analyze?mode=audio');
  await page.locator('#audio-file').setInputFiles(recording);
  await expect(timeline(page).getByRole('button', { name: 'Play', exact: true })).toBeEnabled({ timeout: 35000 });
}

test('local waveform selections synchronize measured detail, keyboard seek and bounded playback', async ({ page }) => {
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() === 'POST') writes.push(request.url()); });
  await load(page);
  const view = timeline(page), detail = view.getByRole('region', { name: 'Selected window detail' });
  const rms = () => detail.locator('dt').filter({ hasText: 'RMS signal level' }).locator('..').locator('dd');
  const loud = parseFloat(await rms().innerText());
  await view.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(view.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(view.getByRole('button', { name: 'Play', exact: true })).toBeVisible({ timeout: 6000 });
  // This boundary is inside the file: reaching its natural end cannot pass.
  expect(parseFloat(await view.getByRole('slider', { name: 'Playback position' }).inputValue())).toBeCloseTo(3, 1);
  await expect(view.getByRole('button', { name: /^Select window 1,/ })).toHaveAttribute('aria-pressed', 'true');
  const second = view.getByRole('button', { name: /^Select window 2,/ });
  await second.focus(); await page.keyboard.press('Enter');
  await expect(second).toBeFocused(); await expect(second).toHaveAttribute('aria-pressed', 'true');
  expect(parseFloat(await rms().innerText()) - loud).toBeCloseTo(20 * Math.log10(0.2), 0);
  await expect(view.getByTestId('playback-time')).toHaveText('0:03.0');
  await view.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(view.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(view.getByRole('button', { name: 'Play', exact: true })).toBeVisible({ timeout: 6000 });
  expect(parseFloat(await view.getByRole('slider', { name: 'Playback position' }).inputValue())).toBeCloseTo(6, 1);
  const slider = view.getByRole('slider', { name: 'Playback position' });
  await slider.focus(); await page.keyboard.press('Home');
  await expect(view.getByRole('button', { name: /^Select window 1,/ })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('End'); await expect(second).toHaveAttribute('aria-pressed', 'true');
  await view.getByRole('button', { name: 'Restart window' }).click(); await expect(view.getByTestId('playback-time')).toHaveText('0:03.0');
  expect(writes).toEqual([]); expect(errors).toEqual([]);
});

test('repeated selection, same-file replacement and mode/navigation discard stale playback', async ({ page }) => {
  const workers: string[] = [], errors: string[] = [];
  page.on('worker', worker => workers.push(worker.url())); page.on('pageerror', error => errors.push(error.message));
  await load(page);
  for (const index of [2, 1, 2, 1]) {
    const button = timeline(page).getByRole('button', { name: new RegExp(`^Select window ${index},`) });
    await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
  await timeline(page).getByRole('button', { name: 'Play', exact: true }).click();
  await expect(timeline(page).getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  const count = workers.length;
  await page.locator('#audio-file').setInputFiles(recording);
  await expect.poll(() => workers.length).toBeGreaterThan(count);
  await expect(timeline(page).getByRole('button', { name: 'Play', exact: true })).toBeEnabled({ timeout: 35000 });
  await expect(timeline(page).getByRole('button', { name: /^Select window 1,/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: /Lyrics/ }).click(); await expect(timeline(page)).toHaveCount(0);
  await page.getByRole('tab', { name: /Audio/ }).click();
  await expect(timeline(page).getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await expect(timeline(page).getByTestId('playback-time')).toHaveText('0:00.0');
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Discover', exact: true }).click();
  await expect(timeline(page)).toHaveCount(0); await page.goBack();
  await expect(page.getByRole('tab', { name: /Audio/ })).toHaveAttribute('aria-selected', 'true');
  await expect(timeline(page)).toHaveCount(0); expect(errors).toEqual([]);
});

test('real silent PCM is distinguished from unavailable beat data', async ({ page }) => {
  await page.goto('/analyze?mode=audio');
  await page.locator('#audio-file').setInputFiles({ name: 'original-silence.wav', mimeType: 'audio/wav', buffer: syntheticClip({ silent: true }) });
  await expect(timeline(page).getByRole('button', { name: 'Play', exact: true })).toBeEnabled({ timeout: 35000 });
  const detail = timeline(page).getByRole('region', { name: 'Selected window detail' });
  await expect(detail.getByText('Silent (−∞)', { exact: true })).toHaveCount(2);
  await expect(detail.locator('dt').filter({ hasText: 'Estimated grid ticks' }).locator('..').locator('dd')).toHaveText('0');
});

test('a waveform decode failure remains retryable without losing the real worker reading', async ({ page }) => {
  await page.addInitScript(`const original = AudioContext.prototype.decodeAudioData; let failed = false;
    AudioContext.prototype.decodeAudioData = function(...args) {
      if (this.sampleRate === 22050 && !failed) { failed = true; return Promise.reject(new DOMException('Controlled waveform decode failure', 'EncodingError')); }
      return original.apply(this, args);
    };`);
  await page.goto('/analyze?mode=audio'); await page.locator('#audio-file').setInputFiles(recording);
  await expect(timeline(page).getByRole('alert')).toContainText('waveform could not load', { timeout: 35000 });
  await expect(page.getByRole('heading', { name: 'Audio analysis', exact: true })).toBeVisible();
  await timeline(page).getByRole('button', { name: 'Retry waveform' }).click();
  await expect(timeline(page).getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
});

test('a held real waveform decode shows loading and cancels cleanly on navigation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(`const original = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = function(...args) {
      if (this.sampleRate === 22050) return new Promise(resolve => { window.releaseWaveformDecode = () => resolve(original.apply(this, args)); });
      return original.apply(this, args);
    };`);
  await page.goto('/analyze?mode=audio'); await page.locator('#audio-file').setInputFiles(recording);
  await expect(timeline(page).getByRole('status')).toContainText('Preparing local waveform', { timeout: 35000 });
  await expect(timeline(page)).toHaveAttribute('aria-busy', 'true');
  await expect(timeline(page).getByRole('button', { name: 'Play', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: /Lyrics/ }).click();
  await page.evaluate(() => (window as unknown as { releaseWaveformDecode: () => void }).releaseWaveformDecode());
  await expect(timeline(page)).toHaveCount(0); expect(errors).toEqual([]);
});

test('the real fallback reading keeps local signal detail without inventing a beat grid', async ({ page }) => {
  await page.addInitScript(`const OriginalWorker = Worker; let failed = false; window.Worker = class extends OriginalWorker {
    constructor(url, options) { if (!failed) { failed = true; throw new Error('Controlled feature worker startup failure'); } super(url, options); }
  };`);
  await load(page);
  await expect(page.getByText('v1 (fallback)', { exact: true })).toBeVisible();
  const detail = timeline(page).getByRole('region', { name: 'Selected window detail' });
  await expect(detail).toContainText('no timed beat grid');
  await expect(detail.locator('dt').filter({ hasText: 'Estimated grid ticks' }).locator('..').locator('dd')).toHaveText('Unavailable');
  await expect(detail.locator('dt').filter({ hasText: 'RMS signal level' }).locator('..').locator('dd')).toContainText('dBFS');
});

test('a blocked playback start has a recoverable error and releases the Play control', async ({ page }) => {
  await page.addInitScript(`const original = HTMLMediaElement.prototype.play; let denied = false;
    HTMLMediaElement.prototype.play = function() { if (!denied) { denied = true; return Promise.reject(new DOMException('Controlled playback denial', 'NotAllowedError')); } return original.call(this); };`);
  await load(page);
  await timeline(page).getByRole('button', { name: 'Play', exact: true }).click();
  await expect(timeline(page).getByRole('alert')).toContainText('Playback could not start');
  await expect(timeline(page).getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await timeline(page).getByRole('button', { name: 'Play', exact: true }).click();
  await expect(timeline(page).getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(timeline(page).getByRole('alert')).toHaveCount(0);
});
