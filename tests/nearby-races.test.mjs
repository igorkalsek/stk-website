import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  NEARBY_RADII_KM, airDistanceKm, editionKey, filterNearbyRaces, isValidWgs84, summarizeNearbyCoverage, nearbyDiscoveryCopy, prepareNearbyFinderView
} from '../.cache/dist-test/utils-nearby-races.js';
import { parseNearbyOrigin, parseNearbyRadius, mountNearbyFinderUi, isApprovedNearbyOrigin } from '../.cache/dist-test/finder/race-finder-nearby-ui.js';

const checked = (year, row, latitude, longitude, precision = 'settlement-approximate') => ({
  year, masterRow: row, latitude, longitude, precision,
  reviewStatus: 'approved', approved_for_runtime:true,
  sourceUrl: precision === 'start'
    ? 'https://example.org/official'
    : 'https://ipi.eprostor.gov.si/wfs-si-gurs-rpe/ogc/features/collections/SI.GURS.RPE%3ANASELJA/items/110300000101473100?f=json',
  sourceCheckedOn: '2026-11-12',
  sourceKind: precision === 'start' ? 'official-edition-start' : 'official-settlement',
  sourceEditionYear: precision === 'start' ? Number(year) : undefined,
  sourceSnapshotOn: precision === 'start' ? undefined : '2026-10-01'
});
const zagorje = { latitude: 46.1314, longitude: 14.9965 };
const event = (year, row) => ({ year, row: String(row), label: `${year}!${row}` });

test('supported radii are explicit and invalid coordinates fail closed', () => {
  assert.deepEqual(NEARBY_RADII_KM, [10, 25, 50, 100]);
  assert.equal(isValidWgs84({ latitude: 91, longitude: 0 }), false);
  assert.equal(isValidWgs84({ latitude: 0, longitude: NaN }), false);
  assert.equal(Number.isNaN(airDistanceKm(zagorje, { latitude: Infinity, longitude: 14 })), true);
  assert.equal(filterNearbyRaces([], [], zagorje, 13).status, 'unavailable');
});

test('haversine gives zero for same point and ~111.2 km per latitude degree', () => {
  assert.equal(airDistanceKm(zagorje, zagorje), 0);
  assert.ok(Math.abs(airDistanceKm({ latitude: 46, longitude: 15 }, { latitude: 47, longitude: 15 }) - 111.195) < 0.1);
});

test('editions are joined by year + master_row, not by place or event name', () => {
  assert.equal(editionKey(event('2026', 51)), '2026!51');
  assert.equal(editionKey(event('2027', 51)), '2027!51');
  assert.equal(editionKey(event('2027', 1)), null);
  const events = [event('2026', 51), event('2027', 51)];
  const refs = [checked('2027', 51, zagorje.latitude, zagorje.longitude)];
  const result = filterNearbyRaces(events, refs, zagorje, 10);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.unlocatedEditionKeys, ['2026!51']);
  assert.deepEqual(result.matches.map(x => x.event.label), ['2027!51']);
});

test('results are ordered by air distance, with precision signalled honestly', () => {
  const events = [event('2027', 52), event('2027', 51)];
  const refs = [
    checked('2027', 51, zagorje.latitude, zagorje.longitude, 'start'),
    checked('2027', 52, zagorje.latitude + 0.09, zagorje.longitude)
  ];
  const result = filterNearbyRaces(events, refs, zagorje, 25);
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.matches.map(x => x.event.row), ['51', '52']);
  assert.deepEqual(result.matches.map(x => x.approximate), [false, true]);
  assert.ok(result.matches[1].distanceKm > 9 && result.matches[1].distanceKm < 11);
});

test('unreviewed or outdated-index entries never become approved search results', () => {
  const events = [event('2027', 51)];
  const base = checked('2027', 51, zagorje.latitude, zagorje.longitude);
  for (const bad of [
    { ...base, reviewStatus: 'review' },
    { ...base, sourceSnapshotOn: '' },
    { ...base, sourceUrl: 'http://example.org/official' },
    { ...base, sourceCheckedOn: '2026-02-30' },
    { ...base, sourceSnapshotOn: '2027-10-01' },
    { ...base, longitude: NaN }
  ]) {
    const result = filterNearbyRaces(events, [bad], zagorje, 10);
    assert.equal(result.status, 'partial');
    assert.equal(result.matches.length, 0);
    assert.deepEqual(result.unlocatedEditionKeys, ['2027!51']);
  }
});

test('multi-start/region-only events with no reviewed reference are shown as coverage gaps', () => {
  const result = filterNearbyRaces([
    event('2027', 8), event('2027', 12), event('2027', 51)
  ], [checked('2027', 51, zagorje.latitude, zagorje.longitude)], zagorje, 10);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.unlocatedEditionKeys, ['2027!8', '2027!12']);
  assert.equal(result.matches.length, 1);
});

test('duplicates, ambiguous editions, invalid origin and radius cannot quietly match', () => {
  const p = checked('2027', 51, zagorje.latitude, zagorje.longitude);
  assert.equal(filterNearbyRaces([event('2027', 51)], [p, p], zagorje, 25).status, 'unavailable');
  assert.equal(filterNearbyRaces([event('2027', 51), event('2027', 51)], [p], zagorje, 25).status, 'unavailable');
  assert.equal(filterNearbyRaces([event('2027', 51)], [p], { latitude: 92, longitude: 15 }, 25).status, 'unavailable');
  assert.equal(filterNearbyRaces([event('2027', 51)], [p], zagorje, -1).status, 'unavailable');
});

test('edition-specific organizer GPS does not require a geodata snapshot', () => {
 const start=checked('2026',266,45.81833333,13.82511667,'start');
 const race=event('2026',266);
 assert.equal(filterNearbyRaces([race],[start],start,10).matches.length,1);
 const wrongEdition={...start,sourceEditionYear:2025};
 assert.equal(filterNearbyRaces([race],[wrongEdition],start,10).status,'partial');
 assert.equal(filterNearbyRaces([race],[wrongEdition],start,10).matches.length,0);
 const unknownKind={...start,sourceKind:'unverified-web-map'};
 assert.equal(filterNearbyRaces([race],[unknownKind],start,10).matches.length,0);
 const misleadingSnapshot={...start,sourceSnapshotOn:'2026-10-01'};
 assert.equal(filterNearbyRaces([race],[misleadingSnapshot],start,10).matches.length,0);
});

test('settlement centroid needs a dated snapshot OR an explicitly checked official GURS feature', () => {
 const settlement=checked('2027',19,45.7373449,13.8576759);
 const race=event('2027',19);
 for (const invalid of [
   {...settlement,sourceSnapshotOn:undefined},
   {...settlement,sourceSnapshotOn:'2022-10-27',sourceKind:'official-edition-start'},
   {...settlement,sourceKind:'official-edition-start',sourceEditionYear:2027},
   {...settlement,precision:'start',sourceKind:'official-settlement'}
 ]) {
   const output=filterNearbyRaces([race],[invalid],settlement,25);
   assert.equal(output.status,'partial');
   assert.equal(output.matches.length,0);
 }
});

test('source order and input data remain unchanged by matching', () => {
  const events = Object.freeze([event('2027', 52), event('2027', 51)]);
  const refs = Object.freeze([
    Object.freeze(checked('2027', 51, zagorje.latitude, zagorje.longitude)),
    Object.freeze(checked('2027', 52, zagorje.latitude + 0.05, zagorje.longitude))
  ]);
  filterNearbyRaces(events, refs, zagorje, 10);
  assert.deepEqual(events.map(e => e.row), ['52', '51']);
  assert.deepEqual(refs.map(r => r.masterRow), [51, 52]);
});

