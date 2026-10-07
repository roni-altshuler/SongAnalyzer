import { expect, test, type Page } from '@playwright/test';
import { syntheticClip } from '../fixtures/synthetic-audio';

const recording = { name: 'original-passage.wav', mimeType: 'audio/wav', buffer: syntheticClip({ duration: 6, secondHalfGain: 0.2 }) };
const timeline = (page: Page) => page.getByRole('region', { name: 'Local listening timeline' });
async function chooseLocalFile(page: Page, file = recording) {
  // The native chooser requires the visible upload handler to be mounted.
  // Hidden-input injection can race hydration and the hook's mount effects.
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload audio file', exact: true }).click();
  await (await chooser).setFiles(file);
}
async function load(page: Page) {
  await page.goto('/analyze?mode=audio');
  await chooseLocalFile(page);
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
  await chooseLocalFile(page);
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
  await chooseLocalFile(page, { name: 'original-silence.wav', mimeType: 'audio/wav', buffer: syntheticClip({ silent: true }) });
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
  await page.goto('/analyze?mode=audio'); await chooseLocalFile(page);
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
  await page.goto('/analyze?mode=audio'); await chooseLocalFile(page);
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

test('native media enforces an internal window boundary with animation frames suspended', async ({ page }) => {
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() === 'POST') writes.push(request.url()); });
  await page.addInitScript(`const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function() { window.playbackMedia = this; return play.call(this); };
    const raf = requestAnimationFrame; window.suspendPlaybackFrames = false; window.droppedFrames = 0;
    window.requestAnimationFrame = callback => raf(time => { if (window.suspendPlaybackFrames) window.droppedFrames++; else callback(time); });`);
  await load(page);
  await timeline(page).getByRole('button', { name: 'Play', exact: true }).click();
  await expect(timeline(page).getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.evaluate(() => { (window as unknown as { suspendPlaybackFrames: boolean }).suspendPlaybackFrames = true; });
  await expect(timeline(page).getByRole('button', { name: 'Play', exact: true })).toBeVisible({ timeout: 6000 });
  const media = await page.evaluate(() => {
    const state = window as unknown as { playbackMedia: HTMLMediaElement; droppedFrames: number };
    return { time: state.playbackMedia.currentTime, paused: state.playbackMedia.paused, droppedFrames: state.droppedFrames };
  });
  expect(media.droppedFrames).toBeGreaterThan(0); expect(media.paused).toBe(true); expect(media.time).toBeCloseTo(3, 2);
  await expect(timeline(page).getByRole('button', { name: /^Select window 1,/ })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]); expect(writes).toEqual([]);
});

