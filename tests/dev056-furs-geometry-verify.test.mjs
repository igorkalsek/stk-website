import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SAMPLES, GEOHUB_LAYER } from '../scripts/dev056-geohub-verify.mjs';
import { FURS_LAYER, fursUrl, assertFursMetadata, inspectFursRecord, inspectGeoHubIdentity, pointInsideSettlementRings, runFursCrosscheck } from '../scripts/dev056-furs-geometry-verify.mjs';
const sample=SAMPLES[0];
const polygonFor = (s) => {
 const x=s.oldE, y=s.oldN;
 return [[[x-1000,y-1000],[x+1000,y-1000],[x+1000,y+1000],[x-1000,y+1000],[x-1000,y-1000]]];
};
const geoMeta={id:20207,geometryType:'esriGeometryPolygon',extent:{spatialReference:{wkid:3794}},supportsAdvancedQueries:true,fields:['NA_MID','NAZIV','OBCINA_NAZIV'].map(name=>({name}))};
const fursMeta={id:4,geometryType:'esriGeometryPolygon',extent:{spatialReference:{wkid:3794}},fields:['na_mid','na','ob'].map(name=>({name}))};
const g=s=>({features:[{attributes:{NA_MID:s.naMid,NAZIV:s.settlement,OBCINA_NAZIV:s.municipality}}]});
const f=s=>({features:[{attributes:{na_mid:s.naMid,na:s.settlement,ob:s.municipality,d_od:100,e:s.oldE+20,n:s.oldN-10},geometry:{rings:polygonFor(s)}}]});
const ok=data=>({ok:true,json:async()=>data});
test('FURS layer must provide EPSG:3794 polygon and identity fields',()=>{
 assert.equal(assertFursMetadata(fursMeta).wkid,3794);
 assert.throws(()=>assertFursMetadata({...fursMeta,id:3}),/metadata/);
 assert.throws(()=>assertFursMetadata({...fursMeta,fields:[]}),/field/);
});
test('bounded queries only for allowlisted settlement IDs',()=>{
 const url=new URL(fursUrl(sample));
 assert.equal(url.origin,new URL(FURS_LAYER).origin);
 assert.equal(url.searchParams.get('where'),'na_mid=10147310');
 assert.equal(url.searchParams.get('resultRecordCount'),'2');
 assert.throws(()=>fursUrl({naMid:999}),/Unknown/);
});
test('different official sources must match same settlement and municipality',()=>{
 assert.equal(inspectGeoHubIdentity(g(sample),sample),true);
 assert.equal(inspectFursRecord(f(sample),sample).status,'LIVE_FURS_GEOMETRY_CROSSCHECKED_NOT_A_START');
 assert.equal(inspectFursRecord(f(sample),sample).archive_2024_reference_point_offset_m,22);
 assert.equal(inspectFursRecord(f(sample),sample).reference_point_within_polygon,true);
 const broken=f(sample); broken.features[0].attributes.ob='Sevnica';
 assert.throws(()=>inspectFursRecord(broken,sample),/identity mismatch/);
});
test('point-in-polygon respects concavity, boundary and nested holes, not just bounding box',()=>{
  const concave=[[[0,0],[10,0],[10,2],[2,2],[2,10],[0,10],[0,0]]];
  assert.equal(pointInsideSettlementRings(1,9,concave),true);
  assert.equal(pointInsideSettlementRings(9,9,concave),false);
  assert.equal(pointInsideSettlementRings(0,4,concave),true);
  const hole=[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[3,3],[7,3],[7,7],[3,7],[3,3]]];
  assert.equal(pointInsideSettlementRings(5,5,hole),false);
  assert.equal(pointInsideSettlementRings(2,2,hole),true);
});
test('FURS point may be in bounding rectangle but outside settlement polygon',()=>{
  const record=f(sample);
  record.features[0].geometry.rings=[[
    [511000,122000],[514000,122000],[514000,122100],[511100,122100],
    [511100,125000],[511000,125000],[511000,122000]
  ]];
  assert.throws(()=>inspectFursRecord(record,sample),/outside settlement polygon/);
});
test('missing published reference point is rejected',()=>{
 const broken=f(sample); delete broken.features[0].attributes.e;
 assert.throws(()=>inspectFursRecord(broken,sample),/reference point/);
});
test('invalid polygon or ambiguous identity fails closed',()=>{
 const bad=f(sample);delete bad.features[0].geometry;
 assert.throws(()=>inspectFursRecord(bad,sample),/Missing\/bad polygon/);
 assert.throws(()=>inspectGeoHubIdentity({features:[]},sample),/count mismatch/);
});
test('three cross-source matches and two rejected labels; never approve public pins',async()=>{
 const visited=[];
 const mock=async(url,options)=>{
  visited.push([url,options.method]);
  if(url===GEOHUB_LAYER+'?f=json')return ok(geoMeta);
  if(url===FURS_LAYER+'?f=json')return ok(fursMeta);
  const q=new URL(url),n=Number(q.searchParams.get('where')?.split('=')[1]);
  const s=SAMPLES.find(x=>x.naMid===n);
  return ok(q.origin===new URL(FURS_LAYER).origin? f(s):g(s));
 };
 const report=await runFursCrosscheck({fetchImpl:mock,now:()=> '2026-11-12T21:00:00Z'});
 assert.equal(report.result,'LIVE_CROSS_SOURCE_POLYGON_PASS_NOT_APPROVED_FOR_PUBLIC_PINS');
 assert.equal(report.checks.length,5);
 assert.equal(visited.length,8);
 assert.ok(visited.every(x=>x[1]==='GET'));
 assert.equal(report.checks.filter(x=>x.status==='CORRECTLY_REJECTED_NO_QUERY').length,2);
 assert.ok(report.checks.slice(0,3).every(x=>!x.published_start_coordinate&&x.snapshot_date_verified===false));
});
test('HTTP errors do not produce successful crosscheck',async()=>{
 const r=await runFursCrosscheck({fetchImpl:async()=>({ok:false,status:503})});
 assert.equal(r.result,'NOT_AVAILABLE_OR_MISMATCH_STOP');
 assert.equal(r.master_or_website_changed,false);
});
