import { expect, test, type Page } from '@playwright/test';

const API = 'https://stk-master-api.igor-kalsek.workers.dev';
const baseline = process.env.STK_GET_BASELINE === '1';
const race = (year: string, title = `Test ${year}`) => ({ row: '37', leto: year, datum: `${year}-12-20`, naziv_prireditve: title, kraj: 'Ljubljana', regija: 'Osrednjeslovenska', status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA' });
const saved = (years: string[]) => ({ version: 2, races: years.map(year => ({ version: 2, eventId: 'r000037', year, date: `${year}-12-20`, title: `Test ${year}`, status: 'following' })) });

async function setup(page: Page, years: string[]) {
  const requests: string[] = [];
  const control = { failure: '', title: '', holdMaster: null as Promise<void> | null, holdAdditional: null as Promise<void> | null };
  await page.clock.setFixedTime(new Date('2026-10-21T10:00:00Z'));
  await page.addInitScript(state => localStorage.setItem('stkSavedRacesV2', JSON.stringify(state)), saved(years));
  page.on('request', request => {
    if (request.url().startsWith(API) && request.method() === 'GET') {
      const url = new URL(request.url());
      requests.push(url.pathname + url.search);
    }
  });
  // No analytics or external writes, including when the existing save controls are exercised.
  await page.route('**/*', route => route.request().method() === 'GET' ? route.continue() : route.fulfill({ status: 204 }));
  await page.route('**/api/interest-preview', route => route.fulfill({ json: { ok: true, type: 'interest_preview', items: [] } }));
  await page.route(`${API}/**`, async route => {
    const url = new URL(route.request().url());
    const year = url.searchParams.get('year') ?? '2026';
    if (url.pathname === '/') {
      await control.holdMaster;
      await new Promise(resolve => setTimeout(resolve, 80));
      if (control.failure === 'network') return route.abort('failed');
      if (control.failure === '503' || (control.failure === '2027' && year === '2027')) return route.fulfill({ status: 503, json: {} });
      if (control.failure === 'json') return route.fulfill({ contentType: 'application/json', body: '{' });
      return route.fulfill({ json: { data: [race(year, control.title || undefined)] } });
    }
    if (url.pathname === '/additional') {
      await control.holdAdditional;
      if (control.failure === 'additional') return route.fulfill({ status: 503, json: {} });
      return route.fulfill({ json: { data: [{ leto: year, master_sheet: year, master_row: '37', datum: `${year}-12-20`, naziv_prireditve: `Test ${year}`, rok_prijave: `${year}-12-19`, zanesljivost: 'visoka' }] } });
    }
    if (url.pathname === '/recent_updates') return route.fulfill({ json: { recent_updates_last_days: { years: ['2026', '2027'], events: [] } } });
    return route.fulfill({ json: { data: [] } });
  });
  return { requests, control, count: (path: string) => requests.filter(value => value === path).length };
}

async function change(page: Page, status = 'planning') {
  await page.evaluate(status => {
    const state = JSON.parse(localStorage.getItem('stkSavedRacesV2')!);
    state.races.forEach((item: { status: string }) => { item.status = status; });
    localStorage.setItem('stkSavedRacesV2', JSON.stringify(state));
    window.dispatchEvent(new Event('stk:saved-races-changed'));
  }, status);
}

for (const path of ['/', '/en/']) {
  for (const width of [390, 1440]) for (const years of [[], ['2026'], ['2026', '2027']]) {
    test(`${path} GET counts, status and save at ${width}px with ${years.join(',') || 'no saves'}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 1000 });
      const { requests, count } = await setup(page, years);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(count('/')).toBe(baseline && years.length ? 2 : 1);
      expect(count('/?year=2027')).toBe(baseline && years.includes('2027') ? 2 : 1);
      expect(count('/additional')).toBe(years.length ? 2 : 1);
      expect(count('/additional?year=2027')).toBe(years.includes('2027') ? 1 : 0);
      if (years.length) {
        await expect(page.locator('.my-stk-next-card')).toContainText('Test 2026');
        await expect(page.locator('.my-stk-next-card time')).toHaveAttribute('datetime', '2026-12-19');
      }
      const initial = [...requests];
      await change(page);
      await page.waitForLoadState('networkidle');
      await expect.poll(() => requests.length).toBe(initial.length + years.length * 2);
      if (years.length) await expect(page.locator('.my-stk-status')).toHaveText(path === '/' ? 'Planiram' : 'Planning');
      const status = requests.slice(initial.length);
      const beforeSave = requests.length;
      const button = page.locator('[data-saved-race-button]').first();
      const pressed = await button.getAttribute('aria-pressed');
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', pressed === 'true' ? 'false' : 'true');
      await page.waitForLoadState('networkidle');
      const remaining = await page.evaluate(() => JSON.parse(localStorage.getItem('stkSavedRacesV2')!).races.length);
      expect(requests.length - beforeSave).toBe(remaining ? new Set(['2026', ...(years.includes('2027') ? ['2027'] : [])]).size * 2 : 0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
      await info.attach('get-counts', { body: JSON.stringify({ initial, status, save: requests.slice(beforeSave) }), contentType: 'application/json' });
    });
  }

  for (const failure of ['network', '503', 'json', '2027', 'additional']) test(`${path} retries after ${failure} without crossing years`, async ({ page }) => {
    const { control, count } = await setup(page, ['2026', '2027']);
    control.failure = failure;
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-my-stk-content]')).not.toBeEmpty();
    if (failure === 'additional' || failure === '2027') await expect(page.locator('.my-stk-next-card')).toContainText('Test 2026');
    control.failure = '';
    control.title = 'Fresh response';
    const before = count('/');
    await change(page);
    await expect(page.locator('.my-stk-next-card')).toContainText('Fresh response');
    expect(count('/')).toBe(before + 1);
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('stkSavedRacesV2')!);
      state.races = state.races.filter((item: { year: string }) => item.year === '2027');
      localStorage.setItem('stkSavedRacesV2', JSON.stringify(state));
      window.dispatchEvent(new Event('stk:saved-races-changed'));
    });
    await expect(page.locator('.my-stk-next-meta')).toContainText('2027');
  });

  test(`${path} overlapping status changes share only pending Master and discard old renders`, async ({ page }) => {
    const { control, count } = await setup(page, ['2026']);
    await page.goto(path); await page.waitForLoadState('networkidle');
    let release!: () => void;
    control.holdMaster = new Promise(resolve => { release = resolve; });
    const before = count('/');
    await change(page, 'planning'); await change(page, 'registered');
    await expect.poll(() => count('/')).toBe(before + (baseline ? 2 : 1));
    release(); control.holdMaster = null;
    await expect(page.locator('.my-stk-status')).toHaveText(path === '/' ? 'Prijavljen' : 'Registered');
    await page.waitForLoadState('networkidle');
    control.title = 'New revision';
    await change(page);
    await expect(page.locator('.my-stk-next-card')).toContainText('New revision');
  });

  test(`${path} removing all saves while Master is delayed keeps onboarding`, async ({ page }) => {
    const { control, count } = await setup(page, ['2026']);
    let release!: () => void;
    control.holdMaster = new Promise(resolve => { release = resolve; });
    await page.goto(path);
    await expect.poll(() => count('/')).toBe(baseline ? 2 : 1);
    await page.evaluate(() => { localStorage.setItem('stkSavedRacesV2', JSON.stringify({ version: 2, races: [] })); window.dispatchEvent(new Event('stk:saved-races-changed')); });
    release();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.my-stk-dashboard')).toHaveCount(0);
    await expect(page.locator('[data-my-stk-content]')).toContainText(path === '/' ? 'Ustvarite svojo tekaško sezono' : 'Build your running season');
  });

  test(`${path} optional Additional timeout leaves Master visible and allows retry`, async ({ page }) => {
    const { control } = await setup(page, ['2026']);
    let release!: () => void;
    control.holdAdditional = new Promise(resolve => { release = resolve; });
    await page.clock.install({ time: new Date('2026-10-21T10:00:00Z') });
    await page.goto(path);
    await expect(page.locator('.my-stk-next-card')).toContainText('Test 2026');
    await page.clock.runFor(15_001);
    await expect(page.locator('.my-stk-next-card')).toContainText('Test 2026');
    await expect(page.locator('.my-stk-next-card time')).toHaveCount(0);
    control.holdAdditional = null; release();
    await change(page);
    await expect(page.locator('.my-stk-next-card time')).toHaveAttribute('datetime', '2026-12-19');
  });
}
