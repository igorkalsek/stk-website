import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// Same public Worker snapshots, clock and empty filters for both revisions.
const [label, base = 'http://127.0.0.1:4327'] = process.argv.slice(2);
if (!['before', 'after'].includes(label)) throw new Error('Use before or after, then the preview URL.');
const fixtures = Object.fromEntries(['2026', '2027'].map(year => [year,
  JSON.parse(readFileSync(new URL(`../../../tests/fixtures/family-offers/public-events${year === '2027' ? '-2027' : ''}.json`, import.meta.url)))]));
const browser = await chromium.launch();
const measurements = [];
for (const lang of ['sl', 'en']) for (const width of [390, 768, 1440]) for (const year of ['2026', '2027']) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, timezoneId: 'Europe/Ljubljana' });
  await page.clock.install({ time: new Date('2026-11-14T12:00:00+01:00') });
  await page.addInitScript(() => localStorage.setItem('stkAnalyticsOptOut', 'true'));
  await page.route('https://stk-master-api.igor-kalsek.workers.dev/**', route => {
    const url = new URL(route.request().url());
    return route.fulfill({ json: { data: url.pathname === '/' ? fixtures[url.searchParams.get('year') || '2026'] : [] } });
  });
  await page.goto(`${base}${lang === 'sl' ? '/druzinam-prijazni-teki/' : '/en/family-friendly-races/'}?year=${year}`);
  await page.locator('.search-event-card h3').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  const result = await page.evaluate(() => ({
    firstTitleY: document.querySelector('.search-event-card h3').getBoundingClientRect().top + scrollY,
    firstTitle: document.querySelector('.search-event-card h3').textContent,
    count: document.querySelectorAll('.search-event-card').length,
    scrollWidth: document.documentElement.scrollWidth,
    cards: document.querySelector('[data-search-results]').innerHTML,
    seo: [...document.querySelectorAll('title, meta[name="description"], link[rel="canonical"], link[rel="alternate"]')].map(el => el.outerHTML)
  }));
  const { cards, ...metrics } = result;
  measurements.push({ lang, width, year, ...metrics, cardsSha256: createHash('sha256').update(cards).digest('hex') });
  if (width === 390 && year === '2027') {
    await page.setViewportSize({ width, height: 1800 });
    await page.screenshot({ path: new URL(`${label}-${lang}.png`, import.meta.url).pathname });
  }
  await page.close();
}
await browser.close();
if (label === 'after') {
  const before = JSON.parse(readFileSync(new URL('before.json', import.meta.url)));
  for (const [i, result] of measurements.entries()) {
    for (const key of ['lang', 'width', 'year', 'firstTitle', 'count', 'cardsSha256', 'seo']) {
      assert.deepEqual(result[key], before[i][key], `${key}: ${result.lang}/${result.width}/${result.year}`);
    }
    assert.ok(result.scrollWidth <= result.width, 'Horizontal overflow');
    if (result.width === 390) assert.ok(result.firstTitleY <= 1000, 'First title below 1000px');
  }
}
writeFileSync(new URL(`${label}.json`, import.meta.url), JSON.stringify(measurements, null, 2) + '\n');
console.log(measurements.map(({ seo, ...row }) => row));
