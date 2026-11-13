import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  NEARBY_RADII_KM, airDistanceKm, editionKey, filterNearbyRaces, isValidWgs84, summarizeNearbyCoverage
} from '../.cache/dist-test/utils-nearby-races.js';

const checked = (year, row, latitude, longitude, precision = 'settlement-approximate') => ({
  year, masterRow: row, latitude, longitude, precision,
  reviewStatus: 'approved', sourceUrl: 'https://example.org/official',
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

test('settlement centroid cannot be approved without independently verified dataset snapshot', () => {
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
  const verifiedOffline=[{...start,approved_for_runtime:undefined}];
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
