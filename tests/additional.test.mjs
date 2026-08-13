import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { attachAdditionalDataByMasterRow, fetchAdditionalEventData, mapAdditionalRow } from '../.cache/dist-test/utils-additional.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const row = (year, overrides = {}) => ({
  leto: year,
  master_sheet: year,
  master_row: '12',
  zanesljivost: 'visoka',
  datum: `${year}-05-10`,
  naziv_prireditve: 'Ljubljanski tek',
  prijavnina_min_eur: '10',
  rok_prijave: `${year}-05-01`,
  ...overrides,
});

const event = (year) => ({ row: '12', year, date: `${year}-05-10`, title: 'Ljubljanski tek', naziv_prireditve: 'Ljubljanski tek' });

test('fetches the backward-compatible 2026 URL and year-query 2027 URL', async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    const year = String(url).includes('year=2027') ? '2027' : '2026';
    return new Response(JSON.stringify({ additional: [row(year)] }), { status: 200 });
  };

  assert.equal((await fetchAdditionalEventData('2026')).length, 1);
  assert.equal((await fetchAdditionalEventData('2027')).length, 1);
  assert.deepEqual(urls, [
    'https://stk-master-api.igor-kalsek.workers.dev/additional',
    'https://stk-master-api.igor-kalsek.workers.dev/additional?year=2027',
  ]);
});

test('filters payload rows that do not belong to the requested year and sheet', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ additional: [row('2027'), row('2026'), row('2027', { master_sheet: '2026' })] }), { status: 200 });
  const rows = await fetchAdditionalEventData('2027');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].year, '2027');
  assert.equal(rows[0].masterSheet, '2027');
});

test('matches only the requested event year while preserving existing safeguards', () => {
  const additional2026 = mapAdditionalRow(row('2026'));
  const additional2027 = mapAdditionalRow(row('2027'));

  assert.equal(attachAdditionalDataByMasterRow([event('2026')], [additional2026], '2026')[0].additionalData?.year, '2026');
  assert.equal(attachAdditionalDataByMasterRow([event('2027')], [additional2027], '2027')[0].additionalData?.year, '2027');
  assert.equal(attachAdditionalDataByMasterRow([event('2027')], [additional2026], '2027')[0].additionalData, null);
  assert.equal(attachAdditionalDataByMasterRow([event('2026')], [additional2027], '2026')[0].additionalData, null);
  assert.equal(attachAdditionalDataByMasterRow([event('2027')], [mapAdditionalRow(row('2027', { datum: '2027-05-11' }))], '2027')[0].additionalData, null);
  assert.equal(attachAdditionalDataByMasterRow([event('2027')], [mapAdditionalRow(row('2027', { naziv_prireditve: 'Povsem druga prireditev' }))], '2027')[0].additionalData, null);
  assert.equal(attachAdditionalDataByMasterRow([event('2027')], [mapAdditionalRow(row('2027', { zanesljivost: 'srednja' }))], '2027')[0].additionalData, null);
});

test('treats an empty 2027 additional dataset as a normal unenriched result', () => {
  assert.equal(attachAdditionalDataByMasterRow([event('2027')], [], '2027')[0].additionalData, null);
});
