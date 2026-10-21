import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const b=await chromium.launch(); const results=[]; const base=process.env.STK_BASE_URL||'http://127.0.0.1:4344';
for(const path of ['/','/en/']) for(const width of [390,1440]) for(const years of [[],['2026'],['2026','2027']]){
 const c=await b.newContext({timezoneId:'Europe/Ljubljana',viewport:{width,height:1000}});const p=await c.newPage(); const calls=[],network=[],loads=[];
 await p.clock.setFixedTime(new Date('2026-10-21T10:00:00Z'));
 await p.addInitScript(years=>{localStorage.setItem('stkSavedRacesV2',JSON.stringify({version:2,races:years.map(year=>({version:2,eventId:'r000037',year,date:`${year}-12-20`,title:`Test ${year}`,status:'following'}))}));const original=window.fetch;window.__fetchCalls=[];window.fetch=(...args)=>{window.__fetchCalls.push(String(args[0]));return original(...args)};},years);
 await p.route('**/*',async r=>{const u=new URL(r.request().url());if(r.request().method()!=='GET')return r.fulfill({status:204});if(u.hostname==='stk-master-api.igor-kalsek.workers.dev'){
 await new Promise(resolve=>setTimeout(resolve,180));const year=u.searchParams.get('year')||'2026';let json={data:[]};if(u.pathname==='/')json={data:[{row:'37',leto:year,datum:`${year}-12-20`,naziv_prireditve:`Test ${year}`,kraj:'Ljubljana',regija:'Osrednjeslovenska',status_dogodka:'potrjeno',vidno_v_javnem_koledarju:'DA'}]};if(u.pathname==='/additional')json={data:[{leto:year,master_sheet:year,master_row:'37',datum:`${year}-12-20`,naziv_prireditve:`Test ${year}`,rok_prijave:`${year}-12-19`,zanesljivost:'visoka'}]};if(u.pathname==='/recent_updates')json={recent_updates_last_days:{years:['2026','2027'],events:[]}};return r.fulfill({json});}
 if(u.pathname==='/api/interest-preview')return r.fulfill({json:{ok:true,type:'interest_preview',items:[]}});
 if(u.pathname.endsWith('.astro')&&base.includes('4344')){const response=await r.fetch();let source=await response.text();source=source.replace('async function loadJson(path) {','async function loadJson(path) { window.__loadJsonCalls ??= []; window.__loadJsonCalls.push(path);');return r.fulfill({response,body:source});}
 return r.continue();});
 p.on('request',r=>{if(r.url().includes('stk-master-api'))network.push(new URL(r.url()).pathname+new URL(r.url()).search)});
 await p.goto(base+path);await p.waitForLoadState('networkidle');await expect(p.locator('[data-my-stk-content]')).not.toBeEmpty();
 const initial=[...network]; const dom=await p.locator('main').innerHTML();
 await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('stkSavedRacesV2'));if(s.races[0])s.races[0].status='planning';localStorage.setItem('stkSavedRacesV2',JSON.stringify(s));window.dispatchEvent(new Event('stk:saved-races-changed'));});await p.waitForTimeout(350);
 const status=network.slice(initial.length);
 const mark=network.length;
 await p.locator('[data-saved-race-button]').first().click();await p.waitForTimeout(350);
 const save=network.slice(mark);
 const data={path,width,years,initial,status,save,fetchCalls:await p.evaluate(()=>window.__fetchCalls.filter(s=>s.includes('stk-master-api'))),loadJsonCalls:await p.evaluate(()=>window.__loadJsonCalls||[]),overflow:await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),dom};results.push(data);console.log(JSON.stringify({...data,dom:undefined}));await c.close();
}
await fs.writeFile(process.env.STK_OUTPUT||'/private/tmp/stk-dev044-before.json',JSON.stringify(results,null,2));await b.close();
