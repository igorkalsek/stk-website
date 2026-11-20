import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COVERAGE_SAMPLE, geoHubNameQuery, validateGeoHubIdentity, canonicalGursFeatureUrl, validateCanonicalGurs, inspectCoverageCases } from '../scripts/dev056-expand-coverage-qa.mjs';
const s=COVERAGE_SAMPLE[0];
const eid='110300000101000001', ob='110200000110000001';
const geo=()=>({features:[{attributes:{NA_MID:10100001,NAZIV:s.settlement,OBCINA_NAZIV:s.municipality,EID_NASELJE:eid,EID_OBCINA:ob}}]});
const canonical=()=>({type:'FeatureCollection',features:[{type:'Feature',id:eid,properties:{EID_NASELJE:eid,EID_OBCINA:ob,NAZIV:s.settlement,DATUM_SYS:'2025-01-20T08:49:58Z'},geometry:{type:'Polygon',coordinates:[[[15,46],[15.02,46],[15.02,46.02],[15,46.02],[15,46]]]}}]});
const reply=x=>({ok:true,json:async()=>x});
test('coverage hypotheses are stable Master edition keys and region-diverse',()=>{
 assert.equal(COVERAGE_SAMPLE.length,13);
 assert.equal(new Set(COVERAGE_SAMPLE.map(x=>`${x.year}!${x.masterRow}`)).size,13);
 assert.ok(new Set(COVERAGE_SAMPLE.map(x=>x.region)).size>=7);
});
test('query is bounded to one named settlement and municipality, never an unrestricted name lookup',()=>{
 const url=new URL(geoHubNameQuery(s));
 assert.equal(url.searchParams.get('resultRecordCount'),'2');
 assert.match(url.searchParams.get('where'),/NAZIV='Novo mesto' AND OBCINA_NAZIV='Novo mesto'/);
 assert.equal(url.searchParams.get('returnGeometry'),'false');
 assert.equal(canonicalGursFeatureUrl(eid).split('/').at(-1),`${eid}?f=json`);
 assert.throws(()=>canonicalGursFeatureUrl('not-an-eid'),/Invalid/);
});
test('duplicate GeoHub matches fail closed',()=>{
 const g=geo();g.features.push(g.features[0]);
 assert.throws(()=>validateGeoHubIdentity(g,s),/ambiguous/);
});
test('mismatched municipality or EID cannot pass GeoHub identity',()=>{
 const g=geo();g.features[0].attributes.OBCINA_NAZIV='Trebnje';
 assert.throws(()=>validateGeoHubIdentity(g,s),/mismatch/);
 const a=geo();a.features[0].attributes.EID_OBCINA='bad';
 assert.throws(()=>validateGeoHubIdentity(a,s),/mismatch/);
});
test('canonical GURS must match official EIDs and return bounded geometry',()=>{
 const id=validateGeoHubIdentity(geo(),s);
 assert.equal(validateCanonicalGurs(canonical(),id).geometry.type,'Polygon');
 const c=canonical();c.features[0].properties.EID_OBCINA='different';
 assert.throws(()=>validateCanonicalGurs(c,id),/identity mismatch/);
 const z=canonical();z.features[0].geometry={type:'Point',coordinates:[15,46]};
 assert.throws(()=>validateCanonicalGurs(z,id),/not a settlement polygon/);
});
test('successful live records remain REVIEW and are never approved for public runtime',async()=>{
 const calls=[];
 const fetchImpl=async(url,opts)=>{calls.push({url,method:opts.method});return reply(url.includes('geohub.gov.si')?geo():canonical())};
 const r=await inspectCoverageCases({samples:[s],fetchImpl,checkedAt:'2026-11-12T22:10:00Z'});
 assert.equal(r.verified.length,1);assert.equal(r.rejected.length,0);
 assert.equal(r.verified[0].review_status,'REVIEW');
 assert.equal(r.verified[0].approved_for_runtime,false);
 assert.equal(r.verified[0].source_snapshot_date_verified,false);
 assert.equal(r.verified[0].settlement.datum_sys_last_record_change,'2025-01-20T08:49:58Z');
 assert.equal(calls.length,2);assert.ok(calls.every(x=>x.method==='GET'));
});
test('HTTP errors and failed identities never create candidate geometries',async()=>{
 const fetchImpl=async()=>({ok:false,status:403});
 const r=await inspectCoverageCases({samples:[s],fetchImpl});
 assert.equal(r.verified.length,0);
 assert.equal(r.rejected.length,1);
 assert.match(r.rejected[0].reason,/HTTP 403/);
 assert.equal(r.result,'PARTIAL_NO_RUNTIME_APPROVAL');
});
test('duplicate editions and invalid Master date are rejected without any network calls',async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;return reply(geo())};
 const r=await inspectCoverageCases({samples:[{...s,date:'unknown'}, {...s,date:'unknown'}],fetchImpl});
 assert.equal(r.verified.length,0);
 assert.equal(r.rejected.length,2);
 assert.equal(calls,0);
});
