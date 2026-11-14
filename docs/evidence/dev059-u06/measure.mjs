// Run against the corresponding unmodified main or U06 local preview with nearby enabled.
import { chromium } from '../../../node_modules/playwright-core/index.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
const snapshot=JSON.parse(readFileSync(new URL('../dev056-release/public-events.json',import.meta.url),'utf8'));
const browser=await chromium.launch();
const records=[];
for(const lang of ['sl','en']) for(const width of [390,768,1440]) {
 const page=await browser.newPage({viewport:{width,height:844}});
 await page.clock.setFixedTime(new Date('2026-11-13T09:00:00Z'));
 await page.route('https://stk-master-api.igor-kalsek.workers.dev/**',route=>{
 const url=new URL(route.request().url());
 const data=['/additional','/top'].includes(url.pathname)?[]:snapshot.events.filter(e=>e.year==='2027').map(e=>({row:e.row,datum:e.date,naziv_prireditve:e.naziv_prireditve,kraj:e.place,regija:e.region,tip_podlage:e.surface,razdalje_km:e.distances,povezava_razpis:e.noticeUrl,status_dogodka:'potrjeno',vidno_v_javnem_koledarju:'DA'}));
 return route.fulfill({json:{data}});
 });
 await page.route('https://script.google.com/**',route=>route.fulfill({status:204,body:''}));
 await page.goto((process.argv[3] || 'http://127.0.0.1:4324/')+(lang==='sl'?'iskalnik-tekov/':'en/find-races/')+'?year=2027');
 const cards=page.locator('[data-search-results] .search-event-card');
 await cards.first().waitFor();
 await page.addStyleTag({content:'astro-dev-toolbar { display: none !important; }'});
 if(width<960)await page.locator('[data-mobile-filter-panel] > summary').click();
 for(const state of ['inactive','active']) {
 if(state==='active') await page.locator('[data-nearby-origin-place]').selectOption('Q15930');
 await cards.first().waitFor();
 await page.evaluate(()=>scrollTo(0,0));
 await page.evaluate(()=>document.fonts.ready);
 const record=await page.evaluate(()=>({firstResultY:document.querySelector('[data-search-results] .search-event-card').getBoundingClientRect().top+scrollY,panelHeight:document.querySelector('[data-nearby-panel]').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth}));
 records.push({lang,width,state,count:await cards.count(),...record});
 if(width===390 && state==='active')await page.screenshot({path:new URL(`./${process.argv[2]}-${lang}-${state}.png`,import.meta.url).pathname,fullPage:true,clip:{x:0,y:0,width,height:2500}});
 }
 await page.close();
}
writeFileSync(new URL(`./${process.argv[2]}.json`,import.meta.url),JSON.stringify(records,null,2));
console.log(JSON.stringify(records));
await browser.close();
