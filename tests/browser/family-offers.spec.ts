import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Public Worker snapshot, 2026-11-04; no live API dependency in regressions.
test.use({ timezoneId: 'America/Los_Angeles' });

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
      await page.goto(`${path}?year=2026`);
      await expect(page.locator('[data-result-count]')).toHaveText(lang === 'sl' ? 'Podatki niso dosegljivi' : 'Data unavailable');
      await expect(page.locator('.search-event-card')).toHaveCount(0);
      await expect(page.locator('[data-search-more]')).toBeHidden();
    });
  }
}

const races2027 = JSON.parse(readFileSync(new URL('../fixtures/family-offers/public-events-2027.json', import.meta.url), 'utf8'));
// Explicit expected set from the public snapshot, independent of the production heuristic.
const familyRows2027 = [6, 7, 8, 11, 13, 17, 19, 25, 33, 36, 45, 46, 49, 50];
const family2027 = races2027.filter(race => familyRows2027.includes(race.row))
  .sort((a, b) => a.datum.localeCompare(b.datum) || a.naziv_prireditve.localeCompare(b.naziv_prireditve, 'sl-SI'));
const collision2027 = { ...velenje, datum: '2027-12-05', naziv_prireditve: 'Family collision 2027' };
const invalid2027 = [
  { ...races[0], datum: '2027-05-17' },
  ...exclusions.filter(race => race.row !== 903).map(race => ({ ...race, datum: race.row === 907 ? '2025-12-05' : '2027-12-05' })),
  { ...collision2027, row: 910, datum: '2027-02-30' },
  { ...collision2027, row: 911, datum: '2027-13-01' },
  { ...collision2027, row: 912, datum: '2027-12-05garbage' }
];

