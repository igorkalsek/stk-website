import { expect, test, type Page } from '@playwright/test';
import fixture from '../fixtures/race-watch.json' with { type: 'json' };

const API = 'https://stk-master-api.igor-kalsek.workers.dev';
const KEY = 'stkSavedRacesV2';
const race = (row: number, year = '2026', status = 'following') => {
  const record = fixture.masters[year as '2026' | '2027'].data.find(item => Number(item.row) === row)!;
  return { version: 2, eventId: `r${String(row).padStart(6, '0')}`, year, date: record.datum, title: record.naziv_prireditve, status };
};
const defaults = [race(254), race(256, '2026', 'planning'), race(265, '2026', 'registered'), race(37, '2027')];

type Scenario = 'ready' | 'outage' | 'partial' | 'conflict' | 'ambiguous' | 'duplicate' | 'unresolved';
async function setup(page: Page, scenario: Scenario = 'ready', saved = defaults, clockDate = '2026-10-19T10:00:00+02:00') {
  await page.clock.install({ time: new Date(clockDate) });
  const initial = JSON.stringify({ version: 2, races: saved });
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: KEY, value: initial });
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(`${API}/**`, route => {
    const url = new URL(route.request().url()); requests.push(url.pathname);
    if (scenario === 'outage') return route.fulfill({ status: 503, json: { ok: false } });
    if (url.pathname === '/recent_updates') {
      expect(url.searchParams.get('years')).toBe('2026,2027');
      expect(url.searchParams.get('days')).toBe('60');
      const payload = structuredClone(fixture.recent);
      if (scenario === 'partial') payload.recent_updates_last_days.stats.updated_events_total = 90;
      if (scenario === 'duplicate') payload.recent_updates_last_days.events.push(structuredClone(payload.recent_updates_last_days.events[0]));
      if (scenario === 'conflict') payload.recent_updates_last_days.events[0].row = '999';
      return route.fulfill({ json: payload });
    }
    if (url.pathname === '/deadlines') {
      expect(url.searchParams.get('contract')).toBe('2');
      expect(['2026-10-19', '2026-10-22']).toContain(url.searchParams.get('from'));
      expect(['2026-11-18', '2026-11-21']).toContain(url.searchParams.get('to'));
      const payload = structuredClone(fixture.deadlines);
      if (scenario === 'ambiguous') payload.items[1].deadline_components[0].type = 'registration';
      return route.fulfill({ json: payload });
    }
    if (url.pathname === '/additional') {
      const items = fixture.deadlines.items.filter(item => item.master_row === '254' || item.master_row === '256').map(item => ({
        leto: '2026', master_sheet: '2026', master_row: item.master_row, datum: item.datum,
        naziv_prireditve: item.naziv_prireditve, kraj: item.kraj, zanesljivost: 'visoka', rok_prijave: item.deadline_date,
        rok_cenejse_prijave: item.master_row === '256' ? item.deadline_date : ''
      }));
      return route.fulfill({ json: { data: url.searchParams.get('year') === '2027' ? [] : items } });
    }
    const year = url.searchParams.get('year') === '2027' ? '2027' : '2026';
    const master = structuredClone(fixture.masters[year]);
    if (scenario === 'unresolved' && year === '2026') { master.data.push(master.data[0]); master.row_count++; }
    return route.fulfill({ json: master });
  });
  await page.route('https://script.google.com/**', route => route.fulfill({ status: 204 }));
  return { initial, requests, errors };
}

