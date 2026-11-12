/**
 * STK DEV-056 — bounded READ-ONLY expansion of the research candidate set.
 * Uses Master-verified event identities but DOES NOT approve or publish locations.
 * Settlement reference geometries are not race starts. No new runtime imports.
 * Source: GeoHub RPE identities + canonical GURS OGC API /items/{EID_NASELJE}.
 * Run: node scripts/dev056-expand-coverage-qa.mjs > dev056-coverage-summary.json
 */
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const GEOHUB_QUERY = 'https://geohub.gov.si/ags/rest/services/MDP_DGO_APPS/eUprava_GH_prostorske_enote/MapServer/20207/query';
const GURS_ITEMS = 'https://ipi.eprostor.gov.si/wfs-si-gurs-rpe/ogc/features/collections/SI.GURS.RPE%3ANASELJA/items';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Existing Master rows verified read-only on 2026-11-12. Municipality is a query hypothesis, not a confirmed identity. */
export const COVERAGE_SAMPLE = Object.freeze([
  { year:2026, masterRow:260, date:'2026-11-14', event:'Novomeški polmaraton', place:'Novo mesto', settlement:'Novo mesto', municipality:'Novo mesto', region:'Jugovzhodna' },
  { year:2026, masterRow:294, date:'2026-11-14', event:'Martinov tek Sečovlje 2026', place:'Sečovlje', settlement:'Sečovlje', municipality:'Piran', region:'Obalno-kraška' },
  { year:2026, masterRow:303, date:'2026-11-14', event:'11. Tek občine Mengeš 2026', place:'Mengeš', settlement:'Mengeš', municipality:'Mengeš', region:'Osrednjeslovenska' },
  { year:2026, masterRow:268, date:'2026-12-05', event:'14. Goricatlon', place:'Nova Gorica', settlement:'Nova Gorica', municipality:'Nova Gorica', region:'Goriška' },
  { year:2026, masterRow:264, date:'2026-12-06', event:'Tek na Kalanov hrib', place:'Izlake', settlement:'Izlake', municipality:'Zagorje ob Savi', region:'Zasavska' },
  { year:2026, masterRow:267, date:'2026-12-05', event:'Velenje Trail 2026', place:'Velenje', settlement:'Velenje', municipality:'Velenje', region:'Savinjska' },
  { year:2027, masterRow:22, date:'2027-03-21', event:'Mali kraški maraton 2027', place:'Sežana', settlement:'Sežana', municipality:'Sežana', region:'Obalno-kraška' },
  { year:2027, masterRow:11, date:'2027-05-15', event:'45. Maraton treh src', place:'Radenci', settlement:'Radenci', municipality:'Radenci', region:'Pomurska' },
  { year:2027, masterRow:23, date:'2027-04-04', event:'Ormoški polmaraton 2027', place:'Ormož', settlement:'Ormož', municipality:'Ormož', region:'Podravska' },
  { year:2027, masterRow:43, date:'2027-03-19', event:'Markoton Backyard Ultra 2027', place:'Bukovci (Markovci)', settlement:'Bukovci', municipality:'Markovci', region:'Podravska' },
  { year:2027, masterRow:17, date:'2027-05-28', event:'Kočevsko Outdoor Festival 2027', place:'Kočevje', settlement:'Kočevje', municipality:'Kočevje', region:'Jugovzhodna' },
  { year:2027, masterRow:57, date:'2027-04-03', event:'SLO 24', place:'Koper', settlement:'Koper', municipality:'Koper', region:'Obalno-kraška' },
  { year:2027, masterRow:14, date:'2027-05-15', event:'18. Nočni tek Celje', place:'Celje – Savinjsko nabrežje', settlement:'Celje', municipality:'Celje', region:'Savinjska' }
]);

const normalized = x => String(x ?? '').normalize('NFC').trim().toLocaleLowerCase('sl-SI');
export const editionKey = e => `${e.year}!${e.masterRow}`;

export function geoHubNameQuery(sample) {
  const url = new URL(GEOHUB_QUERY);
  const quote = str => String(str).replaceAll("'", "''");
  const where = `NAZIV='${quote(sample.settlement)}' AND OBCINA_NAZIV='${quote(sample.municipality)}'`;
  for(const [k,v] of Object.entries({where, outFields:'NA_MID,NAZIV,OBCINA_NAZIV,EID_NASELJE,EID_OBCINA',returnGeometry:'false',resultRecordCount:'2',f:'json'}))url.searchParams.set(k,v);
  return url.toString();
}

export function validateGeoHubIdentity(response, sample) {
  if (response?.error || response?.exceededTransferLimit || !Array.isArray(response?.features) || response.features.length !== 1) {
    throw Error('GeoHub ambiguous/missing settlement identity');
  }
  const a=response.features[0]?.attributes;
  if (normalized(a?.NAZIV)!==normalized(sample.settlement) || normalized(a?.OBCINA_NAZIV)!==normalized(sample.municipality) ||
    !Number.isSafeInteger(a?.NA_MID) || a.NA_MID<=0 || typeof a.EID_NASELJE!=='string' || !/^\d{18}$/.test(a.EID_NASELJE) ||
    typeof a.EID_OBCINA!=='string' || !/^\d{18}$/.test(a.EID_OBCINA)) {
    throw Error('GeoHub settlement/municipality/EID mismatch');
  }
  return { na_mid:a.NA_MID, eid_naselje:a.EID_NASELJE, eid_obcina:a.EID_OBCINA,
    settlement:a.NAZIV, municipality:a.OBCINA_NAZIV };
}

