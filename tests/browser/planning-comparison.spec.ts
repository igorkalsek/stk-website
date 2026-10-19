import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Actual public /planning-2027 snapshot, 18 October 2026. Added records are TEST ONLY.
const snapshot = JSON.parse(readFileSync('tests/fixtures/planning-2027.json', 'utf8'));
const endpoint = 'https://stk-master-api.igor-kalsek.workers.dev/planning-2027';
const routeFor = (lang: string) => lang === 'sl' ? '/za-organizatorje/termini-2027/' : '/en/for-organizers/2027-race-dates/';
const confirmed = '[data-comparison-group="confirmed"]';
const nearby = '[data-comparison-group="nearby"]';
const expected = '[data-comparison-group="expected"]';
const known = '[data-comparison-group="known"]';
const testRow = (overrides = {}) => ({ naziv_prireditve: 'TEST ONLY', datum: '', predvideno_od: '', predvideno_do: '', kraj: 'Testni kraj', regija: 'Gorenjska', tip_podlage: 'trail', status: 'pričakovano', ...overrides });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stkAnalyticsOptOut', 'true'));
});

async function load(page: Page, lang: string, options: { data?: unknown; links?: unknown; initial?: boolean; fail?: boolean } = {}) {
  // Replace only embedded planner/link data when needed, keeping the built page and scripts.
  if (options.initial === false || options.links !== undefined) await page.route(`**${routeFor(lang)}`, async route => {
    const response = await route.fetch();
    let body = await response.text();
    if (options.initial === false) body = body.replace(/(<script[^>]*id="planning-2027-data-(?:sl|en)"[^>]*>).*?(<\/script>)/s, '$1null$2');
    if (options.links !== undefined) body = body.replace(/(<script[^>]*data-planning-links[^>]*>).*?(<\/script>)/s, (_, open, close) => `${open}${JSON.stringify(options.links).replace(/</g, '\\u003c')}${close}`);
    await route.fulfill({ response, body });
  });
  await page.route(endpoint, route => options.fail ? route.fulfill({ status: 503 }) : route.fulfill({ json: options.data ?? snapshot }));
  await page.goto(routeFor(lang));
  if (!options.fail) await expect(page.locator('[data-comparison-status]')).toHaveText(lang === 'sl' ? 'Za primerjavo znanih dogodkov izberite datum v letu 2027.' : 'Choose a date in 2027 to compare known events.');
}

async function choose(page: Page, date: string, mode = 'weekend') {
  await page.locator('[data-comparison-mode]').selectOption(mode);
  await page.locator('[data-comparison-date]').fill(date);
}

