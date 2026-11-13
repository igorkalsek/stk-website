// DEV-056 research-only. Never writes public indexes, Master or approved flags.
// Run only on the dedicated GitHub workflow against a frozen read-only Master snapshot.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const source = JSON.parse(readFileSync('research/dev056-all-upcoming-2026-2027.audit.review.json','utf8'));
const unique = [...new Set(source.candidates.map(x => x.place))];
const editorial = new Map([
  ['Križ pri Sežani',{query:'Križ',note:'must be Sežana municipality'}],
  ['Bukovci (Markovci)',{query:'Bukovci',note:'must be Markovci municipality'}],
  ['Celje – Šmartinsko jezero',{query:'Celje',note:'coarse city reference only, actual lake venue separate'}],
  ['Celje – Savinjsko nabrežje',{query:'Celje',note:'coarse city reference only, actual riverbank venue separate'}],
  ['Maribor – Grajski trg',{query:'Maribor',note:'coarse city reference only; verify Grajski trg exact venue'}],
  ['Bohinj – Ribčev Laz',{query:'Ribčev Laz',note:'specific settlement, not entire Bohinj'}],
  ['Mače pri Preddvoru',{query:'Mače',note:'must be Municipality Preddvor and KZTL start near Mače'}],
  ['Brezovica pri Ljubljani',{query:'Brezovica',note:'must be Municipality Brezovica near Ljubljana'}],
  ['Stari trg pri Ložu',{query:'Stari trg pri Ložu',note:'must be municipality Loška dolina'}],
  ['Črna na Koroškem',{query:'Črna na Koroškem',note:'must be Koroška Slovenia, not town with same name'}],
]);
const excluded = new Map([
  ['Poreč–Livade–Grožnjan–Portorož','different national starts and cross-border locations'],
  ['Parenzana – Hrvaška–Slovenija','multiple cross-border starts, no single point'],
  ['Trbovlje–Hrastnik','multiple venues, must locate run entry/exit'],
  ['Vipavska dolina','valley-wide ultra, multiple starts'],
  ['Slivnica (Cerknica)','mountain name, not necessarily race start in Cerknica'],
  ['Krvavec','mountain ski resort vs lower gondola start in KZTL'],
  ['Sv. Andrej','not disambiguated; may be hillside destination'],
  ['Črne njive nad Ilirsko Bistrico','nature area, not the town center'],
  ['Smučišče Gače','ski-area site, needs explicit venue georeference'],
  ['Velika planina','large alpine plateau, event start unknown'],
  ['Rogla','ski resort with potentially several starting sites'],
  ['Kamniška Bistrica','mountain valley, organiser starts need more precision']
]);

