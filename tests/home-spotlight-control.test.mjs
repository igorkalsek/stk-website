import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveHomepageSpotlight, spotlightLabel, spotlightRead, fetchSpotlightControl, millisecondsToNextLjubljanaDay } from '../.cache/dist-test/utils-home-spotlight.js';
import { selectHomepageSpotlightRace, selectUpcomingHomepageEvents } from '../.cache/dist-test/utils-home-events.js';
import { mapPublicRaceEvent } from '../.cache/dist-test/utils-event-detail.js';
import { getTodayIsoInLjubljana } from '../.cache/dist-test/utils-date.js';
const event = (row, date, name) => ({ row, datum:date, naziv_prireditve:name, kraj:'Trbovlje', status_dogodka:'potrjeno', vidno_v_javnem_koledarju:'DA' });
const jamatlon = event('263','2026-11-28','Zimski jamatlon');
const automatic = event('300','2026-12-15','Automatic race');
const nearby = ['2026-11-29','2026-11-30','2026-12-01','2026-12-02'].map((date,i) => event(String(i+1),date,'Nearby ' + i));
const rows = [...nearby,jamatlon,automatic];
const sources = [{ year:'2026',payload:{ok:true,data:rows} },{ year:'2027',payload:{ok:true,data:[]} }];
const selection = { year:'2026', master_row:'263', expected_event_date:'2026-11-28', expected_event_name:'Zimski jamatlon', start_date:'2026-11-13', end_date:'2026-11-28', selection_type:'editorial' };
const control = (config = selection) => ({ok:true,type:'homepage_spotlight',version:1,selection:config});
const resolve = (config=selection,today='2026-11-20',input=sources) => resolveHomepageSpotlight(input,control(config),today);
const fallback = config => assert.equal(resolve(config)?.mode,'automatic');
test('missing/inactive/legacy control preserves original weekly selection for each day', () => {
  for (const day of ['2026-11-13','2026-11-20','2026-11-28','2026-11-29']) {
    const mapped = rows.map(row=>mapPublicRaceEvent(row,'2026',new Date(day+'T00:00:00').getTime())).filter(Boolean);
    const original = selectHomepageSpotlightRace(mapped,selectUpcomingHomepageEvents(mapped),day);
    for (const config of [null,{}, {ok:true,data:rows},control(null),{...control(),ok:false}]) {
      assert.deepEqual(resolveHomepageSpotlight(sources,config,day),original ? {race:original,mode:'automatic'} : null);
    }
  }
});
test('manual Jamatlon bypasses nearest-four and 14-day restrictions', () => {
  for (const day of ['2026-11-13','2026-11-20','2026-11-28']) {
    assert.equal(resolve(selection,day)?.race.row,'263'); assert.equal(resolve(selection,day)?.mode,'editorial');
  }
  const onlyJamatlon = [{year:'2026',payload:{data:[jamatlon]}}];
  assert.equal(resolve(selection,'2026-11-27',onlyJamatlon)?.race.row,'263');
  assert.equal(resolveHomepageSpotlight(onlyJamatlon,null,'2026-11-27'),null);
});
test('local first/last day and next day switch automatically, independent of viewer timezone', () => {
  for (const [instant,mode] of [
    ['2026-11-12T22:59:59Z','automatic'],['2026-11-12T23:00:00Z','editorial'],
    ['2026-11-28T22:59:59Z','editorial'],['2026-11-28T23:00:00Z','automatic']
  ]) assert.equal(resolve(selection,getTodayIsoInLjubljana(new Date(instant)))?.mode,mode);
  assert.equal(resolve({...selection,end_date:'2026-12-31'},'2026-11-29')?.mode,'automatic');
});
for (const [key,value] of [
  ['year','2028'],['year','2027'],['master_row','262'],['master_row','263.0'],['master_row','1'],
  ['expected_event_name','Other'],['expected_event_date','2026-11-29'],['expected_event_date','2026-02-30'],
  ['start_date','2026-02-30'],['start_date','2026-11-29'],['end_date','2026-11-12'],['selection_type','sponsored']
]) test(`invalid manual ${key}=${value} falls back`,()=>fallback({...selection,[key]:value}));
test('malformed/ambiguous response shapes cannot promote',()=>{
  for (const payload of [control([selection,selection]),control({...selection,master_row:263}),{...control(),version:2},{...control(),type:'master'}]) {
    assert.equal(resolveHomepageSpotlight(sources,payload,'2026-11-20')?.mode,'automatic');
  }
});
for (const change of [
  {datum:'2026-11-29'},{naziv_prireditve:'Renamed'}, {status_dogodka:'odpovedano'},
  {status_dogodka:'prestavljeno'}, {status_dogodka:'neuradno'}, {vidno_v_javnem_koledarju:'NE'}
]) test('canonical drift fails closed: '+JSON.stringify(change),()=>{
  const input=[{year:'2026',payload:{data:[...nearby,{...jamatlon,...change},automatic]}}];
  assert.equal(resolve(selection,'2026-11-20',input)?.mode,'automatic');
});
test('all raw row matches are counted, including invisible/invalid duplicate rows',()=>{
  const input=[{year:'2026',payload:{data:[...rows,{...jamatlon,vidno_v_javnem_koledarju:'NE'}]}}];
  assert.equal(resolve(selection,'2026-11-20',input)?.mode,'automatic');
});
test('missing/failed selected Master cannot be replaced by stale promotion data',()=>{
  assert.equal(resolve(selection,'2026-11-20',[]),null);
  assert.equal(resolve(selection,'2026-11-20',[{year:'2026',payload:{ok:false,data:rows}}]),null);
  const other=[{year:'2027',payload:{data:[event('263','2027-01-03','Different year')]}}];
  const selected=resolve(selection,'2026-11-20',other);
  assert.equal(selected.mode,'automatic'); assert.equal(selected.race.year,'2027');
});
test('editorial and partner labels are explicit in both languages',()=>{
  assert.equal(resolve({...selection,selection_type:'partner'}).mode,'partner');
  assert.equal(spotlightLabel('partner',false),'PARTNERSKA PROMOCIJA');
  assert.equal(spotlightLabel('partner',true),'PARTNER PROMOTION');
  for (const mode of ['automatic','editorial']) {
    assert.equal(spotlightLabel(mode,false),'UREDNIŠKI IZBOR STK');
    assert.equal(spotlightLabel(mode,true),'STK EDITORIAL PICK');
  }
});
test('midnight timer handles standard time and both DST changes',()=>{
  for (const [instant,hours] of [['2026-11-12T23:00:00Z',24],['2026-03-28T23:00:00Z',23],['2026-10-24T22:00:00Z',25]]) {
    assert.equal(millisecondsToNextLjubljanaDay(new Date(instant)),hours*3600000);
  }
  assert.equal(millisecondsToNextLjubljanaDay(new Date('2026-11-28T22:59:59Z')),1000);
});
test('timeouts discard slow results; control fetch uses no-store and rejects transport failure',async()=>{
  await assert.rejects(spotlightRead(new Promise(()=>{}),5),/timed out/);
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async(url,options)=>{
      assert.match(url,/\?spotlight=1$/); assert.equal(options.cache,'no-store'); assert.ok(options.signal);
      return new Response('',{status:503});
    };
    await assert.rejects(fetchSpotlightControl(),/unavailable/);
  } finally { globalThis.fetch=original; }
});

test('manual 2027 identity is scoped by year even with the same row in 2026', () => {
  const config = {...selection, year:'2027', expected_event_date:'2027-01-20', start_date:'2026-12-20', end_date:'2027-01-20'};
  const input = [{year:'2026',payload:{data:[jamatlon]}},{year:'2027',payload:{data:[{...jamatlon,datum:'2027-01-20'}]}}];
  assert.equal(resolve(config,'2026-12-20',input)?.race.year,'2027');
  assert.equal(resolve(config,'2026-12-20',input)?.mode,'editorial');
});
