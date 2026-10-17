import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildHomepageMasterEventIndex, matchRecentUpdateToMasterEvent, selectHomepageRecentUpdates, selectCanonicalHomepageRecentUpdates, hasMultiYearRecentUpdatesContract, buildHomepageEventDetailPath, buildEnglishHomepageEventDetailPath } from '../.cache/dist-test/utils-home-events.js';
const race = (year, row, extra={}) => ({year:String(year),row:String(row),datum:`${year}-12-20`,naziv_prireditve:`Race ${year} ${row}`,kraj:'Ljubljana',...extra});
const helpers={rowKey:e=>e.row,getTitle:e=>e.naziv_prireditve,getDisplayTitle:s=>s};

test('the same Master row and row-derived event id match only within their year',()=>{
 const events=[race(2026,37),race(2027,37),race(2027,38)],index=buildHomepageMasterEventIndex(events);
 for(const year of [2026,2027]) {
  assert.equal(matchRecentUpdateToMasterEvent({year:String(year),row:'37'},index).event,events[year===2026?0:1]);
  assert.equal(matchRecentUpdateToMasterEvent({year:String(year),event_id:'r000037'},index).event,events[year===2026?0:1]);
 }
 for(const update of [{row:'37'},{event_id:'r000037'},{year:'2027',datum:'2026-12-20',row:'37'},{year:'2027',row:'37',master_row:'38'},{year:'2027',row:'37',event_id:'r000038'},{year:'2027',row:'37',datum:'2027-01-01'}]) assert.equal(matchRecentUpdateToMasterEvent(update,index).event,null);
 assert.equal(matchRecentUpdateToMasterEvent({year:'2027',row:'37'},buildHomepageMasterEventIndex([events[0]])).event,null);
});

test('ambiguous same-year identities and failed Master fetches leave cards unlinked',()=>{
 const e=race(2027,37);
 assert.equal(matchRecentUpdateToMasterEvent(e,buildHomepageMasterEventIndex([e,{...e}])).event,null);
 assert.equal(matchRecentUpdateToMasterEvent(e,buildHomepageMasterEventIndex([])).event,null);
});

test('global selection keeps both years and deduplicates only the same edition',()=>{
 const a={...race(2026,37),recent_update_date:'2026-10-15',update_type:'updated'};
 const b={...race(2027,37),recent_update_date:'2026-10-16',update_type:'new'};
 const c={...race(2027,38),recent_update_date:'2026-10-17',update_type:'confirmed'};
 const groups={updatedEvents:[a,{...b,recent_update_date:'2026-10-14'}],newEvents:[b],confirmedEvents:[c]};
 assert.deepEqual(selectHomepageRecentUpdates(groups).items.map(e=>[e.year,e.row]),[['2027','38'],['2027','37'],['2026','37']]);
 assert.equal(selectHomepageRecentUpdates(groups,2).items.length,2);assert.equal(selectHomepageRecentUpdates(groups,0).items.length,0);
});

test('SL and EN canonical profiles preserve the event year',()=>{
 for(const year of [2026,2027]) {
  const e=race(year,37);
  assert.match(buildHomepageEventDetailPath(e,helpers),new RegExp(`^/tek/${year}/r000037-`));
  assert.match(buildEnglishHomepageEventDetailPath(e,helpers),new RegExp(`^/en/races/${year}/r000037-`));
 }
});

test('capability handshake rejects old APIs, errors and malformed years instead of showing partial years',()=>{
 for(const payload of [null,{}, {ok:false,recent_updates_last_days:{years:['2026','2027']}},{ok:true,recent_updates_last_days:{}},{ok:true,recent_updates_last_days:{years:['2026']}},{ok:true,recent_updates_last_days:{years:[2026,2027]}}]) assert.equal(hasMultiYearRecentUpdatesContract(payload),false);
 assert.equal(hasMultiYearRecentUpdatesContract({ok:true,recent_updates_last_days:{years:['2026','2027'],events:[]}}),true);
});

const canonicalPayload = events => ({ok:true,recent_updates_last_days:{years:['2026','2027'],events}});
const controlUpdate = (row, title, date) => ({...race(2027,row,{naziv_prireditve:title,datum:date}),
  update_type:'new',recent_update_date:'2026-10-16'});

test('canonical API order puts Trail Maribor before Backyard on the same change day, preserving links',()=>{
 const backyard=controlUpdate(37,'Backyard Ultra Ljubljana 2027','2027-10-08');
 const maribor=controlUpdate(38,'Trail Maribor 2027','2027-06-12');
 const payload=canonicalPayload([maribor,backyard]);
 // Contradicting legacy groups must never override the canonical global list.
 payload.recent_updates_last_days.new_events=[backyard,maribor];
 const result=selectCanonicalHomepageRecentUpdates(payload);
 assert.deepEqual(result.items,[maribor,backyard]);
 const index=buildHomepageMasterEventIndex([backyard,maribor]);
 for(const [item,row] of [[result.items[0],'38'],[result.items[1],'37']]) {
  const matched=matchRecentUpdateToMasterEvent(item,index).event;
  assert.match(buildHomepageEventDetailPath(matched,helpers),new RegExp(`^/tek/2027/r0000${row}-`));
  assert.match(buildEnglishHomepageEventDetailPath(matched,helpers),new RegExp(`^/en/races/2027/r0000${row}-`));
 }
});

test('canonical selection preserves API tie order, removes only same-year duplicates and caps cards at four',()=>{
 const updates=[38,37,39,40,41].map(row=>controlUpdate(row,`Race ${row}`,'2027-12-20'));
 const otherYear={...updates[0],year:'2026',datum:'2026-12-20'};
 const result=selectCanonicalHomepageRecentUpdates(canonicalPayload([updates[0],updates[0],updates[1],otherYear,...updates.slice(2)]));
 assert.deepEqual(result.items.map(e=>`${e.year}:${e.row}`),['2027:38','2027:37','2026:38','2027:39']);
 assert.deepEqual(selectCanonicalHomepageRecentUpdates(canonicalPayload(updates),0).items,[]);
});

test('canonical selection rejects absent or malformed events instead of falling back to category order',()=>{
 for(const events of [undefined,null,{},[null],[123],[{recent_update_date:'invalid'}]]) {
  assert.deepEqual(selectCanonicalHomepageRecentUpdates(canonicalPayload(events)),{canOrderGlobally:false,items:[]});
 }
 assert.deepEqual(selectCanonicalHomepageRecentUpdates(canonicalPayload([])),{canOrderGlobally:true,items:[]});
});
