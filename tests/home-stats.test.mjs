import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countPublicYearStats, loadPublicYearStats } from '../.cache/dist-test/utils-home-stats.js';

const race = (overrides = {}) => ({ datum: '2027-01-10', naziv_prireditve: 'Tek', kraj: 'Kranj', status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA', ...overrides });

test('annual stats reuse canonical public eligibility and explicit family notes without a date cutoff', () => {
  const data = [
    race({ opombe_javne: 'Družinam prijazno.' }),
    race({ naziv_prireditve: 'Otroški družinski tek', razdalje_km: '0.5;1', opombe_javne: 'Otroški teki.' }),
    race({ opombe: 'Družinam prijazno' }), // Private notes do not qualify.
    race({ status_dogodka: 'neuradno', opombe_javne: 'Družinam prijazno' }),
    race({ status_dogodka: 'pričakovano' }),
    race({ vidno_v_javnem_koledarju: 'NE', opombe_javne: 'Družinam prijazno' }),
    race({ status_dogodka: '' }), race({ vidno_v_javnem_koledarju: '' }),
    race({ datum: '2026-01-10', opombe_javne: 'Družinam prijazno' }),
    race({ datum: 'invalid' }), race({ naziv_prireditve: '' })
  ];
  assert.deepEqual(countPublicYearStats({ data }, '2027'), { confirmed: 3, family: 1 });
  assert.deepEqual(countPublicYearStats({ rows: data }, '2027'), { confirmed: 3, family: 1 });
  assert.deepEqual(countPublicYearStats(data, '2027'), { confirmed: 3, family: 1 });
});

test('empty, missing, malformed and explicitly failed data stays neutral', () => {
  for (const payload of [null, undefined, {}, [], { data: [] }, { data: null }, { data: [null, 3] }, { data: [{}] }, { ok: false, data: [race()] }]) {
    assert.equal(countPublicYearStats(payload, '2027'), null);
  }
  assert.equal(countPublicYearStats({ data: [race({ status_dogodka: 'neuradno' })] }, '2027'), null);
});

test('year-aware loader requests the canonical path once and handles unavailable data', async () => {
  const paths = [];
  assert.deepEqual(await loadPublicYearStats('2027', async (path) => { paths.push(path); return { data: [race()] }; }), { confirmed: 1, family: 0 });
  assert.deepEqual(paths, ['/?year=2027']);
  assert.equal(await loadPublicYearStats('2027', async () => { throw new Error('HTTP or network failure'); }), null);
  assert.equal(await loadPublicYearStats('2027', async () => JSON.parse('{')), null);
});