for (const language of ['sl', 'en'] as const) for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 1000 }]) {
  test(`${language} ${viewport.name}: updates and verified deadlines share the existing plan`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const { initial, errors } = await setup(page);
    await page.goto(language === 'sl' ? '/moji-teki/' : '/en/my-races/');
    const watch = page.locator('[data-race-watch]');
    await expect(watch.getByRole('heading', { level: 2 })).toHaveText(language === 'sl' ? 'Novosti pri mojih tekih' : 'Updates to my races');
    await expect(watch.locator('[data-watch-update="UPDATED"]')).toHaveCount(1);
    await expect(watch.locator('[data-watch-update="NEW"]')).toHaveCount(1);
    await expect(watch).toContainText(language === 'sl' ? 'Podatki teka so bili posodobljeni' : 'Race details have been updated');
    await expect(watch).toContainText(language === 'sl' ? 'ob obisku strani' : 'when you visit this page');
    await expect(watch.locator('[data-watch-deadlines] a')).toHaveCount(2);
    for (const link of await watch.locator('[data-watch-update] a, [data-watch-deadlines] a').all()) {
      await expect(link).toHaveAttribute('href', language === 'sl' ? /^\/tek\/(2026|2027)\/r\d+-/ : /^\/en\/races\/(2026|2027)\/r\d+-/);
    }
    const lah = page.locator('[data-key="2026:r000254"]');
    const go = page.locator('[data-key="2026:r000256"]');
    await expect(lah.locator('[data-deadline-v2-id]')).toHaveCount(1);
    await expect(lah.locator('[data-my-race-deadlines]')).toContainText(language === 'sl' ? 'Rok spletnih prijav' : 'Online registration deadline');
    await expect(go.locator('[data-my-race-deadline]')).toHaveCount(1);
    await expect(go.locator('[data-my-race-deadlines]')).toContainText(language === 'sl' ? 'Rok predprijav in rok cenejše prijave' : 'Advance registration deadline and cheaper registration deadline');
    await expect(page.locator('[data-next-registration-deadline]')).toContainText(language === 'sl' ? 'Rok predprijav' : 'Advance registration deadline');
    await expect(go.locator('[data-my-race-status-select]')).toHaveValue('planning');
    await expect(lah.locator('[data-deadline-v2-source]')).toHaveAttribute('href', /protime.si/);
    await expect(page.locator('[data-race-watch-unavailable]')).toHaveCount(0);
    expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(initial);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/evidence/dev036/${language}-${viewport.name}.png`, fullPage: true });
    await go.locator('.deadline-calendar-menu summary').click();
    await expect(go.locator('.deadline-calendar-actions a')).toHaveCount(3);
    const google = new URL(await go.locator('.deadline-calendar-actions a').first().getAttribute('href') ?? '');
    expect(google.searchParams.get('dates')).toBe('20261102/20261103');
    const download = page.waitForEvent('download');
    await page.locator('[data-download-upcoming-races-ics]').click();
    expect((await download).suggestedFilename()).toBe(language === 'sl' ? 'moji-teki.ics' : 'my-races.ics');
    expect(errors).toEqual([]);
  });
}

test('outage keeps saved statuses and references, without an absence-of-changes claim', async ({ page }) => {
  const { initial } = await setup(page, 'outage');
  await page.goto('/en/my-races/');
  await expect(page.locator('[data-race-watch-unavailable]')).toBeVisible();
  await expect(page.locator('[data-watch-update]')).toHaveCount(0);
  await expect(page.locator('[data-deadline-v2-id]')).toHaveCount(0);
  await expect(page.locator('[data-my-race-status-select]')).toHaveCount(4);
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(initial);
  await expect(page.locator('[data-race-watch]')).not.toContainText('No matching updates');
});

for (const scenario of ['partial', 'conflict', 'duplicate', 'unresolved', 'ambiguous'] as const) test(`${scenario}: incomplete or unprovable signals stay neutral`, async ({ page }) => {
  await setup(page, scenario); await page.goto('/en/my-races/');
  await expect(page.locator('[data-watch-update="NEW"]')).toHaveCount(1);
  await expect(page.locator('[data-watch-update="UPDATED"]')).toHaveCount(scenario === 'conflict' ? 0 : 1);
  if (['partial', 'conflict', 'duplicate', 'unresolved'].includes(scenario)) await expect(page.locator('[data-race-watch-unavailable]')).toBeVisible();
  await expect(page.locator('[data-key="2026:r000254"] [data-deadline-v2-id]')).toHaveCount(['ambiguous', 'unresolved'].includes(scenario) ? 0 : 1);
});

test('evidence expires in an open tab and after visibility returns', async ({ page }) => {
  await setup(page); await page.goto('/en/my-races/');
  await expect(page.locator('[data-deadline-v2-id]')).toHaveCount(2);
  await page.clock.setFixedTime(new Date('2026-10-23T00:00:01+02:00'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('[data-deadline-v2-id]')).toHaveCount(0);
  await expect(page.locator('[data-watch-deadlines]')).toHaveCount(0);
  await expect(page.locator('[data-my-race-deadline]')).toHaveCount(2);
  await expect(page.locator('[data-race-watch-unavailable]')).toBeVisible();
  await expect(page.locator('[data-my-race-status-select]')).toHaveCount(4);
});

test('empty saved list has no alert section and makes no watch requests', async ({ page }) => {
  const { requests } = await setup(page, 'ready', []); await page.goto('/moji-teki/');
  await expect(page.locator('[data-my-races-app]')).toContainText('Nimate še shranjenih tekov');
  await expect(page.locator('[data-race-watch]')).toHaveCount(0);
  expect(requests).not.toContain('/recent_updates'); expect(requests).not.toContain('/deadlines');
});


test('verified labels expire exactly at Ljubljana midnight without user interaction', async ({ page }) => {
  await setup(page, 'ready', defaults, '2026-10-22T23:59:58+02:00');
  await page.clock.pauseAt(new Date('2026-10-22T23:59:59+02:00'));
  // On October 22 the final November 20 deadline also enters the 30-day window.
  await page.goto('/en/my-races/');
  await expect(page.locator('[data-deadline-v2-id]')).toHaveCount(3);
  await page.clock.runFor(1100);
  await expect(page.locator('[data-deadline-v2-id]')).toHaveCount(0);
  await expect(page.locator('[data-watch-deadlines]')).toHaveCount(0);
});
