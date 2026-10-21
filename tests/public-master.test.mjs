import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { fetchPublicMaster } from '../.cache/dist-test/utils-public-master.js';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('shares pending JSON reads by year and fetches fresh data after completion', async () => {
  const reads = [];
  globalThis.fetch = (url, options) => new Promise(resolve => reads.push({ url, options, resolve }));
  const first = fetchPublicMaster('2026');
  const same = fetchPublicMaster('2026');
  const other = fetchPublicMaster('2027');
  assert.equal(reads.length, 2);
  assert.equal(first, same);
  assert.notEqual(first, other);
  assert.equal(reads[0].url, 'https://stk-master-api.igor-kalsek.workers.dev/');
  assert.equal(reads[1].url, 'https://stk-master-api.igor-kalsek.workers.dev/?year=2027');
  reads[0].resolve(Response.json({ year: '2026', revision: 1 }));
  reads[1].resolve(Response.json({ year: '2027' }));
  assert.equal((await first).year, '2026');
  assert.equal((await other).year, '2027');
  const fresh = fetchPublicMaster('2026');
  assert.equal(reads.length, 3);
  reads[2].resolve(Response.json({ year: '2026', revision: 2 }));
  assert.equal((await fresh).revision, 2);
});

for (const failure of ['network', 'http', 'json']) test(`retries after ${failure} failure, including shared consumers`, async () => {
  let release;
  globalThis.fetch = () => new Promise(resolve => { release = resolve; });
  const request = fetchPublicMaster('2026');
  const other = fetchPublicMaster('2026');
  const rejected = Promise.all([assert.rejects(request), assert.rejects(other)]);
  if (failure === 'network') release(Promise.reject(new Error('offline')));
  else release(failure === 'http' ? new Response('', { status: 503 }) : new Response('{'));
  await rejected;
  globalThis.fetch = async () => Response.json({ revision: 2 });
  assert.deepEqual(await fetchPublicMaster('2026'), { revision: 2 });
});
