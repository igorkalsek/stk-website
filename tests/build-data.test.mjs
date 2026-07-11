import assert from 'node:assert/strict';
import { test } from 'node:test';
import { __resetBuildDataCachesForTests, fetchMasterYearPayload, timedFetchJson } from '../.cache/dist-test/utils-build-data.js';

const jsonResponse = (payload, init = {}) => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

test('master year payload fetch is memoized per year and rejected promises are cleared', async () => {
  __resetBuildDataCachesForTests();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse({ rows: [{ row: calls }] });
  };

  const [first, second] = await Promise.all([
    fetchMasterYearPayload('2026', fetchImpl),
    fetchMasterYearPayload('2026', fetchImpl),
  ]);

  assert.equal(calls, 1);
  assert.deepEqual(first, second);

  __resetBuildDataCachesForTests();
  let failed = false;
  const retryFetch = async () => {
    calls += 1;
    if (!failed) {
      failed = true;
      throw new Error('temporary network error');
    }
    return jsonResponse({ ok: true });
  };

  await assert.rejects(fetchMasterYearPayload('2027', retryFetch), /temporary network error/);
  assert.deepEqual(await fetchMasterYearPayload('2027', retryFetch), { ok: true });
});

test('timedFetchJson aborts slow build-time requests', async () => {
  __resetBuildDataCachesForTests();
  const slowFetch = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason ?? new Error('aborted')), { once: true });
  });

  await assert.rejects(
    timedFetchJson('https://example.test/slow', { label: 'slow endpoint', timeoutMs: 10, fetchImpl: slowFetch }),
    /aborted|AbortError|This operation was aborted/i,
  );
});
