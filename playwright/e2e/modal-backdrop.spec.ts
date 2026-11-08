import { expect, test } from '@playwright/test';
import { analyzeKeyword } from '../../lib/analysis/keyword';
import { blendResults } from '../../lib/analysis/blend';

declare global {
  interface Window {
    modalPointerGate: { queued: number; attempts: number; release(): void };
  }
}

const originalText = 'Love and sunshine, beautiful day, hope alive and bright. Dancing through the night, joy and freedom forever.';
const reading = {
  ...blendResults({ keyword: analyzeKeyword(originalText), transformer: null, transformerStatus: 'skipped' }),
  originalLanguage: 'English', translated: false,
};

for (const width of [390, 768, 1440]) for (const theme of ['light', 'dark'] as const) {
  test(`mounted backdrop dismisses before deferred document registration at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light', reducedMotion: theme === 'light' ? 'reduce' : 'no-preference' });
    await page.addInitScript(savedTheme => {
      localStorage.setItem('theme', savedTheme);
      const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
      const pending = new Map<EventListenerOrEventListenerObject, { type: string; options?: boolean | AddEventListenerOptions }>();
      // Reproduce the observed interval: the backdrop is mounted while Radix's
      // deferred outside-pointer listener has not reached the document yet.
      // React's delegated handlers are untouched; no timers or sleeps are added.
      const gate = window.modalPointerGate = {
        queued: 0, attempts: 0,
        release() {
          for (const [listener, entry] of pending) add.call(document, entry.type, listener, entry.options);
          pending.clear(); gate.queued = 0;
          EventTarget.prototype.addEventListener = add;
          EventTarget.prototype.removeEventListener = remove;
        },
      };
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        const source = typeof listener === 'function' ? Function.prototype.toString.call(listener) : '';
        if (this === document && type === 'pointerdown' && listener && source.includes('pointerType') && source.includes('touch')) {
          pending.set(listener, { type, options }); gate.attempts++; gate.queued = pending.size; return;
        }
        return add.call(this, type, listener, options);
      };
      EventTarget.prototype.removeEventListener = function(type, listener, options) {
        if (this === document && type === 'pointerdown' && listener && pending.delete(listener)) {
          gate.queued = pending.size; return;
        }
        return remove.call(this, type, listener, options);
      };
    }, theme);
    await page.route('**/api/analyze', route => route.fulfill({ json: reading }));
    await page.route('**/api/analyses', route => route.fulfill({ status: 503, json: { status: 'unavailable' } }));
    await page.goto('/analyze?mode=lyrics'); await page.locator('#lyrics').fill(originalText);
    await page.getByRole('button', { name: 'Analyze lyrics', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible();
    const opener = page.getByRole('button', { name: 'Show engine details' });
    const dialog = page.getByRole('dialog', { name: 'Engine details' });
    await opener.focus(); await page.keyboard.press('Enter'); await expect(dialog).toBeVisible();
    await page.waitForFunction(() => window.modalPointerGate.queued > 0);

    // Context-menu gestures and content clicks must keep the dialog open.
    await page.mouse.click(2, 450, { button: 'right' }); await expect(dialog).toBeVisible();
    await page.keyboard.down('Control'); await page.mouse.click(2, 450); await page.keyboard.up('Control');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('heading', { name: 'Engine details', exact: true }).click(); await expect(dialog).toBeVisible();
    // The same genuine coordinate click and dismissal/focus assertions as the
    // failed merge gate, while the document listener remains explicitly absent.
    await page.mouse.click(2, 450);
    await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
    await page.keyboard.press('Enter'); await expect(dialog).toBeVisible();
    await page.waitForFunction(() => window.modalPointerGate.queued > 0);
    await page.mouse.click(2, 450);
    await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
    await page.evaluate(() => window.modalPointerGate.release());
    await expect(page.locator('#lyrics')).toHaveValue(originalText);
  });
}
