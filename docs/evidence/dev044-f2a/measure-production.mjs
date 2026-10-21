import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch();
const results=[];
for (const path of ['/', '/en/']) for (const years of [[],['2026'],['2026','2027']]) {
 const context=await browser.newContext({timezoneId:'Europe/Ljubljana'});
 await context.route('**/*', r => r.request().method()==='GET' ? r.continue() : r.abort());
 const page=await context.newPage(); const requests=[],responses=[];
 page.on('request',r=>{if(r.url().includes('stk-master-api')) requests.push({url:r.url(),method:r.method(),at:Date.now()});});
 page.on('response',r=>{if(r.url().includes('stk-master-api')) responses.push({url:r.url(),status:r.status()});});
 await page.addInitScript(years=>localStorage.setItem('stkSavedRacesV2',JSON.stringify({version:2,races:years.map(year=>({version:2,eventId:'r000037',year,date:`${year}-12-20`,title:'Measurement reference',status:'following'}))})),years);
 const started=Date.now(); let error=null; let status=null;
 try {status=(await page.goto(`https://tekaski-koledar.si${path}`,{waitUntil:'networkidle',timeout:45000})).status();}catch(e){error=e.message;}
 const initial=requests.length;
 if(await page.locator('[data-my-stk]').count()) {
 await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('stkSavedRacesV2'));if(state.races[0])state.races[0].status='planning';localStorage.setItem('stkSavedRacesV2',JSON.stringify(state));window.dispatchEvent(new Event('stk:saved-races-changed'));});
 await page.waitForTimeout(2500);
 }
 const data={path,years,status,error,elapsedMs:Date.now()-started,title:await page.title(),initialRequests:initial,requests,responses,body:(await page.locator('body').innerText()).slice(0,180),scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>e.src)),resources:await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('stk-master-api')).map(r=>({url:r.name,duration:r.duration,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize})))};
 results.push(data);console.log(JSON.stringify(data));await context.close();
 if(status===403) break;
}
await fs.writeFile('/private/tmp/stk-dev044-production.json',JSON.stringify(results,null,2));
await browser.close();