test('P1 edition venue evidence is not mistaken for GPS start data', () => {
  const evidence=JSON.parse(readFileSync(new URL('../research/dev056-start-venue-evidence.review.json',import.meta.url),'utf8'));
  assert.equal(evidence.status,'REVIEW_ONLY_NOT_FOR_IMPORT_OR_PUBLICATION');
  assert.equal(evidence.runtime_activation,false);
  assert.equal(evidence.records.length,11);
  assert.equal(new Set(evidence.records.map(e=>e.edition_key)).size,11);
  const withGps=evidence.records.filter(e=>e.start_coordinate);
  assert.equal(withGps.length,1);
  assert.equal(withGps[0].edition_key,'2026!266');
  assert.equal(withGps[0].source_edition_year,2026);
  assert.equal(isValidWgs84(withGps[0].start_coordinate),true);
  assert.ok(evidence.records.every(e=>e.review_status==='REVIEW' && e.approved_for_runtime===false
    && /^https:\/\//.test(e.official_year_evidence_url)));
  const kocevje=evidence.records.find(e=>e.edition_key==='2027!17');
  assert.equal(kocevje.role,'multiple_distinct_start_locations');
  assert.equal(kocevje.start_coordinate,null);
  assert.ok(kocevje.per_distance_start_places.length>=2);
  assert.ok(kocevje.source_conflict_review.includes('REVIEW'));
});

test('P0j GURS edition candidates are review-only and cannot become search results', () => {
  const dataset=JSON.parse(readFileSync(new URL('../research/dev056-location-candidates.review.json', import.meta.url), 'utf8'));
  assert.equal(dataset.status,'REVIEW_ONLY_NOT_FOR_IMPORT_OR_PUBLICATION');
  assert.equal(dataset.runtime_index_allowed,false);
  assert.equal(dataset.entries.length,16);
  assert.equal(dataset.coverage_audit.confirmed_public_events_in_ranges,93);
  assert.equal(dataset.coverage_audit.candidate_share_of_examined_public_events_percent,17.2);
  assert.equal(dataset.coverage_audit.public_index_approved,false);
  assert.equal(dataset.coverage_audit.verified_actual_race_starts_in_runtime_index,0);
  assert.equal(new Set(dataset.entries.map(x=>x.edition_key)).size,16);
  assert.ok(dataset.entries.some(x=>x.edition_key==='2026!264'
    && x.canonical_gurs.municipality==='Zagorje ob Savi'));
  assert.deepEqual(dataset.explicit_rejections.map(x=>x.edition_key),['2027!8','2027!12']);
  assert.ok(dataset.entries.every(x=>x.review_status==='REVIEW'
    && x.canonical_gurs.polygon_valid===true
    && x.canonical_gurs.interior_point_verified===true
    && x.approved_for_runtime===false
    && x.source_snapshot_date_verified===false));
  const events=dataset.entries.map(x=>event(String(x.year),x.master_row));
  const candidateRefs=dataset.entries.map(x=>({
    year:String(x.year), masterRow:x.master_row,
    latitude:x.candidate_wgs84.latitude, longitude:x.candidate_wgs84.longitude,
    precision:'settlement-approximate', reviewStatus:'review',
    sourceUrl:x.canonical_gurs.official_feature_url,
    sourceCheckedOn:'2026-11-12', sourceSnapshotOn:''
  }));
  const result=filterNearbyRaces(events,candidateRefs,{latitude:46,longitude:15},100);
  assert.equal(result.status,'partial');
  assert.equal(result.matches.length,0);
  assert.deepEqual(result.unlocatedEditionKeys,events.map(e=>editionKey(e)));
});

test('coverage summary counts only approved edition-bound points, by precision', () => {
  const events = [event('2027',51),event('2027',52),event('2027',53),event('2027',54)];
  const index = [
    checked('2027',51,zagorje.latitude,zagorje.longitude,'start'),
    checked('2027',52,zagorje.latitude+0.05,zagorje.longitude),
    { ...checked('2027',53,zagorje.latitude,zagorje.longitude), reviewStatus: 'review' }
  ];
  const summary = summarizeNearbyCoverage(events,index);
  assert.equal(summary.status,'partial');
  assert.deepEqual([
    summary.totalEditions, summary.locatedEditions,
    summary.exactStartEditions, summary.approximateSettlementEditions,
    summary.coveragePercent
  ],[4,2,1,1,50]);
  assert.deepEqual(summary.unlocatedEditionKeys,['2027!53','2027!54']);
  // A zero-match radius query can still have unresolved nearby races.
  const distantOrigin = { latitude: 45, longitude: 13 };
  const nearby = filterNearbyRaces(events,index,distantOrigin,10);
  assert.equal(nearby.matches.length,0);
  assert.equal(nearby.status,'partial');
  assert.deepEqual(events.map(x=>x.row),['51','52','53','54']);
});

test('coverage empty and invalid inputs fail closed; REVIEW-only GURS data remains zero coverage', () => {
  const empty = summarizeNearbyCoverage([],[]);
  assert.equal(empty.status,'empty');
  assert.equal(empty.coveragePercent,null);
  assert.equal(summarizeNearbyCoverage([event('2027',51),event('2027',51)],[]).status,'unavailable');
  const duplicate = checked('2027',51,zagorje.latitude,zagorje.longitude);
  assert.equal(summarizeNearbyCoverage([event('2027',51)],[duplicate,duplicate]).status,'unavailable');
  const review=JSON.parse(readFileSync(new URL('../research/dev056-location-candidates.review.json', import.meta.url),'utf8'));
  const reviewIndex=review.entries.map(x=>({
    year: String(x.year), masterRow:x.master_row,
    latitude:x.candidate_wgs84.latitude, longitude:x.candidate_wgs84.longitude,
    precision:'settlement-approximate', reviewStatus:'review',
    sourceKind:'official-settlement', sourceUrl:x.canonical_gurs.official_feature_url,
    sourceCheckedOn:'2026-11-12'
  }));
  const covered=summarizeNearbyCoverage(review.entries.map(x=>event(String(x.year),x.master_row)),reviewIndex);
  assert.equal(covered.status,'partial');
  assert.equal(covered.totalEditions,16);
  assert.equal(covered.locatedEditions,0);
  assert.equal(covered.coveragePercent,0);
  assert.equal(covered.unlocatedEditionKeys.length,16);
});

test('DEV-056 180-day pilot source snapshot is edition-bound, explicitly non-runtime and genuinely partial', () => {
  const snapshot=JSON.parse(readFileSync(new URL('../research/dev056-pilot-180d.review.json',import.meta.url),'utf8'));
  assert.equal(snapshot.kind,'NON_RUNTIME_PILOT_SNAPSHOT');
  assert.equal(snapshot.runtime_activation,false);
  assert.equal(snapshot.public_index_approved,false);
  assert.deepEqual(snapshot.period,{from_inclusive:'2026-11-13',to_exclusive:'2027-05-12',days:180});
  assert.equal(snapshot.coverage_audit.eligible_total,59);
  assert.equal(snapshot.coverage_audit.eligible_2026,26);
  assert.equal(snapshot.coverage_audit.eligible_2027,33);
  assert.equal(new Set(snapshot.eligible_editions.map(e=>e.edition_key)).size,59);
  assert.ok(snapshot.eligible_editions.every(e=>e.datum>=snapshot.period.from_inclusive&&e.datum<snapshot.period.to_exclusive));
  assert.equal(snapshot.coverage_audit.review_only_settlement_candidates_in_population,13);
  assert.equal(snapshot.pilot_offline_index.length,1);
  const start=snapshot.pilot_offline_index[0];
  assert.equal(start.master_edition_key,'2026!266');
  assert.equal(start.approval_scope,'OFFLINE_TEST_ONLY');
  assert.equal(start.approved_for_runtime,false);
  assert.equal(start.sourceEditionYear,2026);
  assert.equal(start.source_coordinates_raw,'N 45 49.100; E 13 49.507');
  assert.ok(Math.abs(start.latitude-(45+49.100/60))<1e-8);
  assert.ok(Math.abs(start.longitude-(13+49.507/60))<1e-8);
  const events=snapshot.eligible_editions.map(e=>event(String(e.year),e.master_row));
  // Even accidental use of the offline pilot fixture cannot activate a public result.
  const blocked=summarizeNearbyCoverage(events,snapshot.pilot_offline_index);
  assert.equal(blocked.locatedEditions,0);
  assert.equal(blocked.coveragePercent,0);
  assert.equal(filterNearbyRaces(events,snapshot.pilot_offline_index,{latitude:start.latitude,longitude:start.longitude},10).matches.length,0);
  // Only an explicit ephemeral offline-only test copy exercises calculation.
  const verifiedOffline=[{...start,approved_for_runtime:true}];
  const audit=summarizeNearbyCoverage(events,verifiedOffline);
  assert.deepEqual([audit.status,audit.totalEditions,audit.locatedEditions,audit.exactStartEditions,audit.approximateSettlementEditions,audit.coveragePercent],['partial',59,1,1,0,1.7]);
  assert.equal(audit.unlocatedEditionKeys.length,58);
  const nearby=filterNearbyRaces(events,verifiedOffline,{latitude:start.latitude,longitude:start.longitude},10);
  assert.equal(nearby.status,'partial');
  assert.deepEqual(nearby.matches.map(m=>editionKey(m.event)),['2026!266']);
  assert.equal(nearby.matches[0].approximate,false);
  const wrongEdition={...start,sourceEditionYear:2027};
  const invalid=summarizeNearbyCoverage(events,[wrongEdition]);
  assert.equal(invalid.locatedEditions,0);
  assert.equal(invalid.coveragePercent,0);
});

test('2026/27 repeated start venues remain non-coordinate, edition bound and review-only', () => {
  const evidence=JSON.parse(readFileSync(new URL('../research/dev056-repeated-start-venues.review.json',import.meta.url),'utf8'));
  const snapshot=JSON.parse(readFileSync(new URL('../research/dev056-pilot-180d.review.json',import.meta.url),'utf8'));
  assert.equal(evidence.status,'REVIEW_ONLY_NOT_FOR_IMPORT_OR_PUBLICATION');
  assert.equal(evidence.runtime_activation,false);
  assert.equal(evidence.public_index_approved,false);
  assert.equal(evidence.venue_profiles.length,6);
  const all=new Set(evidence.venue_profiles.flatMap(v=>v.edition_keys));
  const confirmed=new Set(snapshot.eligible_editions.map(e=>e.edition_key));
  assert.equal(all.size,24);
  assert.ok([...all].every(k=>confirmed.has(k)));
  assert.equal(evidence.coverage.eligible_upcoming_in_window,59);
  assert.equal(evidence.coverage.league_fraction_percent,40.7);
  assert.equal(evidence.coverage.edition_with_approved_numeric_gps,0);
  assert.equal(evidence.venue_profiles.reduce((n,v)=>n+v.edition_keys.length,0),33);
  assert.ok(evidence.venue_profiles.every(v=>v.season==='2026/2027'&&v.review_status==='REVIEW'&&v.approved_for_runtime===false&&v.coordinates===null&&v.official_season_evidence_url.startsWith('https://')));
  const adult=evidence.venue_profiles.find(v=>v.venue_id==='sztl-2026-27-mavrica-adult');
  const youth=evidence.venue_profiles.find(v=>v.venue_id==='sztl-2026-27-zalec-stadium-youth');
  const shared=evidence.venue_profiles.find(v=>v.venue_id==='kztl-2026-27-jost-mohor');
  assert.equal(adult.edition_keys.length,9);
  assert.deepEqual(adult.edition_keys,youth.edition_keys);
  assert.equal(shared.edition_keys.length,6);
  assert.ok(shared.edition_keys.some(k=>k==='2026!261')&&shared.edition_keys.some(k=>k==='2026!313'));
  // Venue evidence must not be silently passed as complete nearby coordinate coverage.
  assert.equal(summarizeNearbyCoverage(snapshot.eligible_editions.map(e=>event(String(e.year),e.master_row)),[]).locatedEditions,0);
});

test('multi-start edition requires fully reviewed roles and resolves nearest start once', () => {
  const adult={...checked('2027',51,46.100,15.100,'start'),startRole:'adult_start'};
  const youth={...checked('2027',51,46.110,15.110,'start'),startRole:'youth_start'};
  const race={...event('2027',51),startRoles:['adult_start','youth_start']};
  const nearby=filterNearbyRaces([race],[adult,youth],{latitude:46.110,longitude:15.110},10);
  assert.equal(nearby.status,'ready');
  assert.equal(nearby.matches.length,1);
  assert.equal(nearby.matches[0].matchedRole,'youth_start');
  assert.equal(nearby.matches[0].distanceKm,0);
  const audited=summarizeNearbyCoverage([race],[adult,youth]);
  assert.deepEqual([audited.totalEditions,audited.locatedEditions,audited.exactStartEditions,audited.coveragePercent],[1,1,1,100]);
  const other=filterNearbyRaces([race],[adult,youth],{latitude:46.100,longitude:15.100},10);
  assert.equal(other.matches[0].matchedRole,'adult_start');
});

test('adult-only or youth-only positions never silently represent multi-start edition', () => {
  const race={...event('2027',51),startRoles:['adult_start','youth_start']};
  const adult={...checked('2027',51,46.100,15.100,'start'),startRole:'adult_start'};
  const youth={...checked('2027',51,46.110,15.110,'start'),startRole:'youth_start'};
  for(const partial of [[adult],[youth],[adult,{...youth,reviewStatus:'review'}],
    [adult,{...youth,approved_for_runtime:false}],
    [adult,{...youth,sourceEditionYear:2026}],
    [adult,{...youth,precision:'settlement-approximate',sourceKind:'official-settlement',sourceSnapshotOn:'2026-11-01'}]]){
    const nearby=filterNearbyRaces([race],partial,{latitude:46.100,longitude:15.100},10);
    assert.equal(nearby.status,'partial');
    assert.equal(nearby.matches.length,0);
    assert.deepEqual(nearby.unlocatedEditionKeys,['2027!51']);
    assert.equal(summarizeNearbyCoverage([race],partial).locatedEditions,0);
  }
  assert.equal(filterNearbyRaces([event('2027',51)],[adult,youth],{latitude:46.100,longitude:15.100},10).status,'partial');
  assert.equal(summarizeNearbyCoverage([event('2027',51)],[adult,youth]).locatedEditions,0);
});

test('multi-start index rejects duplicate roles and mixed scoped/unscoped records', () => {
  const race={...event('2027',51),startRoles:['adult_start','youth_start']};
  const adult={...checked('2027',51,46.100,15.100,'start'),startRole:'adult_start'};
  const youth={...checked('2027',51,46.110,15.110,'start'),startRole:'youth_start'};
  const origin={latitude:46.100,longitude:15.100};
  for(const bad of [[adult,adult],[adult,{...adult,latitude:46.102}],
    [adult,{...youth,startRole:undefined}],[adult,{...youth,startRole:'adult start'}]]){
    assert.equal(filterNearbyRaces([race],bad,origin,10).status,'unavailable');
    assert.equal(summarizeNearbyCoverage([race],bad).status,'unavailable');
  }
  for(const invalidRoles of [['adult_start','adult_start'],['adult_start'],['adult start','youth_start']]){
    assert.equal(filterNearbyRaces([{...race,startRoles:invalidRoles}],[adult,youth],origin,10).status,'unavailable');
    assert.equal(summarizeNearbyCoverage([{...race,startRoles:invalidRoles}],[adult,youth]).status,'unavailable');
  }
});

test('multi-start edition can use a single verified settlement reference for approximate discovery', () => {
  const race={...event('2027',51),startRoles:['adult_start','youth_start']};
  const approximate={...checked('2027',51,46.2490358,15.164716),
    sourceSnapshotOn:undefined, sourceFeatureVerified:true,
    sourceUrl:'https://ipi.eprostor.gov.si/wfs-si-gurs-rpe/ogc/features/collections/SI.GURS.RPE%3ANASELJA/items/110300000101473100?f=json'};
  const result=filterNearbyRaces([race],[approximate],{latitude:46.2490358,longitude:15.164716},25);
  assert.equal(result.status,'ready');
  assert.equal(result.matches.length,1);
  assert.equal(result.matches[0].approximate,true);
  assert.equal(result.matches[0].matchedRole,undefined);
  assert.equal(summarizeNearbyCoverage([race],[approximate]).approximateSettlementEditions,1);
  // A city-centre point never becomes an exact start, even if flagged as such.
  assert.equal(filterNearbyRaces([race],[{...approximate,precision:'start'}],{latitude:46.2490358,longitude:15.164716},25).matches.length,0);
  const unreviewed={...approximate,reviewStatus:'review'};
  assert.equal(filterNearbyRaces([race],[unreviewed],{latitude:46.2490358,longitude:15.164716},25).matches.length,0);
  const unpublished={...approximate,approved_for_runtime:false};
  assert.equal(filterNearbyRaces([race],[unpublished],{latitude:46.2490358,longitude:15.164716},25).matches.length,0);
});

test('undated settlement reference rejects unknown or counterfeit provenance', () => {
  const legitimate={...checked('2027',51,46.2490358,15.164716),
    sourceSnapshotOn:undefined,sourceFeatureVerified:true,
    sourceUrl:'https://ipi.eprostor.gov.si/wfs-si-gurs-rpe/ogc/features/collections/SI.GURS.RPE%3ANASELJA/items/110300000101473100?f=json'};
  const race=event('2027',51);
  const origin={latitude:46.2490358,longitude:15.164716};
  assert.equal(filterNearbyRaces([race],[legitimate],origin,25).matches.length,1);
  for(const bad of [
    {...legitimate,sourceFeatureVerified:false},
    {...legitimate,sourceFeatureVerified:undefined},
    {...legitimate,sourceUrl:'https://example.org/not-gurs-feature'},
    {...legitimate,sourceUrl:'https://ipi.eprostor.gov.si.evil.org/item/123?f=json'},
    {...legitimate,sourceUrl:'https://ipi.eprostor.gov.si/wfs-si-gurs-rpe/ogc/features/collections/SI.GURS.RPE%3ANASELJA/items/not-a-feature?f=json'},
    {...legitimate,sourceKind:'official-edition-start'},
    {...legitimate,sourceSnapshotOn:'not-a-real-snapshot'}
  ]){
    assert.equal(filterNearbyRaces([race],[bad],origin,25).matches.length,0);
  }
});

test('OFFLINE approximate pilot demonstrates 21 of 59 eligible editions, without activating any review data', () => {
  const fixture=JSON.parse(readFileSync(new URL('../research/dev056-approximate-pilot.review.json',import.meta.url),'utf8'));
  const full=JSON.parse(readFileSync(new URL('../research/dev056-pilot-180d.review.json',import.meta.url),'utf8'));
  assert.equal(fixture.kind,'OFFLINE_APPROXIMATE_DISCOVERY_REVIEW_FIXTURE');
  assert.equal(fixture.runtime_activation,false);
  assert.equal(fixture.public_index_approved,false);
  assert.equal(fixture.not_for_import_or_publication,true);
  assert.equal(fixture.entries.length,21);
  assert.equal(new Set(fixture.entries.map(x=>editionKey({year:x.year,row:String(x.masterRow)}))).size,21);
  assert.deepEqual([fixture.coverage.approximate_reference_settlements,fixture.coverage.exact_offline_start_candidates,fixture.coverage.not_located],[20,1,38]);
  const events=full.eligible_editions.map(x=>({
    ...event(String(x.year),x.master_row),
    ...(x.naziv_prireditve.startsWith('SZTL 2026/2027')?{startRoles:['adult_start','youth_start']}:{})
  }));
  assert.equal(events.length,59);
  const unavailable=summarizeNearbyCoverage(events,fixture.entries);
  assert.deepEqual([unavailable.status,unavailable.locatedEditions,unavailable.coveragePercent],['partial',0,0]);
  assert.equal(filterNearbyRaces(events,fixture.entries,{latitude:46.2490358,longitude:15.164716},25).matches.length,0);
  // Deliberately isolated, non-persistent calculation: not an authorization to publish.
  const ephemeral=fixture.entries.map(x=>({...x,reviewStatus:'approved',approved_for_runtime:true}));
  const preview=summarizeNearbyCoverage(events,ephemeral);
  assert.deepEqual([preview.status,preview.totalEditions,preview.locatedEditions,preview.exactStartEditions,preview.approximateSettlementEditions,preview.coveragePercent],
    ['partial',59,21,1,20,35.6]);
  assert.equal(preview.unlocatedEditionKeys.length,38);
  const closeToZalec=filterNearbyRaces(events,ephemeral,{latitude:46.2490358,longitude:15.164716},10);
  const sztl=closeToZalec.matches.filter(x=>x.event.label==='2027!51'||x.event.label==='2027!52');
  assert.ok(sztl.length>=2);
  assert.ok(sztl.every(x=>x.approximate===true&&x.matchedRole===undefined));
  // The same settlement reference reused across editions must not conflate edition IDs.
  assert.equal(new Set(closeToZalec.matches.map(x=>editionKey(x.event))).size,closeToZalec.matches.length);
  assert.equal(closeToZalec.status,'partial');
});

test('documented place reference matches only when manually validated and edition-bound', () => {
  const race=event('2027',60);
  const place={
    year:'2027',masterRow:60,latitude:46.28490,longitude:14.49680,
    precision:'place-approximate',reviewStatus:'approved',approved_for_runtime:true,
    sourceKind:'documented-place-reference',referenceLocationVerified:true,
    sourceEditionYear:2027,sourceUrl:'https://www.hribi.net/izhodisce/spodnja_postaja_zicnice_na_krvavec/46.2849/14.4968',
    sourceCheckedOn:'2026-11-13',
    editionEvidenceUrl:'https://drive.google.com/file/d/1Ieuq4KUH2XX_syESuXEORzXyPqrkB8mD/view'
  };
  const origin={latitude:46.28490,longitude:14.49680};
  const match=filterNearbyRaces([race],[place],origin,10);
  assert.equal(match.status,'ready');
  assert.equal(match.matches[0].approximate,true);
  assert.equal(match.matches[0].distanceKm,0);
  const summary=summarizeNearbyCoverage([race],[place]);
  assert.deepEqual([summary.locatedEditions,summary.approximateSettlementEditions,summary.approximatePlaceEditions],[1,0,1]);
  for(const bad of [
    {...place,referenceLocationVerified:false},
    {...place,referenceLocationVerified:undefined},
    {...place,sourceEditionYear:2026},
    {...place,editionEvidenceUrl:undefined},
    {...place,editionEvidenceUrl:'http://untrusted.example/old-pdf'},
    {...place,sourceKind:'official-settlement'},
    {...place,reviewStatus:'review'},
    {...place,approved_for_runtime:false},
    {...place,precision:'start'}
  ]){
    assert.equal(filterNearbyRaces([race],[bad],origin,10).matches.length,0);
    assert.equal(summarizeNearbyCoverage([race],[bad]).locatedEditions,0);
  }
});

test('KZTL four place references cover 15 editions but remain review-only', () => {
  const kztl=JSON.parse(readFileSync(new URL('../research/dev056-kztl-place-pilot.review.json',import.meta.url),'utf8'));
  const prior=JSON.parse(readFileSync(new URL('../research/dev056-approximate-pilot.review.json',import.meta.url),'utf8'));
  const pop=JSON.parse(readFileSync(new URL('../research/dev056-pilot-180d.review.json',import.meta.url),'utf8'));
  assert.equal(kztl.kind,'OFFLINE_PLACE_REFERENCE_PILOT_KZTL_2026_27');
  assert.equal(kztl.status,'REVIEW_ONLY_NOT_FOR_IMPORT_OR_PUBLICATION');
  assert.equal(kztl.runtime_activation,false);
  assert.equal(kztl.public_index_approved,false);
  assert.equal(kztl.entries.length,15);
  assert.equal(kztl.venue_profiles.length,4);
  assert.deepEqual(kztl.venue_profiles.map(x=>x.edition_keys.length),[3,6,3,3]);
  assert.equal(kztl.coverage.extended_offline_candidates,36);
  assert.equal(kztl.coverage.remaining_without_reference,23);
  const keys=new Set(pop.eligible_editions.map(x=>x.edition_key));
  const seen=new Set(prior.entries.map(x=>editionKey({year:x.year,row:String(x.masterRow)})));
  for(const x of kztl.entries){
    const key=editionKey({year:x.year,row:String(x.masterRow)});
    assert.ok(keys.has(key));
    assert.equal(seen.has(key),false);
    seen.add(key);
    assert.equal(x.approved_for_runtime,false);
    assert.equal(x.reviewStatus,'review');
    assert.equal(x.precision,'place-approximate');
    assert.ok(x.sourceUrl.startsWith('https://'));
    assert.ok(x.editionEvidenceUrl.includes('1Ieuq4KUH2XX_syESuXEORzXyPqrkB8mD'));
  }
  assert.equal(seen.size,36);
  const allEvents=pop.eligible_editions.map(x=>event(String(x.year),x.master_row));
  const allReview=[...prior.entries,...kztl.entries];
  assert.equal(summarizeNearbyCoverage(allEvents,allReview).locatedEditions,0);
  const testCopy=allReview.map(x=>({...x,reviewStatus:'approved',approved_for_runtime:true}));
  const preview=summarizeNearbyCoverage(allEvents,testCopy);
  assert.deepEqual([preview.totalEditions,preview.locatedEditions,preview.exactStartEditions,
    preview.approximateSettlementEditions,preview.approximatePlaceEditions,preview.coveragePercent],
    [59,36,1,20,15,61]);
  assert.equal(preview.unlocatedEditionKeys.length,23);
  assert.equal(new Set(filterNearbyRaces(allEvents,testCopy,{latitude:46.28490,longitude:14.49680},25)
    .matches.map(x=>editionKey(x.event))).size,
    filterNearbyRaces(allEvents,testCopy,{latitude:46.28490,longitude:14.49680},25).matches.length);
});

test('multistart event can be discovered by one documented approximate place, never as exact start', () => {
  const race={...event('2027',61),startRoles:['adult_start','youth_start']};
  const place={
    year:'2027',masterRow:61,latitude:46.2348,longitude:14.3309,
    precision:'place-approximate',sourceKind:'documented-place-reference',
    reviewStatus:'approved',approved_for_runtime:true,referenceLocationVerified:true,sourceEditionYear:2027,
    sourceUrl:'https://www.hribi.net/izlet/ticnica_sveti_jost_nad_kranjem_pot_prijateljev_sv_josta_na_klopca/21/186/6742',
    editionEvidenceUrl:'https://drive.google.com/file/d/1Ieuq4KUH2XX_syESuXEORzXyPqrkB8mD/view',
    sourceCheckedOn:'2026-11-13'
  };
  const near=filterNearbyRaces([race],[place],{latitude:46.2348,longitude:14.3309},25);
  assert.equal(near.matches.length,1);
  assert.equal(near.matches[0].approximate,true);
  assert.equal(near.matches[0].matchedRole,undefined);
});

test('offline remaining 17 place references build 53 of 59 without enabling public coordinates', () => {
  const now=JSON.parse(readFileSync(new URL('../research/dev056-remaining-places.review.json',import.meta.url),'utf8'));
  const prior=JSON.parse(readFileSync(new URL('../research/dev056-approximate-pilot.review.json',import.meta.url),'utf8'));
  const kztl=JSON.parse(readFileSync(new URL('../research/dev056-kztl-place-pilot.review.json',import.meta.url),'utf8'));
  const snapshot=JSON.parse(readFileSync(new URL('../research/dev056-pilot-180d.review.json',import.meta.url),'utf8'));
  assert.equal(now.kind,'ADDITIONAL_OFFLINE_PLACE_REFERENCES_2026_2027');
  assert.equal(now.runtime_activation,false);
  assert.equal(now.public_index_approved,false);
  assert.equal(now.not_for_import_or_publication,true);
  assert.equal(now.entries.length,17);
  assert.equal(now.unlocated_review.length,6);
  const every=[...prior.entries,...kztl.entries,...now.entries];
  const ids=every.map(x=>editionKey({year:x.year,row:String(x.masterRow)}));
  assert.equal(new Set(ids).size,53);
  const eligible=new Set(snapshot.eligible_editions.map(x=>x.edition_key));
  assert.ok(ids.every(x=>eligible.has(x)));
  assert.equal(now.coverage.offline_candidate_total,53);
  assert.equal(now.coverage.offline_potential_coverage_percent,89.8);
  assert.ok(now.entries.every(x=>
    x.approved_for_runtime===false && x.reviewStatus==='review' &&
    x.precision==='place-approximate' && x.sourceKind==='documented-place-reference' &&
    x.referenceLocationVerified===true && x.sourceEditionYear===Number(x.year) &&
    x.sourceLicenseReviewRequired===true &&
    /^https:\/\//.test(x.editionEvidenceUrl) && /^https:\/\//.test(x.sourceUrl) &&
    x.qaIdentity.edition_key===editionKey({year:x.year,row:String(x.masterRow)}) &&
    isValidWgs84(x)
  ));
  const full=snapshot.eligible_editions.map(x=>event(String(x.year),x.master_row));
  const blocked=summarizeNearbyCoverage(full,every);
  assert.deepEqual([blocked.totalEditions,blocked.locatedEditions,blocked.coveragePercent],[59,0,0]);
  const temporary=every.map(x=>({...x,reviewStatus:'approved',approved_for_runtime:true}));
  const trial=summarizeNearbyCoverage(full,temporary);
  assert.deepEqual([trial.totalEditions,trial.locatedEditions,trial.exactStartEditions,trial.approximateSettlementEditions,
     trial.approximatePlaceEditions,trial.coveragePercent],
     [59,53,1,20,32,89.8]);
  assert.equal(trial.unlocatedEditionKeys.length,6);
  assert.deepEqual(new Set(now.unlocated_review.map(x=>x.edition_key)),new Set(trial.unlocatedEditionKeys));
});

test('same place reference across different 2026/27 races never confuses edition or start', () => {
  const doc=JSON.parse(readFileSync(new URL('../research/dev056-remaining-places.review.json',import.meta.url),'utf8'));
  const x=doc.entries.find(x=>x.qaIdentity.edition_key==='2026!263');
  const y=doc.entries.find(x=>x.qaIdentity.edition_key==='2027!2');
  assert.deepEqual([x.latitude,x.longitude],[y.latitude,y.longitude]);
  const results=filterNearbyRaces([event('2026',263),event('2027',2)],[x,y],{latitude:x.latitude,longitude:x.longitude},10);
  assert.equal(results.status,'partial');
  assert.equal(results.matches.length,0); // REVIEW-only fixtures must remain blocked
  const copy=[x,y].map(x=>({...x,reviewStatus:'approved',approved_for_runtime:true}));
  const offline=filterNearbyRaces([event('2026',263),event('2027',2)],copy,{latitude:x.latitude,longitude:x.longitude},10);
  assert.equal(offline.status,'ready');
  assert.equal(offline.matches.length,2);
  assert.ok(offline.matches.every(x=>x.approximate && x.matchedRole===undefined));
});

test('review-only 2027 Slivnica / Najnaj21 / Celje venue references retain source and year constraints', () => {
  const d=JSON.parse(readFileSync(new URL('../research/dev056-remaining-places.review.json',import.meta.url),'utf8'));
  const byKey=new Map(d.entries.map(x=>[x.qaIdentity.edition_key,x]));
  const slivnica=byKey.get('2027!34'),najnaj=byKey.get('2027!44'),celje=byKey.get('2027!32');
  assert.ok(slivnica.sourceUrl.includes('cerknica-hisa-cesta-4-maja-16'));
  assert.ok(slivnica.editionEvidenceUrl.includes('7-ur-slivnice-2027'));
  assert.ok(najnaj.sourceUrl.includes('mapcarta.com/W399465587'));
  assert.ok(najnaj.editionEvidenceUrl.includes('najnaj21.si'));
  assert.ok(celje.sourceUrl.includes('yoys.si'));
  assert.ok(celje.editionEvidenceUrl.includes('fatburn.si/prijave'));
  assert.ok([slivnica,najnaj,celje].every(x=>x.reviewStatus==='review'&&x.approved_for_runtime===false&&x.precision==='place-approximate'));
  const origin={latitude:46.13678,longitude:14.30301};
  assert.equal(filterNearbyRaces([event('2027',44)],[najnaj],origin,10).matches.length,0);
  assert.equal(filterNearbyRaces([event('2027',44)],[{...najnaj,reviewStatus:'approved',approved_for_runtime:true,sourceEditionYear:2026}],origin,10).matches.length,0);
  const unlocated=new Set(d.unlocated_review.map(x=>x.edition_key));
  assert.deepEqual(unlocated,new Set(['2027!3','2027!4','2027!5','2027!12','2027!8','2027!9']));
});

test('runtime inclusion needs explicit true approval, not an omitted or false flag', () => {
  const origin={latitude:46.1314,longitude:14.9965};
  const valid=checked('2027',51,origin.latitude,origin.longitude);
  assert.equal(filterNearbyRaces([event('2027',51)],[valid],origin,25).matches.length,1);
  for(const invalid of [
    {...valid,approved_for_runtime:undefined},
    {...valid,approved_for_runtime:false},
    {...valid,approved_for_runtime:null},
    {...valid,approved_for_runtime:'true'},
    {...valid,reviewStatus:'review'}
  ]){
    assert.equal(filterNearbyRaces([event('2027',51)],[invalid],origin,25).matches.length,0);
    assert.equal(summarizeNearbyCoverage([event('2027',51)],[invalid]).locatedEditions,0);
  }
});

test('SL/EN copy indicates approximate distances, missing editions and 10 km uncertainty', () => {
  const origin={latitude:46.1314,longitude:14.9965};
  const summary=summarizeNearbyCoverage([event('2027',51),event('2027',52)],[
    checked('2027',51,origin.latitude,origin.longitude)
  ]);
  const sl=nearbyDiscoveryCopy('sl',summary,10);
  const en=nearbyDiscoveryCopy('en',summary,10);
  assert.equal(sl.distanceBasis,'Zračna razdalja');
  assert.equal(en.distanceBasis,'Straight-line distance');
  assert.match(sl.approximateNotice,/Približna lokacija/);
  assert.match(en.approximateNotice,/Approximate settlement/);
  assert.match(sl.coverageNotice,/1 od 2/);
  assert.match(en.coverageNotice,/1 of 2/);
  assert.match(sl.radiusNotice,/radiju 10 km/);
  assert.match(en.radiusNotice,/10 km radius/);
  assert.equal(nearbyDiscoveryCopy('sl',summary,25).radiusNotice,null);
  const exact=summarizeNearbyCoverage([event('2027',51)],[checked('2027',51,origin.latitude,origin.longitude,'start')]);
  assert.equal(nearbyDiscoveryCopy('sl',exact,10).approximateNotice,null);
  assert.equal(nearbyDiscoveryCopy('en',exact,10).coverageNotice,null);
});

test('license audit requires attribution and leaves every candidate non-runtime', () => {
  const a=JSON.parse(readFileSync(new URL('../research/dev056-geodata-license.review.json',import.meta.url),'utf8'));
  assert.equal(a.kind,'NON_RUNTIME_PROVENANCE_AND_LICENSE_AUDIT');
  assert.equal(a.public_index_approved,false);
  assert.equal(a.activation_forbidden,true);
  assert.equal(a.counts.offline_candidate_editions,53);
  assert.equal(a.counts.sample_eligible_editions,59);
  assert.equal(a.counts.gurs_cc_by_4_0_source_editions,20);
  assert.equal(a.counts.geonames_cc_attribution_source_editions,2);
  assert.equal(a.counts.rights_unknown_or_secondary_source_editions,31);
  assert.equal(a.counts.approved_runtime,0);
  assert.equal(a.counts.rights_fully_cleared_for_runtime,0);
  const sum=a.domains.reduce((n,x)=>n+x.edition_count,0);
  assert.equal(sum,53);
  const sets=a.domains.flatMap(x=>x.edition_keys);
  assert.equal(new Set(sets).size,53);
  assert.ok(a.domains.every(x=>x.edition_count===x.edition_keys.length));
  const gurs=a.domains.find(x=>x.source_domain==='ipi.eprostor.gov.si');
  assert.equal(gurs.rights_status,'OPEN_LICENSE_IDENTIFIED_GURS');
  assert.ok(gurs.rights_evidence.startsWith('https://www.e-prostor.gov.si/'));
  assert.ok(a.verified_license_notes.some(x=>x.publisher==='GURS'&&x.conclusion.includes('date/state')));
  const files=a.source_files.map(x=>JSON.parse(readFileSync(new URL('../'+x,import.meta.url),'utf8')));
  const records=files.flatMap(x=>x.entries);
  assert.equal(records.length,53);
  assert.ok(records.every(x=>x.reviewStatus==='review'&&x.approved_for_runtime===false));
  const events=records.map(x=>event(x.year,x.masterRow));
  assert.equal(summarizeNearbyCoverage(events,records).locatedEditions,0);
});

test('adapter combines existing Finder filters with geographic proximity, keeping selected objects', () => {
  const event2027a={...event('2027',51),familyFriendly:true,fee:12};
  const event2027b={...event('2027',52),familyFriendly:false,fee:35};
  const event2027c={...event('2027',53),familyFriendly:true,fee:0};
  const full=Object.freeze([event2027a,event2027b,event2027c]);
  const selected=Object.freeze([{...event2027a,extraLabel:'enriched-after-filter'},event2027c]);
  const locations=Object.freeze([
    Object.freeze(checked('2027',51,46.13,14.99)),
    Object.freeze(checked('2027',52,46.14,15.01)),
    Object.freeze(checked('2027',53,46.15,15.06))
  ]);
  const result=prepareNearbyFinderView(full,selected,locations,{latitude:46.13,longitude:14.99},25,'sl');
  assert.equal(result.status,'ready');
  assert.deepEqual(result.matches.map(x=>x.event.row),['51','53']);
  assert.equal(result.matches[0].event.extraLabel,'enriched-after-filter');
  assert.equal(result.matches[0].approximate,true);
  assert.equal(result.coverage.totalEditions,3);
  assert.equal(result.coverage.locatedEditions,3);
  assert.equal(result.copy.distanceBasis,'Zračna razdalja');
  assert.deepEqual(full.map(x=>x.row),['51','52','53']);
  assert.deepEqual(selected.map(x=>x.row),['51','53']);
});

test('adapter never claims zero races nearby when full current-year coverage is partial', () => {
  const full=[event('2027',51),event('2027',52),event('2027',53)];
  const onlyDistant=checked('2027',51,45.81,13.82);
  const result=prepareNearbyFinderView(full,[full[0],full[2]],[onlyDistant],
    {latitude:46.13,longitude:14.99},10,'en');
  assert.equal(result.status,'partial');
  assert.equal(result.matches.length,0);
  assert.deepEqual(result.coverage.unlocatedEditionKeys,['2027!52','2027!53']);
  assert.equal(result.coverage.totalEditions,3);
  assert.match(result.copy.coverageNotice,/2 of 3/);
  assert.match(result.copy.radiusNotice,/10 km/);
  // A user-selected subset cannot hide missing-location risk in other public races.
  const subset=prepareNearbyFinderView(full,[],[onlyDistant],
    {latitude:46.13,longitude:14.99},25,'sl');
  assert.equal(subset.status,'partial');
  assert.equal(subset.matches.length,0);
  assert.match(subset.copy.coverageNotice,/2 od 3/);
});

test('adapter rejects stale, duplicate, wrong-year selected events and invalid location indexes', () => {
  const full=[event('2026',51),event('2027',51)];
  const a=checked('2026',51,46.1,14.5);
  const b=checked('2027',51,46.2,14.4);
  const at={latitude:46.2,longitude:14.4};
  const valid=prepareNearbyFinderView(full,[full[1]],[a,b],at,25,'en');
  assert.equal(valid.status,'ready');
  assert.deepEqual(valid.matches.map(x=>editionKey(x.event)),['2027!51']);
  for(const subset of [[event('2028',51)],[full[1],full[1]],[event('2027',0)]]) {
    const result=prepareNearbyFinderView(full,subset,[a,b],at,25,'sl');
    assert.equal(result.status,'unavailable');
    assert.equal(result.reason,'invalid-subset');
    assert.equal(result.matches.length,0);
  }
  assert.equal(prepareNearbyFinderView(full,[full[1]],[a,b],{latitude:91,longitude:14.4},25,'en').status,'unavailable');
  assert.equal(prepareNearbyFinderView(full,[full[1]],[a,b],at,11,'en').reason,'invalid-origin-or-radius');
  assert.equal(prepareNearbyFinderView(full,[full[1]],[a,a],at,25,'en').reason,'invalid-or-duplicate-index');
  // Even a reviewed location is not useful without explicit runtime activation.
  assert.equal(prepareNearbyFinderView(full,[full[1]],[a,{...b,approved_for_runtime:false}],at,25,'en').status,'partial');
});

test('adapter is fail-closed with live-shaped public year/row event fields', () => {
  const fromApi=[
    {year:'2027',row:'9',title:'Wings for Life World Run Slovenia 2027',place:'Ljubljana'},
    {year:'2027',row:'34',title:'7 ur Slivnice 2027',place:'Slivnica (Cerknica)'}
  ];
  const result=prepareNearbyFinderView(fromApi,fromApi,[],{latitude:46.13,longitude:14.99},50,'sl');
  assert.equal(result.status,'partial');
  assert.equal(result.matches.length,0);
  assert.deepEqual(result.coverage.unlocatedEditionKeys,['2027!9','2027!34']);
  assert.match(result.copy.coverageNotice,/2 od 2/);
});

test('nearby hidden gate rejects both disabled and unapproved states without DOM access', () => {
  const forbiddenRoot = new Proxy({}, { get() { throw new Error('DOM must not be accessed'); } });
  assert.equal(mountNearbyFinderUi({
    enabled:false, locale:'sl', locations:[checked('2027',51,46.2,14.5)],
    root:forbiddenRoot, onChange:()=>{ throw new Error('must not notify'); }
  }),null);
  assert.equal(mountNearbyFinderUi({
    enabled:true, locale:'en', locations:[{...checked('2027',51,46.2,14.5),approved_for_runtime:false}],
    root:forbiddenRoot, onChange:()=>{ throw new Error('must not notify'); }
  }),null);
  assert.equal(mountNearbyFinderUi({
    enabled:true, locale:'en', locations:[],
    root:forbiddenRoot, onChange:()=>{ throw new Error('must not notify'); }
  }),null);
});

test('manual origin parser accepts decimal commas but rejects empty and invalid coordinates', () => {
  assert.deepEqual(parseNearbyOrigin('46,1314','14,9965'),{latitude:46.1314,longitude:14.9965});
  assert.deepEqual(parseNearbyOrigin(' +46.25 ',' -15.8 '),{latitude:46.25,longitude:-15.8});
  for(const pair of [['',''],[' ','14'],['abc','14'],['91','14'],['46','181'],['Infinity','0'],['46;3','14'],['46.2.4','14.5']]) {
    assert.equal(parseNearbyOrigin(pair[0],pair[1]),null);
  }
  assert.equal(parseNearbyRadius('10'),10);
  assert.equal(parseNearbyRadius('25'),25);
  assert.equal(parseNearbyRadius('50'),50);
  assert.equal(parseNearbyRadius('100'),100);
  for(const radius of ['0','5','11','101','25.0','',' 25','Infinity']) assert.equal(parseNearbyRadius(radius),null);
});

test('nearby origin catalog fails closed for unreviewed or invalid coordinate sources', () => {
  const origin = {
    id:'synthetic-test-origin', labelSl:'Testno izhodišče', labelEn:'Synthetic test origin',
    latitude:46.34, longitude:15.164716, sourceUrl:'https://example.org/dev056-synthetic-origin',
    sourceCheckedOn:'2026-11-13', reviewStatus:'approved', approved_for_runtime:true
  };
  assert.equal(isApprovedNearbyOrigin(origin), true);
  for (const bad of [
    { ...origin, reviewStatus:'review' }, { ...origin, approved_for_runtime:false },
    { ...origin, latitude:91 }, { ...origin, id:'<script>' },
    { ...origin, labelSl:' ' }, { ...origin, sourceUrl:'http://example.org/a' },
    { ...origin, sourceCheckedOn:'2026-02-30' }
  ]) assert.equal(isApprovedNearbyOrigin(bad),false);
});

test('nearby UI rejects a false gate or an unverified location BEFORE accessing the document', () => {
  const location=checked('2027',51,46.1314,14.9965);
  const mustNotTouch={querySelector:()=>{throw Error('closed gate must never read DOM');}};
  const mounted=(locations,enabled)=>mountNearbyFinderUi({
    enabled,locale:'sl',locations,root:mustNotTouch,onChange:()=>{throw Error('closed gate must not fire');}
  });
  assert.equal(mounted([location],false),null);
  assert.equal(mounted([],true),null);
  assert.equal(mounted([{...location,approved_for_runtime:false}],true),null);
  assert.equal(mounted([{...location,reviewStatus:'review'}],true),null);
  assert.equal(mounted([{...location,sourceUrl:'https://invalid.example.net/made-up'}],true),null);
  assert.equal(mounted([{...location,sourceSnapshotOn:'not-a-date'}],true),null);
});

test('geolocation callback cannot override manually edited coordinates or a cleared selection', () => {
  const listeners=(defaults={})=>({
    value:'',disabled:true,textContent:'',hidden:true,
    ...defaults,
    callbacks:{},
    addEventListener(type,fn){this.callbacks[type]=fn;},
    fire(type){assert.ok(this.callbacks[type],type);this.callbacks[type]();}
  });
  const controls={
    '[data-nearby-fields]':listeners(),
    '[data-nearby-latitude]':listeners(),
    '[data-nearby-longitude]':listeners(),
    '[data-nearby-radius]':listeners({value:'25'}),
    '[data-nearby-geolocate]':listeners(),
    '[data-nearby-apply]':listeners(),
    '[data-nearby-clear]':listeners(),
    '[data-nearby-status]':listeners(),
    '[data-nearby-origin-summary]':listeners()
  };
  const panel={hidden:true,querySelector:(selector)=>controls[selector]||null};
  const requested=[];
  const geolocation={
    getCurrentPosition(success,failure,settings){requested.push({success,failure,settings});}
  };
  const root={querySelector:(selector)=>selector==='[data-nearby-panel]'?panel:null,
    defaultView:{navigator:{geolocation}}};
  const changes=[];
  const mounted=mountNearbyFinderUi({
    enabled:true,locale:'sl',
    locations:[checked('2027',51,46.1314,14.9965)],
    root,onChange:(value)=>changes.push(value)
  });
  assert.ok(mounted);
  assert.equal(panel.hidden,false);
  assert.equal(controls['[data-nearby-fields]'].disabled,false);
  assert.equal(requested.length,0); // permission never requested on mount
  const lat=controls['[data-nearby-latitude]'];
  const lon=controls['[data-nearby-longitude]'];
  const radius=controls['[data-nearby-radius]'];
  const geo=controls['[data-nearby-geolocate]'];
  geo.fire('click');
  assert.equal(requested.length,1);
  assert.equal(requested[0].settings.enableHighAccuracy,false);
  // After the browser permission prompt, a person types a preferred origin.
  lat.value='46,1314';
  lon.value='14,9965';
  lat.fire('input');
  lon.fire('input');
  requested[0].success({coords:{latitude:47.2,longitude:15.2}});
  assert.equal(lat.value,'46,1314');
  assert.equal(changes.length,0);
  controls['[data-nearby-apply]'].fire('click');
  assert.match(controls['[data-nearby-origin-summary]'].textContent,/Aktivno izhodišče: Ročne koordinate/);
  assert.deepEqual(changes.at(-1),{origin:{latitude:46.1314,longitude:14.9965},radiusKm:25});
  radius.value='10';
  radius.fire('change');
  assert.equal(changes.at(-1).radiusKm,10);
  // Editing coordinates, then applying an invalid origin, must clear OLD results.
  lat.value='not-valid';
  lat.fire('input');
  assert.equal(changes.at(-1),null); // clear stale valid-origin results immediately
  assert.match(controls['[data-nearby-origin-summary]'].textContent,/za posodobitev/);
  controls['[data-nearby-apply]'].fire('click');
  assert.equal(changes.at(-1),null);
  assert.equal(lat.value,'not-valid');
  assert.match(controls['[data-nearby-status]'].textContent,/Vnesite veljavno/);
  // A radius change must not revive the stale origin either.
  radius.value='50';
  radius.fire('change');
  assert.equal(changes.at(-1),null);
  assert.equal(lat.value,'not-valid');
  lat.value='46,1314';
  lat.fire('input');
  controls['[data-nearby-apply]'].fire('click');
  assert.deepEqual(changes.at(-1),{origin:{latitude:46.1314,longitude:14.9965},radiusKm:50});
  // Another permission request must never resurrect a cleared selection.
  geo.fire('click');
  assert.equal(requested.length,2);
  mounted.clear();
  assert.equal(lat.value,'');
  assert.equal(lon.value,'');
  assert.equal(radius.value,'25');
  assert.equal(changes.at(-1),null);
  requested[1].success({coords:{latitude:47,longitude:15}});
  assert.equal(changes.at(-1),null);
  assert.equal(lat.value,'');
  // Fresh permission request is honored only on the live sequence.
  geo.fire('click');
  requested[2].success({coords:{latitude:46.25,longitude:14.55}});
  assert.match(controls['[data-nearby-origin-summary]'].textContent,/Aktivno izhodišče: Lokacija naprave/);
  assert.deepEqual(changes.at(-1),{origin:{latitude:46.25,longitude:14.55},radiusKm:25});
  assert.equal(requested.length,3);
});

test('offline GURS-only 20-edition smoke test on 12 unique official features', () => {
  const doc=JSON.parse(readFileSync(new URL('../research/dev056-geodata-license.review.json',import.meta.url),'utf8'));
  const existing=JSON.parse(readFileSync(new URL('../research/dev056-approximate-pilot.review.json',import.meta.url),'utf8'));
  const original=JSON.parse(readFileSync(new URL('../research/dev056-location-candidates.review.json',import.meta.url),'utf8'));
  const population=JSON.parse(readFileSync(new URL('../research/dev056-pilot-180d.review.json',import.meta.url),'utf8'));
  const pilot=doc.offline_gurs_only_pilot;
  assert.equal(pilot.status,'FIXED_ORIGIN_REVIEW_ONLY_TEST_NO_PUBLIC_APPROVAL');
  assert.equal(doc.activation_forbidden,true);
  assert.equal(doc.public_index_approved,false);
  assert.equal(pilot.population.eligible_editions,59);
  assert.equal(pilot.population.official_gurs_candidate_editions,20);
  assert.equal(pilot.population.distinct_gurs_naselja_feature_ids,12);
  assert.equal(pilot.population.unlocated_or_not_included_in_gurs_only_pilot,39);
  assert.equal(pilot.population.approved_public_editions,0);
  const gurs=existing.entries.filter(e=>e.sourceKind==='official-settlement');
  assert.equal(gurs.length,20);
  assert.ok(gurs.every(e=>e.precision==='settlement-approximate' &&
    e.reviewStatus==='review' && e.approved_for_runtime===false &&
    e.sourceFeatureVerified===true && e.sourceSnapshotOn===undefined));
  const featureIds=new Set(gurs.map(e=>e.sourceUrl.match(/\/items\/(\d+)\?f=json$/)?.[1]));
  assert.equal(featureIds.has(undefined),false);
  assert.equal(featureIds.size,12);
  for(const item of gurs){
    assert.ok(original.entries.some(e=>e.canonical_gurs.official_feature_url===item.sourceUrl));
  }
  assert.equal(gurs.filter(e=>e.sourceUrl.includes('/110300000101473100?')).length,9);
  const full=population.eligible_editions.map(e=>event(String(e.year),e.master_row));
  assert.deepEqual([summarizeNearbyCoverage(full,gurs).status,summarizeNearbyCoverage(full,gurs).locatedEditions],['partial',0]);
  // Only in this synchronous test: never ship these ephemeral test approvals as an index.
  const approvedForPrivateSimulation=gurs.map(e=>({...e,reviewStatus:'approved',approved_for_runtime:true}));
  const coverage=summarizeNearbyCoverage(full,approvedForPrivateSimulation);
  assert.deepEqual([coverage.status,coverage.totalEditions,coverage.locatedEditions,coverage.exactStartEditions,
    coverage.approximateSettlementEditions,coverage.approximatePlaceEditions,
    coverage.unlocatedEditionKeys.length,coverage.coveragePercent],
    ['partial',59,20,0,20,0,39,33.9]);
  const expected=[[1,10,13,17],[9,11,13,15],[0,1,2,17]];
  assert.equal(pilot.origins.length,3);
  pilot.origins.forEach((origin,i)=>{
    assert.deepEqual(origin.radius_results.map(x=>x.matched_candidate_editions),expected[i]);
    [10,25,50,100].forEach((rad,j)=>{
      const result=filterNearbyRaces(full,approvedForPrivateSimulation,origin.origin,rad);
      assert.equal(result.status,'partial');
      assert.equal(result.unlocatedEditionKeys.length,39);
      assert.equal(result.matches.length,expected[i][j]);
      assert.ok(result.matches.every(x=>x.approximate===true&&x.matchedRole===undefined));
      assert.ok(result.matches.every(x=>x.distanceKm<=rad));
      const distances=result.matches.map(x=>x.distanceKm);
      assert.deepEqual(distances,[...distances].sort((a,b)=>a-b));
    });
  });
  const atKranj=filterNearbyRaces(full,approvedForPrivateSimulation,pilot.origins[2].origin,10);
  assert.equal(atKranj.matches.length,0);
  assert.equal(atKranj.status,'partial'); // Never claim there are no nearby races.
  const note=nearbyDiscoveryCopy('sl',coverage,10);
  assert.match(note.coverageNotice,/39 od 59/);
  assert.match(note.radiusNotice,/radiju 10 km/);
});

test('dated GURS source rejects arbitrary HTTPS host even when approval and snapshot are present', () => {
  const origin={latitude:46.2490358,longitude:15.164716};
  const valid=checked('2027',51,origin.latitude,origin.longitude);
  const suspicious=[
    'https://example.org/official',
    'https://ipi.eprostor.gov.si.evil.example.org/wfs-si-gurs-rpe/ogc/features/collections/SI.GURS.RPE%3ANASELJA/items/110300000101473100?f=json',
    'https://ipi.eprostor.gov.si/wfs-si-gurs-rpe/ogc/features/collections/SI.GURS.RPE%3ANASELJA/items/not-valid?f=json'
  ];
  assert.equal(filterNearbyRaces([event('2027',51)],[valid],origin,10).matches.length,1);
  for(const sourceUrl of suspicious){
    const falseClaim={...valid,sourceUrl,sourceSnapshotOn:'2026-10-01',reviewStatus:'approved',approved_for_runtime:true};
    assert.equal(filterNearbyRaces([event('2027',51)],[falseClaim],origin,10).matches.length,0);
    assert.equal(summarizeNearbyCoverage([event('2027',51)],[falseClaim]).locatedEditions,0);
  }
});

test('2026-11-13 GURS 2027 pilot triage stays strictly review-only', () => {
  const a=JSON.parse(readFileSync(new URL('../research/dev056-geodata-license.review.json',import.meta.url),'utf8'));
  const r=JSON.parse(readFileSync(new URL('../research/dev056-approximate-pilot.review.json',import.meta.url),'utf8'));
  const q=a.pilot_launch_readiness_2026_11_13;
  assert.equal(q.decision,'NO_GO_PRODUCTION; CANDIDATE_PRIORITY_REVIEW_ONLY');
  assert.equal(a.public_index_approved,false);
  assert.equal(a.activation_forbidden,true);
  assert.equal(q.counts.publicly_approved,0);
  assert.equal(q.counts.offline_gurs_editions,20);
  assert.equal(q.counts.candidate_2027_city_reference_review_only,4);
  assert.equal(q.counts.ambiguous_2027_homonym,1);
  assert.equal(q.counts.multistart_repeated_zalec,9);
  assert.equal(q.counts.soon_2026,6);
  const groups=q.groups;
  const actual=groups.flatMap(g=>g.edition_keys);
  const expected=r.entries.filter(e=>e.sourceKind==='official-settlement')
    .map(e=>e.year+'!'+e.masterRow);
  assert.equal(new Set(actual).size,20);
  assert.deepEqual(actual.slice().sort(),expected.slice().sort());
  assert.ok(groups.every(g=>g.edition_keys.length&&g.reason&&g.next));
  const zalec=groups.find(g=>g.decision==='MULTISTART_DO_NOT_CLAIM_NASELJE_AS_START');
  assert.equal(zalec.edition_keys.length,9);
  assert.ok(zalec.edition_keys.every(key=>{
    const source=r.entries.find(e=>e.year+'!'+e.masterRow===key);
    return source?.sourceUrl.includes('/110300000101473100?') &&
      source.reviewStatus==='review' && source.approved_for_runtime===false;
  }));
  assert.ok(r.entries.every(e=>e.reviewStatus==='review'&&e.approved_for_runtime===false));
});
