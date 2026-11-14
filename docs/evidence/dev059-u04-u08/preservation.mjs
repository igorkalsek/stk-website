import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const cases = [
 ['2026','r000267-velenje-trail-2026'],['2026','r000268-14-goricatlon'],['2026','r000254-4-lahinja-trail'],['2026','r000064-23-bistriski-tek'],['2026','r000256-go4trail'],['2026','r000260-novomeski-polmaraton'],['2027','r000018-hrastnik-trail-2027'],['2027','r000017-kocevsko-outdoor-festival-2027']
];
const browser=await chromium.launch();const results=[];
for(const language of ['sl','en'])for(const width of [390,768,1440]){
 const context=await browser.newContext({viewport:{width,height:1000}}); const page=await context.newPage();
 await page.clock.setFixedTime(new Date('2026-11-14T12:00:00Z')); await page.addInitScript(()=>localStorage.setItem('stkAnalyticsOptOut','true'));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'&&r.request().method()==='GET'?r.continue():r.abort());
 for(const [year,slug]of cases){const samples=[];
 for(const port of [4330,4329]){
  const response=await page.goto(`http://127.0.0.1:${port}/${language==='sl'?'tek':'en/races'}/${year}/${slug}/`);
  assert.equal(response.status(),200,slug);
  samples.push(await page.evaluate(()=>{
   const values=s=>[...document.querySelectorAll(s)].map(e=>e.textContent.replace(/\s+/g,' ').trim()).sort();
   return {title:values('h1'),facts:values('.event-detail-hero-facts'),date:document.querySelector('time')?.getAttribute('datetime'),fee:values('.registration-fee-value,.registration-fee-details p'),deadlines:values('.registration-deadline-absolute'),family:values('.event-detail-family-callout'),gpx:values('[data-gpx-section]'),map:values('[data-map-precision]'),notes:values('.event-detail-disclaimer'),urls:[...document.querySelectorAll('.event-detail-official-actions a,[data-analytics-link-type="trasa"],[data-analytics-link-type="map_click"],[data-analytics-link-type="gpx"]')].map(e=>({href:e.getAttribute('href'),attrs:[...e.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value])})),scrollWidth:document.documentElement.scrollWidth};
  }));
 }
 assert.deepEqual(samples[1],samples[0],`${language} ${width} ${slug}`);results.push({language,width,year,slug,preserved:true,scrollWidth:samples[1].scrollWidth});
 }
 await context.close();
}
await browser.close();writeFileSync('docs/evidence/dev059-u04-u08/preservation.json',JSON.stringify(results,null,2)+'\n');console.log(`${results.length} baseline/final content and URL comparisons passed`);
