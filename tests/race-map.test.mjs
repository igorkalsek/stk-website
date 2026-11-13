import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildNearbyMapLink } from '../.cache/dist-test/utils-nearby-index.js';
import { NEARBY_EDITION_LOCATIONS as index } from '../.cache/dist-test/finder/nearby-production-index.js';
const events = JSON.parse(readFileSync(new URL('../docs/evidence/dev056-release/public-events.json', import.meta.url))).events;
const event = row => events.find(e => e.year === '2026' && e.row === row);
const query = link => new URL(link.url).searchParams.get('query');

for (const locale of ['sl', 'en']) {
  test(`profile map ${locale}: approved edition start, approximate reference and fallback`, () => {
    for (const [row, precision] of [['266', 'start'], ['260', 'settlement-approximate']]) {
      const race = event(row);
      const point = index.find(x => x.year === race.year && x.masterRow === Number(row));
      const link = buildNearbyMapLink(race, index, locale);
      assert.equal(query(link), `${point.latitude},${point.longitude}`);
      assert.equal(link.label, precision === 'start' ? (locale === 'sl' ? 'Potrjen štart' : 'Verified start')
        : (locale === 'sl' ? 'Približna lokacija' : 'Approximate location'));
      assert.equal(link.notice === null, precision === 'start');
      assert.equal(new URL(link.url).origin, 'https://www.google.com');
    }
    const fallback = buildNearbyMapLink(event('263'), index, locale);
    assert.equal(query(fallback), [event('263').place, event('263').region].join(', '));
    assert.equal(fallback.label, locale === 'sl' ? 'Iskanje kraja' : 'Search for place');
    assert.equal(fallback.notice, null);
  });
}

test('map rejects stale year, row, date, title, place or region and missing live identity', () => {
  const original = event('266');
  for (const change of [{year:'2027'}, {row:'999'}, {date:'2026-11-28'},
    {naziv_prireditve:'Drug tek'}, {place:'Drug kraj'}, {region:'Goriška'},
    {date:undefined}, {naziv_prireditve:undefined}]) {
    const race = {...original, ...change};
    assert.equal(query(buildNearbyMapLink(race, index, 'sl')), [race.place, race.region].filter(Boolean).join(', '));
  }
});

test('map fails closed on invalid approval, provenance, coordinates or duplicate index', () => {
  const race = event('266');
  const point = index.find(x => x.year === race.year && x.masterRow === Number(race.row));
  for (const entries of [[point,point], [{...point,approved_for_runtime:false}],
    [{...point,sourceEditionYear:2027}], [{...point,latitude:91}], [{...point,sourceUrl:'javascript:alert(1)'}]]) {
    assert.equal(query(buildNearbyMapLink(race, entries, 'sl')), `${race.place}, ${race.region}`);
  }
  assert.equal(buildNearbyMapLink({...race, place:'',region:''}, [], 'sl').url, '');
});

test('multi-start approximation stays approximate and multiple approved starts never invent a shared map pin', () => {
  const race = {...event('266'), startRoles:['adult','youth']};
  const point = index.find(x => x.year === race.year && x.masterRow === Number(race.row));
  const roles = race.startRoles.map((startRole, i) => ({...point,startRole,latitude:point.latitude + i / 100}));
  assert.equal(query(buildNearbyMapLink(race, roles, 'sl')), `${race.place}, ${race.region}`);
  const approximate = {...event('260'), startRoles:['adult','youth']};
  assert.equal(buildNearbyMapLink(approximate, index, 'sl').label, 'Približna lokacija');
});
