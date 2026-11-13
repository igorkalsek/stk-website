import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { NEARBY_PLACES, NEARBY_EDITION_BINDINGS } from '../.cache/dist-test/data/nearby-geography.js';
import { NEARBY_EDITION_LOCATIONS, NEARBY_ORIGINS } from '../.cache/dist-test/finder/nearby-production-index.js';
import { buildNearbyLocationIndex } from '../.cache/dist-test/utils-nearby-index.js';
import { summarizeNearbyCoverage, filterNearbyRaces, airDistanceKm, isApprovedLocation } from '../.cache/dist-test/utils-nearby-races.js';
const read = name => JSON.parse(readFileSync(new URL(`../docs/evidence/dev056-release/${name}.json`, import.meta.url)));
const events = read('public-events').events;
const sources = read('source-verification');

test('release index covers the actual public population with independently evidenced CC0 references', () => {
  assert.equal(NEARBY_PLACES.length, 54);
  assert.equal(NEARBY_ORIGINS.length, 54);
  const coverage = summarizeNearbyCoverage(events, NEARBY_EDITION_LOCATIONS);
  assert.equal(coverage.totalEditions, 93);
  assert.equal(coverage.locatedEditions, 86);
  assert.equal(coverage.exactStartEditions, 1);
  assert.equal(coverage.approximateSettlementEditions + coverage.approximatePlaceEditions, 85);
  assert.equal(coverage.coveragePercent, 92.5);
  assert.deepEqual(coverage, read('coverage').total);
  assert.deepEqual(coverage.unlocatedEditionKeys.slice().sort(), sources.excluded.map(x=>`${x.year}!${x.row}`).sort());
  for (const place of NEARBY_PLACES) {
    const source = sources.places.find(x=>x.id === place.id);
    assert.ok(source.countryIds.includes('Q215'));
    assert.equal(source.license, 'CC0-1.0');
    assert.ok(source.revisionUrl.endsWith(`oldid=${place.sourceRevision}`));
    const claim = source.coordinateClaims.find(x=>x.id === place.sourceClaim);
    assert.ok(claim);
    assert.equal(claim.latitude, place.latitude);
    assert.equal(claim.longitude, place.longitude);
    assert.notEqual(place.precision, 'start');
  }
  assert.ok(NEARBY_EDITION_LOCATIONS.every(isApprovedLocation));
});

test('edition date/name/place/region drift and reused rows never retain old locations', () => {
  const event = events.find(e=>e.year === '2027' && e.row === '51');
  assert.equal(summarizeNearbyCoverage([event], NEARBY_EDITION_LOCATIONS).locatedEditions, 1);
  for (const changed of [
    {...event, date:'2027-01-04'}, {...event, naziv_prireditve:'Drug tek'},
    {...event, place:'Druga lokacija'}, {...event, region:'Goriška'},
    {...event, year:'2028'}, {...event, row:'900'}, {...event, date:undefined}
  ]) assert.equal(summarizeNearbyCoverage([changed], NEARBY_EDITION_LOCATIONS).locatedEditions, 0);
});

test('new edition in a reviewed place reuses coordinates with a fresh identity binding', () => {
  const original = NEARBY_EDITION_BINDINGS.find(b=>b.year === '2027' && b.masterRow === 51);
  const next = {...original, masterRow:900, expectedTitle:'Nov tek', expectedDate:'2027-12-01'};
  const fresh = {year:'2027', row:'900', date:next.expectedDate, naziv_prireditve:next.expectedTitle, place:next.expectedPlace, region:next.expectedRegion};
  assert.equal(summarizeNearbyCoverage([fresh], NEARBY_EDITION_LOCATIONS).locatedEditions, 0);
  const index = buildNearbyLocationIndex(NEARBY_PLACES, [...NEARBY_EDITION_BINDINGS, next]);
  const added = index.find(x=>x.masterRow === 900);
  const samePlace = index.find(x=>x.year === '2027' && x.masterRow === 51);
  assert.equal(added.latitude, samePlace.latitude);
  assert.equal(added.longitude, samePlace.longitude);
  assert.equal(summarizeNearbyCoverage([fresh], index).locatedEditions, 1);
  assert.deepEqual(buildNearbyLocationIndex(NEARBY_PLACES, [{...next, placeId:'unknown'}]), []);
  assert.deepEqual(buildNearbyLocationIndex([...NEARBY_PLACES, NEARBY_PLACES[0]], [next]), []);
  assert.deepEqual(buildNearbyLocationIndex(NEARBY_PLACES, [next, next]), []);
});

test('ambiguous places stay missing; leagues use a shared approximation without inventing start roles', () => {
  for (const item of sources.excluded) {
    const event = events.find(e=>e.year === item.year && e.row === item.row);
    assert.equal(summarizeNearbyCoverage([event], NEARBY_EDITION_LOCATIONS).locatedEditions, 0);
  }
  const league = {...events.find(e=>e.year === '2027' && e.row === '51'), startRoles:['adult_start','youth_start']};
  const place = NEARBY_PLACES.find(p=>p.id === 'Q631387');
  const result = filterNearbyRaces([league], NEARBY_EDITION_LOCATIONS, place, 10);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].approximate, true);
  assert.equal(result.matches[0].referenceLabel, 'Žalec');
  assert.equal(result.matches[0].matchedRole, undefined);
  for (const row of [60, 65]) {
    const krvavec = NEARBY_EDITION_LOCATIONS.find(e=>e.year === '2027' && e.masterRow === row);
    assert.equal(krvavec.label, 'Grad (Cerklje na Gorenjskem)');
    assert.notEqual(krvavec.precision, 'start');
  }
});

test('radius boundary is inclusive before display rounding, for every supported radius', () => {
  const event = events.find(e=>e.year === '2027' && e.row === '51');
  const location = NEARBY_EDITION_LOCATIONS.find(x=>x.year === '2027' && x.masterRow === 51);
  for (const radius of [10,25,50,100]) {
    const delta = radius / 6371.0088 * 180 / Math.PI;
    for (const [offset, inside] of [[-1e-7,true],[0,true],[1e-7,false]]) {
      const origin = {latitude:location.latitude + delta + offset, longitude:location.longitude};
      assert.ok(Math.abs(airDistanceKm(origin, location) - radius) < 0.001);
      assert.equal(filterNearbyRaces([event], NEARBY_EDITION_LOCATIONS, origin, radius).matches.length, inside ? 1 : 0);
    }
  }
});

test('edition-specific start upgrade overrides only one binding and rejects malformed CC0 metadata', () => {
  const b = NEARBY_EDITION_BINDINGS.find(b=>b.year === '2027' && b.masterRow === 51);
  const updated = {...b,start:{latitude:46.25,longitude:15.16,sourceUrl:'https://organizer.example/2027',sourceCheckedOn:'2026-11-13'}};
  const index = buildNearbyLocationIndex(NEARBY_PLACES, [updated]);
  assert.equal(index[0].precision,'start');
  assert.equal(index[0].sourceEditionYear,2027);
  const approx = NEARBY_EDITION_LOCATIONS.find(x=>x.sourceKind === 'wikidata-place');
  for (const changed of [{...approx,sourceUrl:'https://other.example/Q437'}, {...approx,license:undefined}, {...approx,sourceRevision:0}, {...approx,sourceClaim:'Q1$wrong'}, {...approx,expectedPlace:undefined}]) assert.equal(isApprovedLocation(changed),false);
});
