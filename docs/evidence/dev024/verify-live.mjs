import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch();
const results = [];
for (const lang of ['sl', 'en']) for (const width of [390, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  const errors = []; const publicResponses = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => {
    const request = route.request();
    if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
    if (request.url().startsWith('https://script.google.com')) return route.fulfill({ status: 204 });
    return route.continue();
  });
  const path = lang === 'sl' ? '/za-organizatorje/' : '/en/for-organizers/';
  await page.goto(`https://tekaski-koledar.si${path}`);
  const before = await page.locator('main > section').evaluateAll(nodes => nodes.map(n => n.textContent.replace(/\s+/g, ' ').trim()));
  page.on('response', async response => {
    if (!response.url().startsWith('https://stk-master-api.igor-kalsek.workers.dev')) return;
    publicResponses.push({ url: response.url(), status: response.status() });
  });
  await page.goto(`http://127.0.0.1:4321${path}`);
  const section = page.locator('[data-confirmed-races]');
  await section.waitFor({ state: 'visible', timeout: 40000 });
  const rows = await section.locator('li').evaluateAll(nodes => nodes.map(n => ({
    title: n.querySelector('h3').textContent,
    date: n.querySelector('time').dateTime,
    place: n.querySelector('[data-race-place]').textContent,
    eventId: n.querySelector('[data-organizer-confirmation-badge]').dataset.eventId,
    badgeVisible: !n.querySelector('[data-organizer-confirmation-badge]').hidden,
    href: n.querySelector('a').getAttribute('href')
  })));
  const after = await page.locator('main > section:not([data-confirmed-races])').evaluateAll(nodes => nodes.map(n => n.textContent.replace(/\s+/g, ' ').trim()));
  const profileResponses = [];
  for (const row of rows) {
    const local = await page.request.get(`http://127.0.0.1:4321${row.href}`);
    const production = await page.request.get(`https://tekaski-koledar.si${row.href}`);
    profileResponses.push({ href: row.href, local: local.status(), production: production.status() });
  }
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `docs/evidence/dev024/${lang}-${width}.png`, fullPage: true });
  results.push({ lang, width, rows, profileResponses, existingSectionsUnchanged: JSON.stringify(before) === JSON.stringify(after), overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), errors, publicResponses });
  await page.close();
}
await browser.close();
writeFileSync('docs/evidence/dev024/live-browser.json', JSON.stringify({ checkedAt: new Date().toISOString(), candidate: 'local preview; feature not deployed', results }, null, 2));
if(results.some(r => r.rows.length !== 3 || r.overflow || r.errors.length || !r.existingSectionsUnchanged || r.profileResponses.some(p => p.local !== 200 || p.production !== 200))) process.exitCode = 1;
