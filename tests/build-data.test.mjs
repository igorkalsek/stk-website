import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  __resetBuildDataCachesForTests,
  assertRequiredDetailPaths,
  fetchMasterYearPayload,
  getAdditionalEventDataCached,
  getDetailStaticPaths,
  getTopVoteRowsCached,
  timedFetchJson,
} from '../.cache/dist-test/utils-build-data.js';

const jsonResponse = (payload, init = {}) => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

test('master year payload fetch retries a temporary error and remains memoized per year', async () => {
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
  calls = 0;
  const retryFetch = async () => {
    calls += 1;
    if (calls === 1) throw new Error('temporary network error');
    return jsonResponse({ ok: true });
  };

  const [retried, cached] = await Promise.all([
    fetchMasterYearPayload('2027', retryFetch),
    fetchMasterYearPayload('2027', retryFetch),
  ]);
  assert.deepEqual(retried, { ok: true });
  assert.deepEqual(cached, retried);
  assert.equal(calls, 2);
});

test('master year payload stops after three attempts and clears the rejected cache entry', async () => {
  __resetBuildDataCachesForTests();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls <= 3) throw new Error(`network error ${calls}`);
    return jsonResponse({ ok: true });
  };

  await assert.rejects(fetchMasterYearPayload('2026', fetchImpl), /network error 3/);
  assert.equal(calls, 3);
  assert.deepEqual(await fetchMasterYearPayload('2026', fetchImpl), { ok: true });
  assert.equal(calls, 4);
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

test('top vote rows are fetched once for concurrent callers and retry after rejection', async () => {
  __resetBuildDataCachesForTests();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse({ top: [{ row: calls, vote_url: 'https://example.com/vote' }] });
  };

  try {
    const [first, second] = await Promise.all([
      getTopVoteRowsCached(),
      getTopVoteRowsCached(),
    ]);

    assert.equal(calls, 1);
    assert.deepEqual(first, second);

    __resetBuildDataCachesForTests();
    let failed = false;
    calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (!failed) {
        failed = true;
        throw new Error('temporary top error');
      }
      return jsonResponse({ top: [{ row: '2', vote_url: 'https://example.com/retry' }] });
    };

    await assert.rejects(getTopVoteRowsCached(), /temporary top error/);
    assert.deepEqual(await getTopVoteRowsCached(), [{ row: '2', vote_url: 'https://example.com/retry' }]);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('additional event data is cached separately by year and retries a rejected year', async () => {
  __resetBuildDataCachesForTests();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse({ additional: [] });
  };

  try {
    const [first2026, first2027, second2027] = await Promise.all([
      getAdditionalEventDataCached('2026'),
      getAdditionalEventDataCached('2027'),
      getAdditionalEventDataCached('2027'),
    ]);

    assert.equal(calls, 2);
    assert.deepEqual(first2026, []);
    assert.deepEqual(first2027, second2027);

    __resetBuildDataCachesForTests();
    let failed = false;
    calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (!failed) {
        failed = true;
        throw new Error('temporary additional error');
      }
      return jsonResponse({ additional: [] });
    };

    await assert.rejects(getAdditionalEventDataCached('2027'), /temporary additional error/);
    assert.deepEqual(await getAdditionalEventDataCached('2027'), []);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Slovenian and English detail paths reuse the same year data cache', async () => {
  __resetBuildDataCachesForTests();
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    const year = String(url).includes('year=2027') ? '2027' : '2026';
    return jsonResponse({
      rows: [{
        row: year === '2027' ? '2027' : '2026',
        datum: `${year}-12-01`,
        naziv_prireditve: `Testni tek ${year}`,
        kraj: 'Ljubljana',
        regija: 'Osrednjeslovenska',
        tip_podlage: 'cesta',
        razdalje_km: '10',
        status_dogodka: 'potrjeno',
        vidno_v_javnem_koledarju: 'DA',
      }, {
        row: `hidden-${year}`,
        datum: `${year}-12-02`,
        naziv_prireditve: `Skriti tek ${year}`,
        kraj: 'Ljubljana',
        status_dogodka: 'potrjeno',
        vidno_v_javnem_koledarju: 'NE',
      }, {
        row: `unconfirmed-${year}`,
        datum: `${year}-12-03`,
        naziv_prireditve: `Neuradni tek ${year}`,
        kraj: 'Ljubljana',
        status_dogodka: 'osnutek',
        vidno_v_javnem_koledarju: 'DA',
      }],
    });
  };

  try {
    const slPaths = await getDetailStaticPaths('sl');
    const enPaths = await getDetailStaticPaths('en');

    assert.equal(slPaths.length, 2);
    assert.equal(enPaths.length, 2);
    assert.equal(requestedUrls.length, 2);
    assert.equal(new Set(requestedUrls).size, 2);
    assert.deepEqual(slPaths.map((path) => path.params), enPaths.map((path) => path.params));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('detail paths fail the build when required year 2026 has no valid public events', async () => {
  __resetBuildDataCachesForTests();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => jsonResponse(String(url).includes('year=2027') ? { rows: [{
    row: '2027',
    datum: '2027-12-01',
    naziv_prireditve: 'Prihodnji testni tek',
    kraj: 'Ljubljana',
    status_dogodka: 'potrjeno',
    vidno_v_javnem_koledarju: 'DA',
  }] } : { rows: [] });

  try {
    await assert.rejects(getDetailStaticPaths('sl'), /2026.*no valid public events/i);
    await assert.rejects(getDetailStaticPaths('en'), /2026.*no valid public events/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('detail paths fail the build when either language has no required 2026 paths', () => {
  const event = { title: 'Testni tek' };
  const path = { params: { year: '2026', slug: 'testni-tek' }, props: { event, year: '2026', relatedRaces: [] } };
  const baseData = { year: '2026', events: [event], slPaths: [path], enPaths: [path], relatedPrepMs: 0 };

  assert.throws(() => assertRequiredDetailPaths({ ...baseData, slPaths: [] }, 'sl'), /no SL detail paths.*2026/i);
  assert.throws(() => assertRequiredDetailPaths({ ...baseData, enPaths: [] }, 'en'), /no EN detail paths.*2026/i);
});

test('unreachable optional future year is skipped without hiding required 2026 paths', async () => {
  __resetBuildDataCachesForTests();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('year=2027')) throw new Error('future year unavailable');
    return jsonResponse({ rows: [{
      row: '2026',
      datum: '2026-12-01',
      naziv_prireditve: 'Obvezni testni tek',
      kraj: 'Ljubljana',
      status_dogodka: 'potrjeno',
      vidno_v_javnem_koledarju: 'DA',
    }] });
  };

  try {
    const paths = await getDetailStaticPaths('sl');
    assert.equal(paths.length, 1);
    assert.equal(paths[0].params.year, '2026');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
