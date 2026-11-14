import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const [label = 'before', base = 'http://127.0.0.1:4321'] = process.argv.slice(2);
const fixture = JSON.parse(readFileSync(new URL('../../../tests/fixtures/race-watch.json', import.meta.url)));
const browser = await chromium.launch();
const results = [];
const saved = Object.entries(fixture.masters).flatMap(([year, payload]) => payload.data.map(row => ({ version: 2, eventId: `r${String(row.row).padStart(6, '0')}`, year, date: row.datum, title: row.naziv_prireditve, status: 'following' })));
for (const lang of ['sl', 'en']) for (const width of [390, 768, 1440]) for (const state of (label === 'production' ? ['empty', 'live'] : ['empty', 'one', 'multiple', 'past', 'statuses', 'partial'])) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, timezoneId: 'Europe/Ljubljana' });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  let selected = state === 'empty' ? [] : state === 'one' ? saved.slice(0, 1) : state === 'past' ? saved.filter(x => x.year === '2026').slice(0, 2) : saved;
  if (state === 'statuses') selected = saved.map((x, i) => ({ ...x, status: ['following', 'planning', 'registered', 'completed'][i % 4] }));
  if (label !== 'production') await page.clock.install({ time: new Date(state === 'past' ? '2026-11-14T12:00:00+01:00' : state === 'statuses' ? '2026-12-06T12:00:00+01:00' : '2026-10-19T12:00:00+02:00') });
  await page.addInitScript(races => { localStorage.setItem('stkSavedRacesV2', JSON.stringify({ version: 2, races })); localStorage.setItem('stkAnalyticsOptOut', 'true'); }, selected);
  if (label !== 'production') await page.route('https://stk-master-api.igor-kalsek.workers.dev/**', route => {
    const u = new URL(route.request().url());
    const year = u.searchParams.get('year') === '2027' ? '2027' : '2026';
    if (state === 'partial' && year === '2027' && u.pathname === '/') return route.fulfill({ status: 503, json: { ok: false } });
    let json = u.pathname === '/recent_updates' ? fixture.recent : u.pathname === '/deadlines' ? fixture.deadlines : u.pathname === '/additional' ? { data: [] } : fixture.masters[year];
    return route.fulfill({ json });
  });
  const response = await page.goto(base + (lang === 'sl' ? '/moji-teki/' : '/en/my-races/'));
  await page.locator('[data-my-races-app]').waitFor();
  if (label === 'before' && !(await page.locator('.my-races-page .lead').textContent()).includes(lang === 'sl' ? 'Tu so zbrani' : 'These are the races')) throw new Error('Baseline server must serve main');
  if (label === 'after' && !(await page.locator('.my-races-page .lead').textContent()).includes(lang === 'sl' ? 'Vaš seznam' : 'Your saved races')) throw new Error('After server must serve U10');
  await page.waitForFunction(() => !document.querySelector('[data-my-races-update-status]'));
  if (selected.length) await page.waitForFunction(() => !document.querySelector('[data-race-watch] [role="status"]'));
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'astro-dev-toolbar { display:none!important }' });
  const metrics = await page.evaluate(() => {
    const box = selector => { const el = document.querySelector(selector); if (!el) return null; const r = el.getBoundingClientRect(); return { y: Math.round(r.top + scrollY), height: Math.round(r.height) }; };
    const hashInput = [...document.querySelectorAll('.my-race-card')].map(el => el.outerHTML).join('');
    return { firstCard: box('.my-race-card'), firstTitle: box('.my-race-card h3'), tabs: box('.my-races-tabs'), local: box('.my-races-local-note'), watch: box('[data-race-watch]'), next: box('[data-next-race-step]'), deadline: box('[data-next-registration-deadline]'), filters: box('.my-races-status-filters'), export: box('.my-races-toolbar'), scrollWidth: document.documentElement.scrollWidth, cards: document.querySelectorAll('.my-race-card').length, hashInput, season: document.querySelector('[data-my-season-app]').innerHTML };
  });
  const { hashInput, season, ...rest } = metrics;
  results.push({ lang, width, state, status: response.status(), ...rest, cardsHash: createHash('sha256').update(hashInput).digest('hex'), seasonHash: createHash('sha256').update(season).digest('hex'), errors });
  if (state === 'multiple' || (width === 390 && ['past', 'partial', 'empty', 'live'].includes(state))) {
    await page.setViewportSize({ width, height: 1500 });
    await page.screenshot({ path: new URL(`${label}-${lang}-${width}-${state}.jpg`, import.meta.url).pathname, fullPage: false, quality: 80 });
  }
  await page.close();
}
await browser.close();
writeFileSync(new URL(`${label}.json`, import.meta.url), JSON.stringify(results, null, 2) + '\n');
console.log(results.map(({ cardsHash, seasonHash, ...r }) => r));
