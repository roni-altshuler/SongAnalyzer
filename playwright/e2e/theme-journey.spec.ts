import { expect, test, type Page } from '@playwright/test';

async function navigate(page: Page, label: string, width: number) {
  if (width < 768) {
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page.getByRole('navigation', { name: 'Primary mobile', exact: true }).getByRole('link', { name: label, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toBeVisible();
  } else {
    await page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name: label, exact: true }).click();
  }
}

for (const width of [390, 1440]) for (const theme of ['light', 'dark'] as const) {
  test(`saved ${theme} keeps the complete shell consistent through navigation and history at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (/hydrated|hydration|script tag/i.test(message.text())) errors.push(message.text()); });
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
    await page.addInitScript(saved => localStorage.setItem('theme', saved), theme);
    await page.goto('/');
    const assertTheme = async () => {
      await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`));
      await expect(page.locator('body')).toHaveCSS('background-color', theme === 'light' ? 'rgb(250, 247, 240)' : 'rgb(7, 7, 10)');
      await expect(page.getByRole('button', { name: 'Toggle color theme' })).toHaveAttribute('title', theme === 'light' ? 'Switch to dark' : 'Switch to light');
    };
    await assertTheme();
    for (const label of ['Identify', 'Discover', 'Analyze', 'Atlas']) {
      await navigate(page, label, width); await assertTheme();
      const nav = page.getByRole('navigation', { name: width < 768 ? 'Footer' : 'Primary', exact: true });
      if (width >= 768) await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
    }
    await page.goBack(); await assertTheme(); await page.goForward(); await assertTheme();
    await page.reload(); await assertTheme();
    const response = await page.goto('/share/theme-journey-absent-reading');
    expect(response?.status()).toBe(404); await assertTheme();
    await expect(page.getByRole('heading', { name: 'That page isn’t available.' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to home', exact: true }).click(); await assertTheme();
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(theme);
    expect(errors).toEqual([]);
  });
}

test('an unsaved theme follows live system changes, while a chosen theme stays selected', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'light' }); await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/\blight\b/);
  await page.emulateMedia({ colorScheme: 'dark' }); await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await page.getByRole('button', { name: 'Toggle color theme' }).click();
  await expect(page.locator('html')).toHaveClass(/\blight\b/);
  await page.emulateMedia({ colorScheme: 'light' }); await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/\blight\b/);
  const other = await context.newPage(); await other.goto('/');
  await other.evaluate(() => localStorage.setItem('theme', 'dark'));
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await other.evaluate(() => localStorage.removeItem('theme'));
  await page.emulateMedia({ colorScheme: 'light' }); await expect(page.locator('html')).toHaveClass(/\blight\b/);
});

test('denied theme storage still paints the system theme before hydration and allows a visit choice', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) { if (key === 'theme') throw new DOMException('Controlled denied theme storage', 'SecurityError'); return get.call(this, key); };
    Storage.prototype.setItem = function (key, value) { if (key === 'theme') throw new DOMException('Controlled denied theme storage', 'SecurityError'); return set.call(this, key, value); };
  });
  let release!: () => void; const hydration = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/*.js*', async route => { await hydration; await route.continue(); });
  try {
    await page.goto('/', { waitUntil: 'commit' });
    await expect(page.locator('html')).toHaveClass(/\blight\b/);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(250, 247, 240)');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('fingerprint');
    await expect(page.getByRole('button', { name: 'Toggle color theme' })).toHaveCount(0);
  } finally { release(); }
  await page.getByRole('button', { name: 'Toggle color theme' }).click();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await navigate(page, 'Analyze', 1440); await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await page.reload(); await expect(page.locator('html')).toHaveClass(/\blight\b/);
  expect(errors).toEqual([]);
});

test('an invalid legacy theme value defers to the system without a hydration error', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => localStorage.setItem('theme', 'unknown-legacy-theme'));
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await expect(page.getByRole('button', { name: 'Toggle color theme' })).toHaveAttribute('title', 'Switch to light');
  expect(errors).toEqual([]);
});

test('decorative spectrum honors live reduced-motion changes without hydration warnings', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/hydrated|hydration/i.test(message.text())) errors.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Toggle color theme' })).toBeVisible();
  await expect(page.locator('svg animate')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => page.locator('svg animate').count()).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('svg animate')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('svg animate')).toHaveCount(0);
  expect(errors).toEqual([]);
});
