import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { comparePlanningEvents, comparisonRange, formatComparisonRange, matchPlanningLinks, planningLinkKey } from '../.cache/dist-test/utils-planning-comparison.js';
import { parsePlanningPayload } from '../.cache/dist-test/utils-planning-2027.js';

// Public Worker snapshot captured 18 October 2026; no live data writes.
const events = parsePlanningPayload(JSON.parse(readFileSync('tests/fixtures/planning-2027.json', 'utf8'))).data;
const filters = { region: '', surface: '' };
const compare = (date, mode = 'weekend', selected = filters) => comparePlanningEvents(events, date, mode, selected);
const names = group => group.map(event => event.naziv_prireditve);
const row = overrides => ({ naziv_prireditve: 'TEST ONLY', datum: '', predvideno_od: '', predvideno_do: '', kraj: 'Kraj', regija: 'Gorenjska', tip_podlage: 'trail', status: 'pričakovano', ...overrides });

test('A: four confirmed May 15 events; nearby dates use both weekend boundaries without duplicates', () => {
  const { groups, range } = compare('2027-05-15');
  assert.equal(groups.confirmed.length, 4);
  assert.ok(groups.confirmed.every(event => event.datum === '2027-05-15'));
  assert.deepEqual(groups.nearby.map(event => event.datum), ['2027-05-09', '2027-05-22']);
  assert.deepEqual(range, { start: '2027-05-15', end: '2027-05-16', nearbyStart: '2027-05-08', nearbyEnd: '2027-05-23' });
  assert.equal(new Set(Object.values(groups).flat()).size, Object.values(groups).flat().length);
  assert.deepEqual(compare('2027-05-16').groups, groups);
});

test('B: Istrski maraton is confirmed; Hop na grad remains an estimated period', () => {
  const { groups } = compare('2027-04-11');
  assert.deepEqual(names(groups.confirmed), ['Luka Koper 13. Istrski maraton']);
  assert.deepEqual(names(groups.expected), ['Hop na grad']);
  assert.equal(groups.expected[0].datum, '');
  assert.deepEqual([groups.expected[0].predvideno_od, groups.expected[0].predvideno_do], ['2027-04-04', '2027-04-25']);
  assert.equal(groups.known.length, 0);
});

test('C: July 10–11 has no known dated events; undated records are still disclosed', () => {
  const result = compare('2027-07-10');
  assert.ok(Object.values(result.groups).every(group => group.length === 0));
  assert.equal(result.undated, 2);
});

test('region and exact surface values apply independently of any overview month', () => {
  assert.deepEqual(names(compare('2027-05-15', 'day', { region: 'Savinjska', surface: 'trail' }).groups.confirmed), ['8. Trail Celje']);
  assert.deepEqual(names(compare('2027-05-15', 'day', { region: 'Savinjska', surface: 'cesta' }).groups.confirmed), ['18. Nočni tek Celje']);
  assert.equal(compare('2027-05-15', 'day', { region: 'Podravska', surface: 'trail' }).groups.confirmed.length, 0);
  assert.equal(compare('2027-05-09', 'day').groups.confirmed.length, 1);
  assert.equal(compare('2027-05-09', 'day', { region: 'Savinjska', surface: '' }).groups.confirmed.length, 0);
});

test('day and weekend ranges cross months and years without clipping or timezone drift', () => {
  assert.deepEqual(comparisonRange('2027-01-31', 'weekend'), { start: '2027-01-30', end: '2027-01-31', nearbyStart: '2027-01-23', nearbyEnd: '2027-02-07' });
  assert.deepEqual(comparisonRange('2027-12-31', 'weekend'), { start: '2028-01-01', end: '2028-01-02', nearbyStart: '2027-12-25', nearbyEnd: '2028-01-09' });
  assert.equal(compare('2027-12-31').outsideYear, true);
  assert.equal(compare('2027-01-01', 'day').range.nearbyStart, '2026-12-25');
  assert.equal(compare('2027-01-01', 'day').outsideYear, true);
  assert.equal(compare('2027-03-28').range.start, '2027-03-27');
  assert.equal(compare('2027-10-31').range.start, '2027-10-30');
  assert.equal(comparisonRange('2027-02-29', 'day'), null);
  assert.equal(comparisonRange('2026-12-31', 'day'), null);
  assert.equal(comparisonRange('', 'day'), null);
});