export function canonicalGursFeatureUrl(eid) {
  if(typeof eid!=='string'||!/^\d{18}$/.test(eid))throw Error('Invalid GURS EID');
  return `${GURS_ITEMS}/${eid}?f=json`;
}

export function validateCanonicalGurs(response, id) {
  const arr=response?.features;
  if (response?.type!=='FeatureCollection'||!Array.isArray(arr)||arr.length!==1)throw Error('GURS feature response is not unique');
  const f=arr[0],p=f?.properties;
  if (p?.EID_NASELJE!==id.eid_naselje||p?.EID_OBCINA!==id.eid_obcina||normalized(p?.NAZIV)!==normalized(id.settlement))throw Error('GURS identity mismatch');
  const geometry=f?.geometry;
  if (geometry?.type!=='Polygon'&&geometry?.type!=='MultiPolygon')throw Error('GURS geometry type is not a settlement polygon');
  if (!Array.isArray(geometry.coordinates)||!geometry.coordinates.length)throw Error('GURS polygon empty');
  // Check representative source coordinate pairs; full topology and centroid are verified offline.
  const first=geometry.type==='Polygon'?geometry.coordinates[0]?.[0]:geometry.coordinates[0]?.[0]?.[0];
  if (!Array.isArray(first)||first.length<2||!Number.isFinite(first[0])||!Number.isFinite(first[1])||first[0]<13||first[0]>17||first[1]<45||first[1]>47)throw Error('GURS coordinate range invalid');
  return { geometry, datum_sys:p.DATUM_SYS??null, gurs_feature_id:String(f.id??'') };
}

async function getJson(url, fetchImpl) {
  const response=await fetchImpl(url,{method:'GET',headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const json=await response.json();
  if(json?.error)throw Error('GIS service error');
  return json;
}

export async function inspectCoverageCases({samples=COVERAGE_SAMPLE,fetchImpl=fetch,checkedAt=new Date().toISOString()}={}) {
  const seen=new Set();
  const out={project:'STK DEV-056',purpose:'RESEARCH_ONLY_NOT_AN_APPROVED_RUNTIME_INDEX',checked_at:checkedAt,
    source_geohub:GEOHUB_QUERY,source_gurs:GURS_ITEMS,
    source_snapshot_date_verified:false,datum_sys_means_record_change_not_dataset_snapshot:true,
    approved_for_runtime:false,input_count:samples.length,verified:[],rejected:[],result:'NOT_VERIFIED'};
  for(const sample of samples){
    const key=editionKey(sample);
    if (seen.has(key)||!Number.isInteger(sample.year)||sample.year<2026||!Number.isInteger(sample.masterRow)||sample.masterRow<2||!DATE_RE.test(sample.date)){
      out.rejected.push({edition_key:key,status:'REJECTED_IDENTITY_OR_DATE'});continue;
    }
    seen.add(key);
    try {
      const gh=geoHubNameQuery(sample);
      const id=validateGeoHubIdentity(await getJson(gh,fetchImpl),sample);
      const official=canonicalGursFeatureUrl(id.eid_naselje);
      const canon=validateCanonicalGurs(await getJson(official,fetchImpl),id);
      out.verified.push({edition_key:key,master:{year:sample.year,master_row:sample.masterRow,event_name:sample.event,
        date:sample.date,place:sample.place,region:sample.region},settlement:{...id,datum_sys_last_record_change:canon.datum_sys},
        precision:'settlement-approximate',review_status:'REVIEW',approved_for_runtime:false,
        checked_at:checkedAt,source_snapshot_date_verified:false,
        source_geohub_url:gh,source_gurs_url:official,
        source_geometry_crs:'EPSG:4326',geometry:canon.geometry});
    }catch(e){out.rejected.push({edition_key:key,settlement:sample.settlement,municipality_hypothesis:sample.municipality,
       status:'REVIEW_FAILED_CLOSED',reason:String(e instanceof Error?e.message:e)});}
  }
  out.result=out.rejected.length?'PARTIAL_NO_RUNTIME_APPROVAL':'ALL_ID_AND_POLYGONS_VERIFIED_NO_RUNTIME_APPROVAL';
  return out;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const result=await inspectCoverageCases();
  writeFileSync('dev056-expanded-coverage-geometries.json',JSON.stringify(result,null,2)+'\n');
  process.stdout.write(JSON.stringify({project:result.project,purpose:result.purpose,checked_at:result.checked_at,
    input_count:result.input_count,verified_count:result.verified.length,rejected:result.rejected,
    verified:result.verified.map(x=>({edition_key:x.edition_key,settlement:x.settlement,geometry_type:x.geometry.type,datum_sys:x.settlement.datum_sys_last_record_change,review_status:'REVIEW'})),
    result:result.result,artifact:'dev056-expanded-coverage-geometries.json'},null,2)+'\n');
}
