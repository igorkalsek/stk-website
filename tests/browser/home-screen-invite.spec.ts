import { expect, test, type Page } from '@playwright/test';

// UA/standalone signals are simulated in Chromium, not a physical iPhone.
const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1';
const key = 'stkHomeScreenInviteDismissedUntilV1';
const days90 = 90 * 24 * 60 * 60 * 1000;
async function setup(page: Page, options: { ua?: string; standalone?: boolean; displayMode?: boolean; until?: number; blocked?: 'read' | 'write' } = {}) {
  await page.route('https://stk-master-api.igor-kalsek.workers.dev/**', route => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/interest-preview', route => route.fulfill({ json: { ok: true, type: 'interest_preview', items: [] } }));
  await page.route('https://script.google.com/**', route => route.fulfill({ status: 204, body: '' }));
  await page.addInitScript(({ options, safari, key }) => {
    Object.defineProperty(navigator, 'userAgent', { value: options.ua ?? safari });
    Object.defineProperty(navigator, 'standalone', { value: !!options.standalone });
    if (options.displayMode) {
      const original = window.matchMedia.bind(window);
      window.matchMedia = query => {
        const media = original(query);
        if (query === '(display-mode: standalone)') Object.defineProperty(media, 'matches', { value: true });
        return media;
      };
    }
    localStorage.setItem('stkSavedRacesV2', '{"version":2,"races":[]}');
    if (options.until !== undefined) localStorage.setItem(key, String(options.until));
    if (options.blocked) Storage.prototype[options.blocked === 'read' ? 'getItem' : 'setItem'] = () => { throw new DOMException('Unavailable', 'SecurityError'); };
  }, { options, safari, key });
}
for (const path of ['/', '/en/']) {
  for (const width of [390, 430, 768, 1440]) {
    test(`${path} simulated iPhone at ${width}px: accessible disclosure, stable layout and dismissal`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await setup(page);
      await page.goto(path);
      const card = page.locator('[data-home-screen-invite]');
      await expect(card).toBeVisible();
      await expect(card.locator('h3')).toHaveText(path === '/' ? 'STK na vašem telefonu' : 'STK on your phone');
      await card.locator('summary').focus();
      await page.keyboard.press('Enter');
      await expect(card.locator('details')).toHaveAttribute('open', '');
      await expect(card.locator('li')).toHaveCount(3);
      await expect(card.locator('.home-screen-note')).toContainText(path === '/' ? 'morda ne prenesejo samodejno' : 'may not transfer automatically');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('.home-utility-section').screenshot({ path: test.info().outputPath('utility-expanded.png') });
      const social = page.locator('.home-utility-card').nth(2);
      const position = () => social.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left + scrollX, y: rect.top + scrollY, width: rect.width, height: rect.height };
      });
      const before = await position();
      const savedBefore = await page.evaluate(() => localStorage.getItem('stkSavedRacesV2'));
      await card.locator('button').click();
      await expect(card).toBeHidden();
      expect(await position()).toEqual(before);
      const until = await page.evaluate(key => Number(localStorage.getItem(key)), key);
      expect(Math.abs(until - Date.now() - days90)).toBeLessThan(10000);
      expect(await page.evaluate(() => localStorage.getItem('stkSavedRacesV2'))).toBe(savedBefore);
      await page.reload();
      await expect(card).toBeHidden();
      await page.evaluate(key => localStorage.setItem(key, String(Date.now() - 1)), key);
      await page.reload();
      await expect(card).toBeVisible();
    });
  }
}
for (const [name, options] of Object.entries({
  'iOS standalone': { standalone: true },
  'display-mode standalone': { displayMode: true },
  'recent dismissal': { until: Date.now() + days90 },
  'desktop Safari': { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/27.0 Safari/605.1.15' },
  'desktop Chrome': { ua: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36' },
  'Android': { ua: 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36' },
  'iPhone Chrome': { ua: safari.replace('Version/27.0', 'CriOS/140.0') },
  'embedded browser': { ua: safari.replace('Version/27.0 ', '').replace(' Safari/604.1', '') },
  'storage unavailable': { blocked: 'read' as const }
})) {
  test(`invitation stays hidden: ${name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await setup(page, options);
    await page.goto('/');
    await expect(page.locator('[data-home-screen-invite]')).toBeHidden();
    expect(errors).toEqual([]);
  });
}
test('write failure still dismisses without changing saved races', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await setup(page, { blocked: 'write' });
  await page.goto('/');
  const card = page.locator('[data-home-screen-invite]');
  await expect(card).toBeVisible();
  await card.locator('button').click();
  await expect(card).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('stkSavedRacesV2'))).toBe('{"version":2,"races":[]}');
  expect(errors).toEqual([]);
});
test('server HTML stays hidden without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, userAgent: safari });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('[data-home-screen-invite]')).toHaveAttribute('hidden', '');
  await expect(page.locator('[data-home-screen-invite]')).toBeHidden();
  await context.close();
});
for (const offset of [-1, 0, 1]) {
  test(`90-day expiry boundary ${offset}ms`, async ({ page }) => {
    const now = new Date('2026-10-09T12:00:00Z');
    await page.clock.setFixedTime(now);
    await setup(page, { until: now.getTime() + offset });
    await page.goto('/');
    if (offset > 0) await expect(page.locator('[data-home-screen-invite]')).toBeHidden();
    else await expect(page.locator('[data-home-screen-invite]')).toBeVisible();
  });
}