const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const clean=(s)=>String(s||'').normalize('NFC').trim().toLocaleLowerCase('sl-SI');
let requestCount=0;
async function requestWikidata(url, retries=2) {
  for(let attempt=0;attempt<=retries;attempt++){
    const ctrl=new AbortController();
    const timeout=setTimeout(()=>ctrl.abort(),20000);
    try{
      requestCount++;
      const response=await fetch(url,{
        signal:ctrl.signal,
        headers:{'User-Agent':'STK-calendar-source-audit/0.1 (tekaski.koledar@gmail.com)',
          'Accept':'application/json'}
      });
      if(!response.ok) {
        if([429,500,502,503,504].includes(response.status)&&attempt<retries){
          await sleep(1200*(attempt+1));continue;
        }
        throw new Error('Wikidata response '+response.status);
      }
      const data=await response.json();
      return data;
    } catch(err) {
      if(attempt===retries)throw err;
      await sleep(850*(attempt+1));
    } finally {clearTimeout(timeout);}
  }
}
function urlFor(action,fields) {
 const url=new URL('https://www.wikidata.org/w/api.php');
 url.searchParams.set('action',action);
 url.searchParams.set('format','json');
 url.searchParams.set('formatversion','2');
 for(const [key,value] of Object.entries(fields))url.searchParams.set(key,String(value));
 return url.toString();
}
async function searchName(q) {
 try{
  const s=await requestWikidata(urlFor('wbsearchentities',{search:q,language:'sl',uselang:'sl',type:'item',limit:8}));
  if(s.error)throw Error(s.error.info||s.error.code);
  const candidates=(s.search||[]).map(o=>({id:o.id,label:o.label,description:o.description||'',match:o.match?.type||''}));
  return {candidates,error:null};
 }catch(e){return {candidates:[],error:String(e)};}
}
const planned=unique.map(raw=>{
 const mapped=editorial.get(raw)||{query:raw,note:''};
 const skip=excluded.get(raw);
 return {raw_place:raw,query:skip?null:mapped.query,editorial_note:skip||mapped.note||null,excluded:!!skip};
});
const results=[];
for(const entry of planned){
 if(entry.excluded){results.push({...entry,search_candidates:[],query_error:null});continue;}
 const result=await searchName(entry.query);
 results.push({...entry,search_candidates:result.candidates,query_error:result.error});
 await sleep(140);
}
const ids=[...new Set(results.flatMap(x=>x.search_candidates.map(y=>y.id)).filter(x=>/^Q[0-9]+$/.test(x)))];
const entities={};
for(let i=0;i<ids.length;i+=45) {
 try{
  const batch=await requestWikidata(urlFor('wbgetentities',{ids:ids.slice(i,i+45).join('|'),props:'claims|labels|descriptions',languages:'sl|en'}));
  if(batch.error)throw Error(batch.error.info||batch.error.code);
  Object.assign(entities,batch.entities||{});
 }catch(err){console.log('BATCH_ENTITY_ERROR',i,String(err));}
 await sleep(240);
}
function mainValues(entity,prop){
 return (entity?.claims?.[prop]||[]).filter(s=>s?.mainsnak?.snaktype==='value').map(s=>s.mainsnak.datavalue?.value).filter(Boolean);
}
function entityInfo(id){
 const e=entities[id];
 if(!e)return null;
 const labels=[e.labels?.sl?.value,e.labels?.en?.value].filter(Boolean);
 const descrs=[e.descriptions?.sl?.value,e.descriptions?.en?.value].filter(Boolean);
 const c=mainValues(e,'P625').filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&p.globe?.includes('/Q2'));
 const countries=mainValues(e,'P17').map(v=>v.id);
 const admins=mainValues(e,'P131').map(v=>v.id);
 return {id,labels,descriptions:descrs,country_ids:countries,admin_ids:admins,
   coordinate_claims:c.map(p=>({lat:Number(p.latitude.toFixed(8)),lon:Number(p.longitude.toFixed(8)),precision:p.precision||null})),
   single_earth_coord:c.length===1,slovenia_claimed:countries.includes('Q215')};
}
for(const entry of results) {
 entry.candidate_entities=entry.search_candidates.map(c=>entityInfo(c.id)).filter(Boolean);
 const eligible=entry.candidate_entities.filter(e=>e.slovenia_claimed&&e.single_earth_coord&&e.labels.some(l=>clean(l)===clean(entry.query)));
 entry.unique_slovenia_exact_label=(eligible.length===1);
 entry.provisional_match=eligible.length===1?eligible[0]:null;
 entry.review_status=entry.excluded?'EXCLUDED_GEOGRAPHY_COMPLEX':
    entry.query_error?'FETCH_ERROR':
    eligible.length===0?'NO_EXACT_UNIQUE_SLOVENIA_COORDINATE':
    eligible.length>1?'AMBIGUOUS_EXACT_COORDINATE':'CANDIDATE_REQUIRES_EVENT_VENUE_REVIEW';
 entry.approved_for_runtime=false;
}
const output={
 kind:'DEV056_READ_ONLY_WIKIDATA_GEOPROBE_NOT_FOR_PUBLICATION',
 generated_on:new Date().toISOString(),snapshot_from:'research/dev056-all-upcoming-2026-2027.audit.review.json',
 license_reference:'https://www.wikidata.org/wiki/Wikidata:Licensing',
 license:'Wikidata structured data CC0',
 method:'wbsearchentities in sl, wbgetentities P625 P17; no name-only runtime approval',
 request_count:requestCount,
 place_total:unique.length,
 results
};
mkdirSync('research/out',{recursive:true});
writeFileSync('research/out/dev056-wikidata-probe.generated.json',JSON.stringify(output,null,2)+'\n');
const counts={};
for(const x of results)counts[x.review_status]=(counts[x.review_status]||0)+1;
console.log('STK_GEOPROBE_SUMMARY',JSON.stringify({count:results.length,requested:requestCount,entity_count:Object.keys(entities).length,states:counts}));
for(const x of results) {
 const p=x.provisional_match;
 console.log('STK_GEOPROBE_ROW',JSON.stringify({
  raw:x.raw_place,query:x.query,status:x.review_status,qid:p?.id||null,
  coords:p?.coordinate_claims?.[0]||null,descr:p?.descriptions?.slice(0,1)||[],
  candidate_ids:x.search_candidates.slice(0,6).map(y=>y.id),
  note:x.editorial_note,error:x.query_error
 }));
}
console.log('RESEARCH_ONLY: all entries remain false approved_for_runtime. Manual edition source verification is required.');