test('±7 days are inclusive at both boundaries and exclude the selected period from nearby', () => {
  const dates = ['2027-01-31', '2027-02-01', '2027-02-07', '2027-02-08', '2027-02-09', '2027-02-15', '2027-02-16'];
  const result = comparePlanningEvents(dates.map(datum => row({ datum, status: 'potrjeno' })), '2027-02-08', 'day', filters);
  assert.deepEqual(result.groups.confirmed.map(e => e.datum), ['2027-02-08']);
  assert.deepEqual(result.groups.nearby.map(e => e.datum), ['2027-02-01', '2027-02-07', '2027-02-09', '2027-02-15']);
});

test('known windows, single-day estimates and missing or unreliable data never become confirmed overlaps', () => {
  const expected = row({ predvideno_od: '2027-05-15', predvideno_do: '2027-05-15' });
  const known = row({ naziv_prireditve: 'TEST known window', status: 'termin_znan', predvideno_od: '2027-05-01', predvideno_do: '2027-06-01' });
  const invalid = [row({ datum: '2027-05-15' }), row({ predvideno_od: '2027-05-15' }), row({ predvideno_do: '2027-05-15' }), row({ predvideno_od: '2027-05-16', predvideno_do: '2027-05-15' }), row({ status: 'potrjeno', datum: '2027-02-30' }), row({ status: 'potrjeno', predvideno_od: '2027-05-15', predvideno_do: '2027-05-15' })];
  const result = comparePlanningEvents([expected, expected, known, ...invalid], '2027-05-15', 'day', filters);
  assert.deepEqual(result.groups.expected, [expected]);
  assert.deepEqual(result.groups.known, [known]);
  assert.equal(result.groups.confirmed.length, 0);
  assert.equal(result.undated, invalid.length);
});

test('links require a unique exact confirmed match on both sides and safe URLs', () => {
  const event = row({ datum: '2027-05-15', status: 'potrjeno' });
  const link = { key: planningLinkKey(event), officialUrl: 'https://example.org/2027/', profilePath: '/tek/2027/r000001-test/' };
  assert.deepEqual(matchPlanningLinks([event], [link]).get(event), link);
  assert.equal(matchPlanningLinks([event], [link, link]).size, 0);
  assert.equal(matchPlanningLinks([event, { ...event }], [link]).size, 0);
  for (const change of [{ naziv_prireditve: 'Test only' }, { datum: '2027-05-16' }, { kraj: 'Drugi kraj' }, { regija: 'Goriška' }, { tip_podlage: 'cesta' }, { status: 'pričakovano' }]) {
    assert.equal(matchPlanningLinks([{ ...event, ...change }], [link]).size, 0);
  }
  assert.equal(matchPlanningLinks([event], []).size, 0);
  const unsafe = matchPlanningLinks([event], [{ ...link, officialUrl: 'javascript:alert(1)', profilePath: '//example.org/tek/2027/test/' }]).get(event);
  assert.equal(unsafe.officialUrl, '');
  assert.equal(unsafe.profilePath, '');
});

test('comparison ranges localize and explicitly include both years at a year boundary', () => {
  assert.equal(formatComparisonRange('2027-05-15', '2027-05-16', 'sl'), '15.–16. maja 2027');
  assert.equal(formatComparisonRange('2027-05-15', '2027-05-15', 'en'), '15 May 2027');
  assert.equal(formatComparisonRange('2026-12-25', '2027-01-08', 'en'), '25 December 2026 – 8 January 2027');
  assert.match(formatComparisonRange('2027-12-25', '2028-01-09', 'sl'), /2027.*2028/);
});
