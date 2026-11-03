import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const mode=process.argv[2]||'production';
const out=new URL('./',import.meta.url);
const api='https://stk-master-api.igor-kalsek.workers.dev';
const captured=mode==='production'?{}:JSON.parse(await fs.readFile('/private/tmp/stk-f4-public.json','utf8'));
const browser=await chromium.launch();
const results=[];const liveTimings=[];
for(const path of ['/','/en/']) for(const width of [390,1440]) {
 const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Europe/Ljubljana'});
 let live=mode==='production'&&path==='/'&&width===390;
 await context.route('**/*',async route=>{
  const req=route.request(),u=req.url();
  if(!['GET','HEAD'].includes(req.method()))return route.abort();
  if(u.startsWith(api)||u.includes('/api/interest-preview')){
   const key=u.startsWith(api)?u.slice(api.length):'/api/interest-preview'+new URL(u).search;
   if(live){const start=Date.now();try{const r=await route.fetch({timeout:65000});const body=await r.text();liveTimings.push({key,ms:Date.now()-start,status:r.status()});captured[key]={status:r.status(),headers:r.headers(),body,ms:Date.now()-start};return route.fulfill({response:r,body});}catch(e){return route.abort();}}
   const c=captured[key]; if(!c)return route.fulfill({status:503,json:{ok:false,items:[]}});
   // A controlled slow optional service, identical before and after; public data is replayed.
   if(mode!=='production')await new Promise(r=>setTimeout(r,key.includes('interest-preview')?4000:150));
   return route.fulfill({status:c.status,headers:{'content-type':'application/json'},body:c.body});
  }
  return route.continue();
 });
 await context.addInitScript(()=>{window.__f4={};const start=performance.now();new MutationObserver(ms=>{
  for(const [key,sel] of [['nearest','[data-nearest-events]'],['interest','[data-top-events]']]){
   const el=document.querySelector(sel);if(el&&ms.some(m=>el===m.target||el.contains(m.target)))if(key==='nearest'&&el.querySelector('[data-analytics-placement="home_this_week"]'))window.__f4[key]=performance.now()-start; else if(key==='interest'&&el.querySelector('[data-analytics-placement="home_interest"]'))window.__f4[key]=performance.now()-start;
  }
 }).observe(document,{childList:true,subtree:true});});
 const page=await context.newPage();
 if(mode!=='production')await page.clock.setFixedTime(new Date(Date.parse(JSON.parse(captured['/api/interest-preview?year=2026'].body).generated_at)+2000)); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(let run=0;run<(live?2:1);run++){
  const base=(mode==='production'||mode==='before')?'https://tekaski-koledar.si':'http://127.0.0.1:4344';
  const response=await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>{const s=document.querySelector('[data-status="top"]');return s&&!/nalag|loading/i.test(s.textContent);},{},{timeout:68000}).catch(()=>{});
  await page.waitForTimeout(500);
  const data=await page.evaluate(()=>({timing:window.__f4,nearest:[...document.querySelectorAll('[data-nearest-events] h3')].map(e=>e.textContent),featured:[...document.querySelectorAll('.home-featured-race h3')].map(e=>e.textContent),interest:[...document.querySelectorAll('[data-top-events] h3')].map(e=>e.textContent),status:document.querySelector('[data-status="top"]')?.textContent,sections:[...document.querySelectorAll('main > section')].map(e=>({class:e.className,top:e.getBoundingClientRect().top+scrollY,height:e.getBoundingClientRect().height})),overflow:document.documentElement.scrollWidth>innerWidth,resources:performance.getEntriesByType('resource').filter(e=>e.name.includes('interest-preview')||e.name.includes('stk-master-api')).map(e=>({url:e.name,duration:e.duration,start:e.startTime}))}));
  results.push({path,width,run,live,httpStatus:response.status(),errors,...data});
  await page.addStyleTag({content:'astro-dev-toolbar { display: none !important; }'});
  await page.screenshot({type:'jpeg',quality:80,path:new URL(`${mode}-${path==='/'?'sl':'en'}-${width}${run?'-repeat':''}.jpg`,out).pathname,fullPage:true});
  console.log(JSON.stringify({path,width,run,live,timing:data.timing,interest:data.status,overflow:data.overflow}));
 }
 live=false;await context.close();
}
await browser.close();
await fs.writeFile(new URL(`${mode}.json`,out),JSON.stringify(results,null,2));
if(mode==='production'){await fs.writeFile(new URL('live-requests.json',out),JSON.stringify(liveTimings,null,2));await fs.writeFile('/private/tmp/stk-f4-public.json',JSON.stringify(captured));await fs.writeFile(new URL('public-timing.json',out),JSON.stringify(Object.fromEntries(Object.entries(captured).map(([k,v])=>[k,{status:v.status,ms:v.ms,headers:Object.fromEntries(Object.entries(v.headers).filter(([k])=>['cache-control','x-stk-cache','x-stk-interest-diagnostic','content-type'].includes(k))),bytes:Buffer.byteLength(v.body)}])),null,2));}