test('visibility and pagehide pause without restart, repeat safely and remove owned guards', async ({ page }) => {
  await page.addInitScript(`window.forcedVisibility = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.forcedVisibility });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.forcedVisibility !== 'visible' });
    const play = HTMLMediaElement.prototype.play; let denied = false;
    HTMLMediaElement.prototype.play = function() { window.playbackMedia = this; if (!denied) { denied = true; return Promise.reject(new DOMException('Controlled denial', 'NotAllowedError')); } return play.call(this); };
    const visibility = new Set(), hides = new Set();
    const addDocument = document.addEventListener.bind(document), removeDocument = document.removeEventListener.bind(document);
    document.addEventListener = (type, listener, options) => { if (type === 'visibilitychange') visibility.add(listener); return addDocument(type, listener, options); };
    document.removeEventListener = (type, listener, options) => { if (type === 'visibilitychange') visibility.delete(listener); return removeDocument(type, listener, options); };
    const addWindow = window.addEventListener.bind(window), removeWindow = window.removeEventListener.bind(window);
    window.addEventListener = (type, listener, options) => { if (type === 'pagehide') hides.add(listener); return addWindow(type, listener, options); };
    window.removeEventListener = (type, listener, options) => { if (type === 'pagehide') hides.delete(listener); return removeWindow(type, listener, options); };
    window.visibilityGuardCounts = () => ({ visibility: visibility.size, pagehide: hides.size });`);
  await page.goto('/analyze?mode=audio');
  const counts = () => page.evaluate(() => (window as unknown as { visibilityGuardCounts: () => { visibility: number; pagehide: number } }).visibilityGuardCounts());
  const baseline = await counts();
  await chooseLocalFile(page);
  const view = timeline(page);
  await expect(view.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({ timeout: 35000 });
  expect(await counts()).toEqual({ visibility: baseline.visibility + 1, pagehide: baseline.pagehide + 1 });
  await view.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(view.getByRole('alert')).toContainText('Playback could not start');
  await view.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(view.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  for (const index of [1, 2, 1]) {
    await page.evaluate(() => { (window as unknown as { forcedVisibility: string }).forcedVisibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
    await expect(view.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
    const pausedAt = await view.getByRole('slider', { name: 'Playback position' }).inputValue();
    await page.evaluate(() => { (window as unknown as { forcedVisibility: string }).forcedVisibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(350);
    await expect(view.getByRole('slider', { name: 'Playback position' })).toHaveValue(pausedAt);
    await expect(view.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
    await view.getByRole('button', { name: new RegExp(`^Select window ${index},`) }).click();
    await view.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(view.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  }
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect(view.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await chooseLocalFile(page);
  await expect(view.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({ timeout: 35000 });
  expect(await counts()).toEqual({ visibility: baseline.visibility + 1, pagehide: baseline.pagehide + 1 });
  await page.getByRole('tab', { name: /Lyrics/ }).click(); await expect(view).toHaveCount(0);
  expect(await counts()).toEqual(baseline);
});

test('a playback promise settling after hide and return cannot restart audio', async ({ page }) => {
  await page.addInitScript(`window.forcedVisibility = 'visible';
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.forcedVisibility !== 'visible' });
    const play = HTMLMediaElement.prototype.play; let held = false;
    HTMLMediaElement.prototype.play = function() { window.playbackMedia = this;
      if (!held) { held = true; return new Promise(resolve => { window.releasePlaybackStart = () => resolve(play.call(this)); }); }
      return play.call(this);
    };`);
  await load(page);
  const view = timeline(page);
  await view.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(view.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
  await page.evaluate(() => {
    const state = window as unknown as { forcedVisibility: string; releasePlaybackStart: () => void };
    state.forcedVisibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
    state.forcedVisibility = 'visible'; document.dispatchEvent(new Event('visibilitychange'));
    state.releasePlaybackStart();
  });
  await expect(view.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => (window as unknown as { playbackMedia: HTMLMediaElement }).playbackMedia.paused)).toBe(true);
  await expect(view.getByRole('alert')).toHaveCount(0);
  await view.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(view.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
});

test('timeline labels follow both live theme changes without resetting the selected passage', async ({ page }) => {
  await load(page);
  const view = timeline(page), second = view.getByRole('button', { name: /^Select window 2,/ });
  await second.click();
  // WaveSurfer replaces this node on redraw, including the first visible
  // render. Resolve and read together so a detached handle cannot yield ''.
  const timelineColor = () => view.locator('[part="timeline"]').evaluateAll(elements => {
    const element = elements[0];
    if (!element?.isConnected || element.getBoundingClientRect().width <= 0
      || !element.querySelector('[part~="timeline-notch-secondary"]')) return null;
    return getComputedStyle(element).color || null;
  });
  const textColor = () => view.evaluate(element => {
    const probe = document.createElement('span'); probe.style.color = 'var(--text-med)'; element.appendChild(probe);
    const color = getComputedStyle(probe).color; probe.remove(); return color;
  });
  const expectedInitialColor = await textColor();
  expect(expectedInitialColor).toMatch(/^rgb\(/);
  let initialColor: string | null = null;
  // Capture the same initialized reading that passes the assertion. A second
  // immediate read could otherwise land during another redraw.
  await expect.poll(async () => (initialColor = await timelineColor())).toBe(expectedInitialColor);
  expect(initialColor).toMatch(/^rgb\(/);
  const initiallyDark = await page.locator('html').evaluate(element => element.classList.contains('dark'));
  await expect(view.locator('[part~="timeline-notch-secondary"]').first()).toHaveCSS('opacity', '1');
  for (let index = 0; index < 2; index++) {
    await page.getByRole('button', { name: 'Toggle color theme' }).click();
    await expect(page.locator('html')).toHaveClass(new RegExp(index === 0 ? initiallyDark ? 'light' : 'dark' : initiallyDark ? 'dark' : 'light'));
    let currentColor: string | null = null;
    await expect.poll(async () => (currentColor = await timelineColor())).toBe(await textColor());
    await expect(view.locator('[part~="timeline-notch-secondary"]').first()).toHaveCSS('opacity', '1');
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    await expect(view.getByTestId('playback-time')).toHaveText('0:03.0');
    if (index === 0) expect(currentColor).not.toBe(initialColor);
  }
  await expect.poll(timelineColor).toBe(initialColor);
});
