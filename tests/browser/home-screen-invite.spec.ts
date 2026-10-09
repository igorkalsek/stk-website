import { expect, test, type Page } from '@playwright/test';

// UA, standalone and installation events are simulated in Chromium, not physical devices.
const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1';
const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const visitedKey = 'stkHomeScreenInviteVisitedV1';
const key = 'stkHomeScreenInviteDismissedUntilV1';
const days90 = 90 * 24 * 60 * 60 * 1000;
async function setup(page: Page, options: { ua?: string; standalone?: boolean; displayMode?: boolean; until?: number; blocked?: 'read' | 'write'; returning?: boolean } = {}) {
  await page.route('https://stk-master-api.igor-kalsek.workers.dev/**', route => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/interest-preview', route => route.fulfill({ json: { ok: true, type: 'interest_preview', items: [] } }));
  await page.route('https://script.google.com/**', route => route.fulfill({ status: 204, body: '' }));
  await page.addInitScript(({ options, safari, key, visitedKey }) => {
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
    if (options.returning !== false) localStorage.setItem(visitedKey, '1');
    localStorage.setItem('stkSavedRacesV2', '{"version":2,"races":[]}');
    if (options.until !== undefined) localStorage.setItem(key, String(options.until));
    if (options.blocked) Storage.prototype[options.blocked === 'read' ? 'getItem' : 'setItem'] = () => { throw new DOMException('Unavailable', 'SecurityError'); };
  }, { options, safari, key, visitedKey });
}
for (const path of ['/', '/en/']) {
  for (const ua of [safari, android]) {
  for (const width of [390, 430, 768, 1440]) {
    test(`${path} simulated ${ua === safari ? 'iPhone' : 'Android'} at ${width}px: accessible disclosure, stable layout and dismissal`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await setup(page, { ua });
      await page.goto(path);
      const card = page.locator('[data-home-screen-invite]');
      await expect(card).toBeVisible();
      await expect(card.locator('h3')).toHaveText(path === '/' ? 'STK vedno pri roki' : 'STK at your fingertips');
      await card.locator('summary').focus();
      await page.keyboard.press('Enter');
      await expect(card.locator('details')).toHaveAttribute('open', '');
      await expect(card.locator('ol:not([hidden]) li')).toHaveCount(3);
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
      await card.locator('[data-dismiss-home-screen-invite]').click();
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
}
for (const [name, options] of Object.entries({
  'iOS standalone': { standalone: true },
  'display-mode standalone': { displayMode: true },
  'recent dismissal': { until: Date.now() + days90 },
  'desktop Safari': { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/27.0 Safari/605.1.15' },
  'desktop Chrome': { ua: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36' },
  'Android standalone': { ua: android, displayMode: true },
  'Android webview': { ua: android.replace('Android 15;', 'Android 15; wv;') },
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
  await setup(page);
  await page.goto('/');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Unavailable', 'SecurityError'); }; });
  const card = page.locator('[data-home-screen-invite]');
  await expect(card).toBeVisible();
  await card.locator('[data-dismiss-home-screen-invite]').click();
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
for (const ua of [safari, android]) {
  test(`first session stays hidden across reload/navigation; fresh visit qualifies (${ua.includes('Android') ? 'Android' : 'iPhone'})`, async ({ page, context }) => {
    await setup(page, { ua, returning: false });
    await page.goto('/');
    await expect(page.locator('[data-home-screen-invite]')).toBeHidden();
    await page.reload();
    await expect(page.locator('[data-home-screen-invite]')).toBeHidden();
    await page.goto('/en/');
    await expect(page.locator('[data-home-screen-invite]')).toBeHidden();
    const nextVisit = await context.newPage();
    await setup(nextVisit, { ua, returning: false });
    await nextVisit.goto('/');
    await expect(nextVisit.locator('[data-home-screen-invite]')).toBeVisible();
    await nextVisit.close();
  });
}
for (const path of ['/', '/en/']) {
  test(`${path} Android fallback instructions and saved-race warning`, async ({ page }) => {
    await setup(page, { ua: android });
    await page.goto(path);
    const card = page.locator('[data-home-screen-invite]');
    await expect(card).toBeVisible();
    await expect(card.locator('[data-install-stk]')).toBeHidden();
    await card.locator('summary').click();
    await expect(card.locator('[data-install-platform="android"]')).toBeVisible();
    await expect(card.locator('[data-install-platform="iphone"]')).toBeHidden();
    await expect(card.locator('li').filter({ hasText: path === '/' ? 'Namesti aplikacijo' : 'Install app' })).toBeVisible();
    await expect(card.locator('.home-screen-note')).toContainText(path === '/' ? 'med brskalnikom' : 'between your browser');
  });
}
async function offerInstall(page: Page, outcome: 'accepted' | 'dismissed' | 'error' = 'accepted') {
  return page.evaluate(outcome => {
    const signals = window as any;
    signals.installCalls ??= 0;
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: () => { signals.installCalls++; return outcome === 'error' ? Promise.reject(new Error('Prompt unavailable')) : Promise.resolve(); },
      userChoice: Promise.resolve({ outcome })
    });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }, outcome);
}
for (const outcome of ['accepted', 'dismissed'] as const) {
  test(`Android system prompt only on click; ${outcome} suppresses for 90 days`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setup(page, { ua: android });
    await page.goto('/');
    const before = await page.locator('[data-home-screen-invite]').boundingBox();
    expect(await offerInstall(page, outcome)).toBe(true);
    expect(await page.locator('[data-home-screen-invite]').boundingBox()).toEqual(before);
    const card = page.locator('[data-home-screen-invite]');
    const install = card.locator('[data-install-stk]');
    await expect(install).toBeVisible();
    expect(await page.evaluate(() => (window as any).installCalls)).toBe(0);
    await install.click();
    await expect(card).toBeHidden();
    expect(await page.evaluate(() => (window as any).installCalls)).toBe(1);
    const until = await page.evaluate(key => Number(localStorage.getItem(key)), key);
    expect(Math.abs(until - Date.now() - days90)).toBeLessThan(10000);
    await offerInstall(page, outcome);
    await expect(card).toBeHidden();
    expect(await page.evaluate(() => (window as any).installCalls)).toBe(1);
    await page.reload();
    await expect(card).toBeHidden();
  });
}
test('appinstalled hides invitation and preserves saved races', async ({ page }) => {
  await setup(page, { ua: android });
  await page.goto('/');
  await expect(page.locator('[data-home-screen-invite]')).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('stkSavedRacesV2'));
  await page.evaluate(() => dispatchEvent(new Event('appinstalled')));
  await expect(page.locator('[data-home-screen-invite]')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('stkSavedRacesV2'))).toBe(saved);
  await page.reload();
  await expect(page.locator('[data-home-screen-invite]')).toBeHidden();
});
test('consumed prompt failure falls back to instructions without an unhandled error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await setup(page, { ua: android });
  await page.goto('/');
  await offerInstall(page, 'error');
  await page.locator('[data-install-stk]').click();
  await expect(page.locator('[data-install-stk]')).toBeHidden();
  await expect(page.locator('[data-home-screen-invite]')).toBeVisible();
  await page.locator('[data-home-screen-invite] summary').click();
  await expect(page.locator('[data-install-platform="android"]')).toBeVisible();
  expect(errors).toEqual([]);
});
for (const [name, options] of Object.entries({ iphone: { ua: safari }, firstVisit: { ua: android, returning: false }, dismissed: { ua: android, until: Date.now() + days90 }, standalone: { ua: android, standalone: true } })) {
  test(`pending event never bypasses eligibility: ${name}`, async ({ page }) => {
    await setup(page, options);
    await page.goto('/');
    await offerInstall(page);
    if (options.ua === safari) await expect(page.locator('[data-install-stk]')).toBeHidden();
    else await expect(page.locator('[data-home-screen-invite]')).toBeHidden();
    expect(await page.evaluate(() => (window as any).installCalls)).toBe(0);
  });
}
test('unavailable session storage safely hides invitation', async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => { Object.defineProperty(window, 'sessionStorage', { get: () => { throw new DOMException('Unavailable', 'SecurityError'); } }); });
  await page.goto('/');
  await expect(page.locator('[data-home-screen-invite]')).toBeHidden();
});
test('manifest is served with correct MIME, paths and preserves iPhone metadata on SL/EN', async ({ page, request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('application/manifest+json');
  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: 'STK', short_name: 'STK', id: '/', start_url: '/', scope: '/', display: 'standalone' });
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  }
  for (const path of ['/', '/en/']) {
    await page.goto(path);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'STK');
    const registrations = await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(items => items.length));
    expect(registrations).toBe(0);
  }
});

test('initial storage write failure safely hides invitation', async ({ page }) => {
  await setup(page, { blocked: 'write' });
  await page.goto('/');
  await expect(page.locator('[data-home-screen-invite]')).toBeHidden();
});
