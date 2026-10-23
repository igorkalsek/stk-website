import test from 'node:test';
import assert from 'node:assert/strict';
import { selectOrganizerConfirmedRaces as select, fetchOrganizerConfirmedRaces as load } from '../.cache/dist-test/organizer-confirmed-races.js';
import { buildEventDetailPath, buildEnglishEventDetailPath } from '../.cache/dist-test/utils-event-detail.js';

const race = (row = 11, extra = {}) => ({ row, datum: '2027-05-15', naziv_prireditve: '45. Maraton treh src', kraj: 'Radenci', status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA', ...extra });
const master = (data = [race()], extra = {}) => ({ ok: true, sheet: '2027', data, ...extra });
const projection = (events = [{ event_id: 'R000011', data_confirmed: true }], extra = {}) => ({ ok: true, type: 'organizer_confirmations', year: '2027', events, ...extra });

test('uses year + Master row, orders by date, and builds bilingual public profile paths', () => {
  const events = select(master([race(), race(12, { datum: '2027-03-27', naziv_prireditve: 'Kras Trail 2027' }), race(19, { datum: '2027-03-07' }), race(34)]), projection([11, 12, 19].map(row => ({ event_id: `R${String(row).padStart(6, '0')}`, data_confirmed: true }))));
  assert.deepEqual(events.map(x => x.row), ['19', '12', '11']);
  assert.equal(buildEventDetailPath(events[2]), '/tek/2027/r000011-45-maraton-treh-src/');
  assert.equal(buildEnglishEventDetailPath(events[2]), '/en/races/2027/r000011-45-maraton-treh-src/');
});
for (const [name, confirmations] of [
  ['PENDING and stale snapshots omitted by the public projection', projection([])],
  ['data_confirmed=false', projection([{ event_id: 'R000011', data_confirmed: false }])],
  ['wrong year including the Go4trail control', projection([{ event_id: 'R000256', data_confirmed: true }], { year: '2026' })],
  ['wrong row-based event_id', projection([{ event_id: 'R000012', data_confirmed: true }])],
  ['race_id cannot replace event_id', projection([{ race_id: 'R000011', data_confirmed: true }])],
  ['incomplete response', { ok: true, year: '2027' }],
  ['wrong type', projection([], { type: 'other' })],
  ['upstream error', projection(undefined, { ok: false })],
  ['ambiguous projection', projection([{ event_id: 'R000011', data_confirmed: true }, { event_id: 'R000011', data_confirmed: false }])],
]) test(`fails closed: ${name}`, () => assert.deepEqual(select(master(), confirmations), []));
for (const [name, data] of [
  ['unconfirmed event', master([race(11, { status_dogodka: 'predvideno' })])],
  ['hidden event', master([race(11, { vidno_v_javnem_koledarju: 'NE' })])],
  ['wrong edition', master([race(11, { datum: '2026-05-15' })])],
  ['duplicate Master identity', master([race(), race('011')])],
  ['missing row', master([race('', { race_id: 'R000011' })])],
  ['missing place', master([race(11, { kraj: '' })])],
  ['wrong Master year', master(undefined, { sheet: '2026' })],
  ['incomplete Master', { ok: true, sheet: '2027' }],
  ['empty Master', master([])],
]) test(`excludes ${name}`, () => assert.deepEqual(select(data, projection()), []));

test('loader requests only the two public Worker GETs and joins their responses', async () => {
  const urls = [];
  const result = await load(async (url, options) => {
    urls.push(url);
    assert.equal(options.headers.Accept, 'application/json');
    assert.ok(options.signal);
    return new Response(JSON.stringify(url.includes('organizer-confirmations') ? projection() : master()));
  });
  assert.equal(result.length, 1);
  assert.deepEqual(urls, ['https://stk-master-api.igor-kalsek.workers.dev/?year=2027', 'https://stk-master-api.igor-kalsek.workers.dev/organizer-confirmations?year=2027']);
});
for (const mode of ['network', 'http', 'json', 'incomplete']) test(`loader fails closed on ${mode} failure`, async () => {
  assert.deepEqual(await load(async () => {
    if (mode === 'network') throw new Error('offline');
    if (mode === 'http') return new Response('', { status: 503 });
    if (mode === 'json') return new Response('{');
    return new Response('{}');
  }), []);
});

test('stalled public reads abort after the deadline and return no confirmations', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const signals = [];
  const pending = load(async (_url, options) => {
    signals.push(options.signal);
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  });
  t.mock.timers.tick(12_000);
  assert.deepEqual(await pending, []);
  assert.equal(signals.length, 2);
  assert.ok(signals.every(signal => signal.aborted));
});
