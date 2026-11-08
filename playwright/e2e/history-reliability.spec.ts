import { expect, test } from '@playwright/test';
import path from 'node:path';
import { analyzeKeyword } from '../../lib/analysis/keyword';
import { blendResults } from '../../lib/analysis/blend';

const text = 'Synthetic sunshine and hope, dancing with joy. Beautiful light and peace, we dream of freedom together.';
const reading = { ...blendResults({ keyword: analyzeKeyword(text), transformer: null, transformerStatus: 'skipped' }), originalLanguage: 'Spanish', translated: true };
const saved = { id: 'synthetic-saved', timestamp: 1700000000000, lyricsPreview: 'Synthetic saved preview', result: reading };
const key = 'songanalyzer_history';
const axePath = path.resolve('node_modules/axe-core/axe.min.js');
declare global {
  interface Window { historyFault: 'none' | 'quota' | 'blocked' | 'clear'; copiedHistoryResult?: string; }
}

for (const width of [390, 768, 1440]) for (const theme of ['light', 'dark'] as const) for (const scenario of ['malformed', 'quota', 'blocked'] as const) {
  test(`local history ${scenario} keeps analysis usable at ${width}px in ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const raw = JSON.stringify(scenario === 'malformed' ? [saved, null] : [saved]);
    await page.addInitScript(({ raw, key, theme, scenario }) => {
      localStorage.setItem('theme', theme); localStorage.setItem(key, raw);
      window.historyFault = scenario === 'malformed' ? 'none' : scenario;
      const get = Storage.prototype.getItem, set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
      Storage.prototype.getItem = function(name) {
        if (name === key && window.historyFault === 'blocked') throw new DOMException('Synthetic history blocked', 'SecurityError');
        return get.call(this, name);
      };
      Storage.prototype.setItem = function(name, value) {
        if (name === key && window.historyFault === 'quota') throw new DOMException('Synthetic history quota', 'QuotaExceededError');
        return set.call(this, name, value);
      };
      Storage.prototype.removeItem = function(name) {
        if (name === key && window.historyFault === 'clear') throw new DOMException('Synthetic history blocked', 'SecurityError');
        return remove.call(this, name);
      };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText(value: string) { window.copiedHistoryResult = value; return Promise.resolve(); },
      } });
    }, { raw, key, theme, scenario });
    let persisted = 0;
    await page.route('**/api/analyze', route => route.fulfill({ json: reading }));
    await page.route('**/api/analyses', route => { persisted++; return route.fulfill({ json: { status: 'ok', id: 'synthetic-server-id' } }); });
    await page.goto('/analyze?mode=lyrics');
    const history = page.getByRole('region', { name: 'Local history' });
    await page.locator('#lyrics').fill(text);
    await page.getByRole('button', { name: 'Analyze lyrics', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible();
    await expect(history.getByRole('status')).toContainText('Your analysis is ready');
    await expect(page.getByRole('button', { name: 'Create a public share link' })).toBeVisible();
    expect(persisted).toBe(1);
    await page.getByRole('button', { name: 'Copy results to clipboard' }).click();
    expect(await page.evaluate(() => window.copiedHistoryResult)).toContain('Song Lyric Analysis');
    await page.addScriptTag({ path: axePath });
    const audits: string[] = [];
    async function audit(state: string) {
      await page.evaluate(async () => {
        await document.fonts.ready;
        const deadline = performance.now() + 4000;
        let quietFrames = 0;
        // Layout can change the element under a stationary pointer. Observe
        // rendered frames so newly starting hover transitions are included.
        while (quietFrames < 2) {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          if (performance.now() > deadline) throw new Error('Page animations did not settle for accessibility audit');
          const active = document.getAnimations().some(animation => animation.playState === 'running' &&
            animation.effect?.getComputedTiming().endTime !== Infinity);
          quietFrames = active ? 0 : quietFrames + 1;
        }
      });
      const violations = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: typeof import('axe-core') }).axe;
        return (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, html: n.html, summary: n.failureSummary })) }));
      });
      expect(violations, state).toEqual([]); audits.push(state);
    }
    await audit('analysis-ready-history-not-saved');
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.screenshot({ path: testInfo.outputPath(`${scenario}-${width}-${theme}.png`), fullPage: true });

    // Recover only this synthetic context's storage access so exact bytes can be checked.
    if (scenario === 'blocked') {
      await expect(history).toContainText('Local history is unavailable');
      await page.evaluate(() => { window.historyFault = 'none'; });
      await history.getByRole('button', { name: 'Retry local history' }).focus();
      await page.keyboard.press('Enter');
      await expect(history.getByRole('button', { name: 'History · 1', exact: true })).toBeFocused();
    }
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
    const trigger = history.getByRole('button', { name: 'History · 1', exact: true });
    await trigger.focus(); await page.keyboard.press('Enter');
    const remove = history.getByRole('button', { name: 'Remove from history' });
    if (scenario === 'malformed') await expect(remove).toBeDisabled();
    else {
      await page.evaluate(() => { window.historyFault = 'quota'; });
      await remove.click(); await expect(history.getByRole('alert')).toContainText('Could not remove');
      await expect(history.getByText(saved.lyricsPreview)).toBeVisible();
      expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
      await audit('remove-failed-saved-entry-retained');
    }
    await history.getByRole('button', { name: /Synthetic saved preview/ }).click();
    await expect(page.getByRole('button', { name: 'Create a public share link' })).toHaveCount(0);
    await expect(page.getByText('Detected Spanish — translated for analysis.')).toBeVisible();
    await expect(page.locator('#lyrics')).toHaveValue('');
    await expect(history.getByRole('status')).not.toContainText('Your analysis is ready');
    await audit('restored-provenance-share-id-cleared');
    await page.evaluate(() => { window.historyFault = 'clear'; });
    await history.getByRole('button', { name: 'Clear all', exact: true }).click();
    await expect(history.getByRole('alert')).toContainText('Could not clear');
    await expect(history.getByText(saved.lyricsPreview)).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
    await audit('clear-failed-saved-entry-retained');
    await page.evaluate(() => { window.historyFault = 'none'; });
    await history.getByRole('button', { name: 'Clear all', exact: true }).click();
    await expect(history.getByRole('button', { name: 'History · 0', exact: true })).toBeFocused();
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(theme);
    await page.keyboard.press('Enter');
    await expect(history).toContainText('No saved analyses in this browser yet.');
    await audit('explicit-clear-empty-history');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
    await testInfo.attach('history-accessibility-audits', { body: JSON.stringify({ width, theme, scenario, audits, violations: 0 }), contentType: 'application/json' });
  });
}