for (const lang of ['sl', 'en']) {
  for (const width of [390, 1440]) {
    test(`${lang} ${width}px: actual A/B/C scenarios, filters, Sunday, links and existing overview`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await load(page, lang);
      await choose(page, '2027-05-15');
      await expect(page.locator(`${confirmed} .planning-event`)).toHaveCount(4);
      await expect(page.locator(`${nearby} .planning-event`)).toHaveCount(2);
      await expect(page.locator(`${confirmed} .planning-event`).filter({ hasText: '17. KBK TRAIL' }).locator('a[target="_blank"]')).toHaveCount(0);
      const saturday = await page.locator('[data-comparison-results]').innerText();
      await choose(page, '2027-05-16');
      await expect(page.locator('[data-comparison-results]')).toHaveText(saturday, { useInnerText: true });

      // Overview month must not suppress dates or nearby events in the comparison.
      await page.locator('select[name="month"]').selectOption('07');
      await expect(page.locator(`${confirmed} .planning-event`)).toHaveCount(4);
      await expect(page.locator('[data-year-overview] .year-month')).toHaveCount(1);
      await page.locator('select[name="region"]').selectOption('Savinjska');
      await page.locator('select[name="surface"]').selectOption('trail');
      await expect(page.locator(`${confirmed} .planning-event`)).toHaveCount(1);
      await expect(page.locator(confirmed)).toContainText('8. Trail Celje');
      await expect(page.locator('[data-comparison-results]')).toContainText(lang === 'sl' ? 'Dogodki brez teh podatkov' : 'Events missing these details');
      await page.locator('[data-planning-clear]').click();
      await expect(page.locator('[data-year-overview] .year-month')).toHaveCount(12);
      await expect(page.locator(`${confirmed} .planning-event`)).toHaveCount(4);

      await choose(page, '2027-04-11');
      await expect(page.locator(`${confirmed} .planning-event`)).toHaveCount(1);
      await expect(page.locator(confirmed)).toContainText('Luka Koper 13. Istrski maraton');
      await expect(page.locator(expected)).toContainText('Hop na grad');
      await expect(page.locator(`${expected} .planning-event em`)).toHaveText(lang === 'sl' ? 'Pričakovano · ocena STK' : 'Expected · STK estimate');
      await expect(page.locator(`${expected} a`)).toHaveCount(0);

      await choose(page, '2027-07-10');
      await expect(page.locator('[data-comparison-results] .planning-event')).toHaveCount(0);
      await expect(page.locator('[data-comparison-results] .planning-empty')).toContainText(lang === 'sl' ? 'to ne pomeni, da je termin prost' : 'this does not mean the dates are available');
      await expect(page.locator('[data-comparison-results]')).toContainText(lang === 'sl' ? 'ni mogoče primerjati' : 'cannot be compared');

      await choose(page, '2027-05-23');
      await expect(page.locator(confirmed)).toContainText('Kriška gora Trail 2027');
      // The fixture date remains deterministic even if live build data later changes.
      // Links must disappear, rather than be guessed, if that exact build match disappears.
      const event = snapshot.data.find((event: { naziv_prireditve: string }) => event.naziv_prireditve === 'Kriška gora Trail 2027');
      const key = JSON.stringify([event.naziv_prireditve, event.datum, event.kraj, event.regija, event.tip_podlage]);
      const candidates = JSON.parse((await page.locator('[data-planning-links]').textContent())!);
      const matches = candidates.filter((candidate: { key: string }) => candidate.key === key);
      const profile = page.locator(`${confirmed} a`).filter({ hasText: lang === 'sl' ? 'Profil teka na STK' : 'STK race profile' });
      if (matches.length === 1) {
        await expect(profile).toHaveAttribute('href', matches[0].profilePath);
        if (matches[0].officialUrl) await expect(page.locator(`${confirmed} a[target="_blank"]`)).toHaveAttribute('href', matches[0].officialUrl);
        expect((await page.request.get((await profile.getAttribute('href'))!)).status()).toBe(200);
        await page.keyboard.press('Tab');
        await profile.focus();
        await expect(profile).toBeFocused();
        expect(await profile.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
      } else {
        await expect(page.locator(`${confirmed} a`)).toHaveCount(0);
      }
      const sizes = await page.locator('.comparison-controls input, .comparison-controls select, .comparison-links a').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height));
      expect(sizes.every(height => height >= 44)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      // A clipped section capture would otherwise include the sticky header over its title.
      // Interactions, focus and overflow above are checked with the normal header visible.
      await page.locator('.planning-comparison').screenshot({ path: `/tmp/dev035-${lang}-${width}.png`, style: '.site-header { visibility: hidden !important; }' });
      expect(errors).toEqual([]);
    });
  }

  test(`${lang}: known windows, incomplete/reversed periods, day choice and year coverage`, async ({ page }) => {
    const extra = [testRow({ naziv_prireditve: 'TEST known window', status: 'termin_znan', predvideno_od: '2027-12-25', predvideno_do: '2027-12-31' }), testRow({ naziv_prireditve: 'TEST missing end', predvideno_od: '2027-12-31' }), testRow({ naziv_prireditve: 'TEST reversed', predvideno_od: '2027-12-31', predvideno_do: '2027-12-25' }), testRow({ naziv_prireditve: 'TEST confirmed December', status: 'potrjeno', datum: '2027-12-31' })];
    await load(page, lang, { data: { ...snapshot, data: extra }, links: [] });
    await choose(page, '2027-12-31', 'day');
    await expect(page.locator(confirmed)).toContainText('TEST confirmed December');
    await expect(page.locator(known)).toContainText('TEST known window');
    await expect(page.locator(`${expected} .planning-event`)).toHaveCount(0);
    await expect(page.locator('[data-comparison-results]')).toContainText(lang === 'sl' ? 'Podatki zajemajo samo leto 2027' : 'Only 2027 data is covered');
    await choose(page, '2027-12-31');
    await expect(page.locator(`${confirmed} .planning-event`)).toHaveCount(0);
    await expect(page.locator(nearby)).toContainText('TEST confirmed December');
    await expect(page.locator('[data-comparison-results] h3')).toContainText('2028');
    await choose(page, '2027-01-01', 'day');
    await expect(page.locator('[data-comparison-results]')).toContainText('2026');
  });

  for (const initial of [true, false]) test(`${lang}: API failure with initial data=${initial} never appears as zero overlaps`, async ({ page }) => {
    await load(page, lang, { initial, fail: true });
    if (initial) {
      await choose(page, '2027-07-10');
      await expect(page.locator('[data-comparison-status]')).toContainText(lang === 'sl' ? 'Primerjava ni na voljo' : 'The comparison is unavailable');
      await expect(page.locator('[data-comparison-results] .planning-empty')).toHaveCount(0);
      await expect(page.locator('[data-planning-content]')).toBeVisible();
    } else {
      await expect(page.locator('[data-planning-status]')).toHaveAttribute('data-state', 'error');
      await expect(page.locator('[data-planning-content]')).toBeHidden();
    }
  });

  for (const links of [[], [{ malformed: true }], null]) test(`${lang}: absent or malformed link enrichment ${JSON.stringify(links)} does not block comparison`, async ({ page }) => {
    await load(page, lang, { links });
    await choose(page, '2027-05-15');
    await expect(page.locator(`${confirmed} .planning-event`)).toHaveCount(4);
    await expect(page.locator('[data-comparison-results] a')).toHaveCount(0);
  });

  test(`${lang}: confirmed exact match only, safe links and escaped public text`, async ({ page }) => {
    const event = testRow({ naziv_prireditve: 'TEST <img src=x onerror=alert(1)>', status: 'potrjeno', datum: '2027-05-15' });
    const key = JSON.stringify([event.naziv_prireditve, event.datum, event.kraj, event.regija, event.tip_podlage]);
    await load(page, lang, { data: { ...snapshot, data: [event] }, links: [{ key, officialUrl: 'javascript:alert(1)', profilePath: '//evil.example/' }] });
    await choose(page, '2027-05-15');
    await expect(page.locator(confirmed)).toContainText(event.naziv_prireditve);
    await expect(page.locator('[data-comparison-results] img, [data-comparison-results] a')).toHaveCount(0);
    await page.locator('[data-comparison-date]').fill('');
    await expect(page.locator('[data-comparison-results]')).toBeEmpty();
    await expect(page.locator('[data-comparison-status]')).toBeVisible();
  });

  test(`${lang}: loading is distinct from a successful empty API response`, async ({ page }) => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route(endpoint, async route => {
      await pending;
      await route.fulfill({ json: { ...snapshot, row_count: 0, data: [] } });
    });
    try {
      await page.goto(routeFor(lang));
      await choose(page, '2027-05-15');
      await expect(page.locator('[data-comparison-status]')).toHaveText(lang === 'sl' ? 'Preverjamo najnovejše termine …' : 'Checking the latest race dates …');
      await expect(page.locator('[data-comparison-results]')).toBeEmpty();
    } finally { release(); }
    await expect(page.locator('[data-comparison-results] .planning-empty')).toContainText(lang === 'sl' ? 'to ne pomeni, da je termin prost' : 'this does not mean the dates are available');
  });
}
