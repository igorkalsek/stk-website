import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const [phase, port] = process.argv.slice(2);
const browser = await chromium.launch();
const results = [];
for (const language of ['sl','en']) for (const width of [390,768,1440]) {
 const context = await browser.newContext({ viewport: { width, height: 1200 }, deviceScaleFactor: 1 });
 const page = await context.newPage();
 await page.clock.setFixedTime(new Date('2026-11-14T12:00:00Z'));
 await page.addInitScript(() => localStorage.setItem('stkAnalyticsOptOut','true'));
 await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' && route.request().method() === 'GET' ? route.continue() : route.abort());
 await page.goto(`http://127.0.0.1:${port}/${language === 'sl' ? 'tek' : 'en/races'}/2026/r000267-velenje-trail-2026/`);
 await page.evaluate(() => document.fonts.ready);
 const metrics = await page.evaluate(() => {
  const rect = el => { if (!el) return null; const r=el.getBoundingClientRect(); return {top:Math.round(r.top+scrollY),bottom:Math.round(r.bottom+scrollY),left:Math.round(r.left),right:Math.round(r.right)}; };
  const fee = document.querySelector('.registration-fee-value');
  const deadline = document.querySelector('[data-deadline-kind="registration"]')?.closest('.registration-deadline-detail');
  return { title:rect(document.querySelector('h1')),date:rect(document.querySelector('time')),facts:rect(document.querySelector('.event-detail-hero-facts')),official:rect(document.querySelector('.event-detail-official-actions')),fee:rect(fee),deadline:rect(deadline),deadlineDate:rect(deadline?.querySelector('.registration-deadline-absolute')),myRace:rect(document.querySelector('.event-detail-my-race-panel')),highlights:document.querySelector('.event-detail-highlights')?.innerText ?? null,scrollWidth:document.documentElement.scrollWidth, critical: [...document.querySelectorAll('.event-detail-info-card-grid article, [data-gpx-section], [data-map-precision]')].map(e=>e.textContent.trim()), links:[...document.querySelectorAll('.event-detail-official-actions a')].map(e=>({href:e.getAttribute('href'),attributes:[...e.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value])})) };
 });
 results.push({language,width,...metrics});
 await page.screenshot({path:`docs/evidence/dev059-u04-u08/${phase}-${language}-${width}.png`});
 await context.close();
}
await browser.close();
writeFileSync(`docs/evidence/dev059-u04-u08/${phase}.json`,JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(({language,width,fee,deadlineDate,scrollWidth})=>({language,width,fee,deadlineDate,scrollWidth})),null,2));
