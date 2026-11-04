import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Public Worker snapshot, 2026-11-04; no live API dependency in regressions.
const races = JSON.parse(readFileSync(new URL('../fixtures/family-offers/public-events.json', import.meta.url), 'utf8'));
const api = 'https://stk-master-api.igor-kalsek.workers.dev';
const velenje = races.find((race) => race.row === 267);
const menges = races.find((race) => race.row === 303);
const extra = (row: number, overrides = {}) => ({ ...velenje, row, naziv_prireditve: `Excluded ${row}`, ...overrides });
const exclusions = [
  extra(901, { status_dogodka: 'neuradno' }),
  extra(902, { vidno_v_javnem_koledarju: 'NE' }),
  extra(903, { datum: '2027-12-05' }),
  extra(904, { opombe_javne: '', opombe: 'Otroški teki.', naziv_prireditve: 'Otroški tek samo v naslovu' }),
  extra(905, { opombe_javne: 'Brezplačna udeležba. Tek na 1 km.' }),
  extra(906, { opombe_javne: 'Ni družinam prijazno. Otroški teki niso predvideni.' }),
  extra(907, { datum: '2025-12-05' })
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stkAnalyticsOptOut', 'true'));
});

for (const lang of ['sl', 'en']) {
  const path = lang === 'sl' ? '/druzinam-prijazni-teki/' : '/en/family-friendly-races/';
  for (const width of [390, 1440]) {
    for (const past of [false, true]) {
      test(`${lang} explicit family offers, filters and links at ${width}px (${past ? 'past fallback' : 'upcoming'})`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        // May keeps the adult-only race in range too: it must fail family semantics.
        await page.clock.install({ time: new Date(past ? '2026-12-31T12:00:00+01:00' : '2026-05-01T12:00:00+02:00') });
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route(`${api}/**`, route => {
          const url = new URL(route.request().url());
          return route.fulfill({ json: { data: url.pathname === '/' ? [...races, ...exclusions] : [] } });
        });
        await page.goto(path);
        const cards = page.locator('.search-event-card');
        await expect(cards.locator('h3')).toHaveText([menges.naziv_prireditve, velenje.naziv_prireditve]);
        const card = cards.filter({ hasText: velenje.naziv_prireditve });
        await expect(card.locator('.family-note-row')).toBeVisible();
        await expect(card.locator('h3 a')).toHaveAttribute('href', new RegExp(`^${lang === 'sl' ? '/tek' : '/en/races'}/2026/`));
        await expect(card.locator('a[data-analytics-link-type="prijava"]')).toHaveAttribute('href', velenje.povezava_prijava);
        await expect(card.locator('a[data-analytics-link-type="razpis"]')).toHaveAttribute('href', velenje.povezava_razpis);
        await expect(card.locator('.calendar-menu')).toBeVisible();
        await expect(card.locator('[data-saved-race-button]')).toHaveAttribute('data-event-year', '2026');
        await page.locator('[data-filter="search"]').fill('Velenje');
        await expect(cards).toHaveCount(1);
        await page.locator('[data-clear-filters]').first().click();
        await expect(cards).toHaveCount(2);
        for (const [filter, value] of [['month', '11'], ['region', 'Osrednjeslovenska'], ['surface', 'trail']]) {
          await page.locator(`[data-filter="${filter}"]`).selectOption(value);
          await expect(cards).toHaveCount(1);
          await expect(cards.locator('h3')).toHaveText(filter === 'surface' ? velenje.naziv_prireditve : menges.naziv_prireditve);
          await page.locator('[data-clear-filters]').first().click();
        }
        await expect(cards).toHaveCount(2);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        expect(errors).toEqual([]);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
        if (!past) await page.screenshot({ path: `/tmp/stk-family-${lang}-${width}.png`, fullPage: true });
      });
    }
  }
  test(`${lang} preserves today's cutoff and literal family marker`, async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-04T12:00:00+01:00') });
    await page.route(`${api}/**`, route => route.fulfill({ json: { data: new URL(route.request().url()).pathname === '/' ? [
      ...races, extra(908, { datum: '2026-05-20', naziv_prireditve: 'Past family race' }),
      extra(909, { datum: '2026-11-04', naziv_prireditve: 'Today family race', opombe_javne: 'Družinam prijazno.' })
    ] : [] } }));
    await page.goto(path);
    await expect(page.locator('.search-event-card h3')).toHaveText(['Today family race', menges.naziv_prireditve, velenje.naziv_prireditve]);
  });
  for (const failure of ['http', 'network', 'json']) {
    test(`${lang} API ${failure} failure stays localized and shows no races`, async ({ page }) => {
      await page.route(`${api}/**`, route => failure === 'network' ? route.abort() : route.fulfill({ status: failure === 'http' ? 503 : 200, body: '{', contentType: 'application/json' }));
      await page.goto(path);
      await expect(page.locator('[data-result-count]')).toHaveText(lang === 'sl' ? 'Podatki niso dosegljivi' : 'Data unavailable');
      await expect(page.locator('.search-event-card')).toHaveCount(0);
      await expect(page.locator('[data-search-more]')).toBeHidden();
    });
  }
}