for (const lang of ['sl', 'en']) {
  const path = lang === 'sl' ? '/druzinam-prijazni-teki/' : '/en/family-friendly-races/';
  for (const width of [390, 1440]) {
    test(`${lang} 2027 snapshot, filters, year and language at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.clock.install({ time: new Date('2026-11-04T12:00:00+01:00') });
      const requests: string[] = [];
      await page.route(`${api}/**`, route => {
        const url = new URL(route.request().url());
        requests.push(url.pathname + url.search);
        return route.fulfill({ json: { data: url.pathname === '/' ? url.searchParams.get('year') === '2027'
          ? [...races2027, ...races, ...invalid2027] : races : [] } });
      });
      await page.goto(`${path}?year=2027`);
      const cards = page.locator('.search-event-card');
      await expect(cards.locator('h3')).toHaveText(family2027.map(r => r.naziv_prireditve));
      await expect(page.locator('[data-year-link="2027"]')).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('[data-search-status]')).toContainText('2027');
      expect(requests).toContain('/?year=2027');
      expect(requests).toContain('/additional?year=2027');
      expect(requests).not.toContain('/');
      for (const card of await cards.all()) {
        await expect(card.locator('h3 a')).toHaveAttribute('href', new RegExp(`^${lang === 'sl' ? '/tek' : '/en/races'}/2027/`));
        await expect(card.locator('[data-saved-race-button]')).toHaveAttribute('data-event-year', '2027');
      }
      await page.locator('[data-filter="search"]').fill('nonexistent');
      await expect(cards).toHaveCount(0);
      await expect(page.locator('.search-empty-card')).toContainText('2027');
      await page.locator('[data-clear-filters]').first().click();
      await expect(cards).toHaveCount(14);
      const target = family2027.find(r => r.row === 19);
      for (const [filter, value] of [['search', 'kraš'], ['month', '03'], ['region', target.regija], ['surface', target.tip_podlage]]) {
        const control = page.locator(`[data-filter="${filter}"]`);
        if (filter === 'search') await control.fill(value); else await control.selectOption(value);
        await expect(cards).toHaveCount(family2027.filter(r => filter === 'search' ? r.naziv_prireditve.toLowerCase().includes(value) : filter === 'month' ? r.datum.slice(5, 7) === value : r[filter === 'region' ? 'regija' : 'tip_podlage'] === value).length);
        await page.locator('[data-clear-filters]').first().click();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page.locator('footer a').filter({ hasText: lang === 'sl' ? 'English' : 'Slovenščina' })).toHaveAttribute('href', /year=2027/);
      await page.locator('.page-hero').screenshot({ path: `/tmp/stk-family-2027-hero-${lang}-${width}.png` });
      await page.screenshot({ path: `/tmp/stk-family-2027-${lang}-${width}.png`, fullPage: true });
      if (await page.locator('.nav-toggle').isVisible()) await page.locator('.nav-toggle').click();
      await page.locator('[data-language-switch]').click();
      await expect(page).toHaveURL(/year=2027/);
      await expect(cards).toHaveCount(14);
      await page.locator('[data-year-link="2026"]').click();
      await expect(page).toHaveURL(/year=2026/);
      await expect(cards).toHaveCount(2);
      await page.locator('[data-year-link="2027"]').click();
      await expect(cards).toHaveCount(14);
    });
  }

  for (const [instant, year] of [
    ['2026-12-31T22:59:59Z', '2026'],
    ['2026-12-31T23:00:00Z', '2027']
  ]) {
    test(`${lang} Ljubljana default at ${instant} in a different browser timezone`, async ({ page }) => {
      await page.clock.install({ time: new Date(instant) });
      await page.route(`${api}/**`, route => route.fulfill({ json: { data: [] } }));
      await page.goto(path);
      await expect(page.locator(`[data-year-link="${year}"]`)).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('[data-search-status]')).toContainText(year);
      await expect(page.locator('.search-empty-card')).toContainText(year);
      if (await page.locator('.nav-toggle').isVisible()) await page.locator('.nav-toggle').click();
      await page.locator('[data-language-switch]').click();
      await expect(page).toHaveURL(new RegExp(`year=${year}`));
      // Explicit 2026 must remain selectable after the rollover.
      await page.goto(`${path}?year=2026`);
      await expect(page.locator('[data-year-link="2026"]')).toHaveAttribute('aria-current', 'page');
    });
  }

  test(`${lang} same Master row preserves profiles, saved identity, calendar, additional data and votes`, async ({ page }) => {
    await page.clock.install({ time: new Date('2026-05-01T10:00:00Z') });
    const vote = (race) => ({ ...race, vote_url: `https://example.org/vote?date=${race.datum}&title=${encodeURIComponent(race.naziv_prireditve)}` });
    const additional = (race, year, fee) => ({ leto: year, master_sheet: year, master_row: race.row, datum: race.datum, naziv_prireditve: race.naziv_prireditve, zanesljivost: 'visoka', prijavnina_min_eur: fee });
    await page.route(`${api}/**`, route => {
      const url = new URL(route.request().url());
      const year = url.searchParams.get('year') || '2026';
      const data = url.pathname === '/' ? [year === '2027' ? collision2027 : velenje]
        : url.pathname === '/additional' ? [additional(velenje, '2026', '99'), additional(collision2027, '2027', '7')]
        : [vote(velenje), vote(collision2027)];
      return route.fulfill({ json: { data } });
    });
    await page.goto(`${path}?year=2026`);
    const card = page.locator('.search-event-card');
    await expect(card.locator('h3 a')).toHaveAttribute('href', /\/2026\/r000267-/);
    await expect(card.locator('[data-analytics-action="vote"]')).toHaveAttribute('href', /date=2026-12-05/);
    await card.locator('[data-saved-race-button]').click();
    await expect(card.locator('[data-saved-race-button]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-year-link="2027"]').click();
    await expect(card.locator('h3 a')).toHaveAttribute('href', /\/2027\/r000267-/);
    await expect(card.locator('[data-saved-race-button]')).toHaveAttribute('aria-pressed', 'false');
    await expect(card).toContainText(lang === 'sl' ? '7 €' : '€7');
    await expect(card).not.toContainText(lang === 'sl' ? '99 €' : '€99');
    await expect(card.locator('[data-analytics-action="vote"]')).toHaveAttribute('href', /date=2027-12-05/);
    await card.locator('.calendar-menu summary').click();
    await expect(card.locator('[data-analytics-calendar-type="google"]')).toHaveAttribute('href', /20271205/);
    await card.locator('[data-saved-race-button]').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('stkSavedRacesV2') || '{}'));
    expect(saved.races.map(r => `${r.year}:${r.eventId}`).sort()).toEqual(['2026:r000267', '2027:r000267']);
    await page.locator('[data-year-link="2026"]').click();
    await expect(card.locator('[data-saved-race-button]')).toHaveAttribute('aria-pressed', 'true');
  });

  test(`${lang} 2027 pagination and reset`, async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-04T10:00:00Z') });
    await page.route(`${api}/**`, route => route.fulfill({ json: { data: new URL(route.request().url()).pathname === '/'
      ? Array.from({ length: 35 }, (_, i) => ({ ...collision2027, row: 1000 + i, naziv_prireditve: `Pagination ${i}` })) : [] } }));
    await page.goto(`${path}?year=2027`);
    const cards = page.locator('.search-event-card');
    await expect(cards).toHaveCount(30);
    await page.locator('[data-show-more]').click();
    await expect(cards).toHaveCount(35);
    await expect(page.locator('[data-search-more]')).toBeHidden();
    await page.locator('[data-filter="search"]').fill('Pagination 34');
    await expect(cards).toHaveCount(1);
    await page.locator('[data-clear-filters]').first().click();
    await expect(cards).toHaveCount(30);
  });

  for (const failure of ['http', 'network', 'json']) {
    test(`${lang} 2027 API ${failure} never falls back to 2026`, async ({ page }) => {
      const masterRequests: string[] = [];
      await page.route(`${api}/**`, route => {
        const url = new URL(route.request().url());
        if (url.pathname !== '/') return route.fulfill({ json: { data: [] } });
        masterRequests.push(url.search);
        if (url.searchParams.get('year') !== '2027') return route.fulfill({ json: { data: races } });
        return failure === 'network' ? route.abort() : route.fulfill({ status: failure === 'http' ? 503 : 200, body: '{', contentType: 'application/json' });
      });
      await page.goto(`${path}?year=2027`);
      await expect(page.locator('[data-result-count]')).toHaveText(lang === 'sl' ? 'Podatki niso dosegljivi' : 'Data unavailable');
      await expect(page.locator('[data-search-status]')).toContainText('2027');
      await expect(page.locator('.search-event-card')).toHaveCount(0);
      await expect(page.locator('[data-search-more]')).toBeHidden();
      expect(masterRequests).toEqual(['?year=2027']);
    });
  }
}
