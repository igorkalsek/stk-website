// Run from the repository root: node docs/evidence/dev059-u05/capture.mjs before|after [port]
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Expected before or after');
const root = 'docs/evidence/dev059-u05';
mkdirSync(root, { recursive: true });
const race = (row, datum, naziv_prireditve) => ({ row: String(row), datum, naziv_prireditve, kraj: 'Ljubljana', regija: 'Osrednjeslovenska', tip_podlage: 'cesta', status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA' });
const events = [race(1, '2026-11-15', 'Prvi prihodnji tek'), race(2, '2026-11-16', 'Drugi prihodnji tek'), race(3, '2026-11-17', 'Tretji prihodnji tek'), race(4, '2026-11-18', 'Četrti prihodnji tek'), race(5, '2026-12-06', 'Miklavžev tek')];
const browser = await chromium.launch();
const results = [];
for (const lang of ['sl', 'en']) for (const width of [390, 768, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 1200 }, deviceScaleFactor: 1, timezoneId: 'Europe/Ljubljana' });
  await page.clock.setFixedTime(new Date('2026-11-14T12:00:00Z'));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') {
      if (url.pathname === '/api/interest-preview') return route.fulfill({ json: { ok: true, type: 'interest_preview', items: [] } });
      return route.continue();
    }
    if (url.hostname !== 'stk-master-api.igor-kalsek.workers.dev') return route.abort();
    if (url.searchParams.get('spotlight') === '1') return route.fulfill({ json: { ok: true, type: 'homepage_spotlight', version: 1, selection: null } });
    if (url.pathname === '/') return route.fulfill({ json: { data: url.searchParams.get('year') === '2027' ? [] : events } });
    if (url.pathname === '/stats') return route.fulfill({ json: { confirmed_public_events_total: 320, family_friendly_total: 133 } });
    if (url.pathname === '/group_runs') return route.fulfill({ json: { data: [], row_count: 12 } });
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto(`http://127.0.0.1:${process.argv[3] || 4322}${lang === 'en' ? '/en/' : '/'}`);
  await page.locator('[data-home-spotlight]:not([hidden])').waitFor();
  await page.locator('[data-nearest-events] h3').first().filter({ hasText: 'Prvi prihodnji tek' }).waitFor();
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  results.push(await page.evaluate(({lang, width}) => {
    const card = document.querySelector('[data-home-spotlight]');
    const first = document.querySelector('[data-nearest-events] .event-card');
    return { lang, width, spotlightHeight: +card.getBoundingClientRect().height.toFixed(2), firstRaceY: +(first.getBoundingClientRect().top + scrollY).toFixed(2), documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, selectionMode: card.dataset.selectionMode, profile: card.querySelector('[data-spotlight-title]').getAttribute('href'), analytics: Object.fromEntries(Object.entries(card.dataset).filter(([key]) => key.startsWith('analytics'))) };
  }, {lang, width}));
  await page.screenshot({ path: `${root}/${phase}-${lang}-${width}.jpg`, type: 'jpeg', quality: 78 });
  await page.close();
}
await browser.close();
if (phase === 'after') {
  const before = JSON.parse(readFileSync(`${root}/before.json`, 'utf8'));
  results.forEach((result, index) => {
    assert.deepEqual(result.analytics, before[index].analytics);
    assert.equal(result.profile, before[index].profile);
  });
}
writeFileSync(`${root}/${phase}.json`, JSON.stringify(results, null, 2) + '\n');
console.log(results.map(({lang,width,spotlightHeight,firstRaceY,documentWidth})=>({lang,width,spotlightHeight,firstRaceY,documentWidth})));
