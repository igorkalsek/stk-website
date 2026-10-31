import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../functions/api/interest-preview.ts', import.meta.url), 'utf8');
const { onRequestGet } = await import('../.cache/dist-test/interest/functions/api/interest-preview.js');

test('safety hold returns an explicit uncacheable unavailable response, without upstream reads or writes', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('No network during safety hold'); };
  try {
    const response = await onRequestGet();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await response.json(), {
      ok: false, endpoint: 'site-analytics', type: 'interest_preview',
      error: 'interest_preview_temporarily_unavailable', items: []
    });
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('request parameters cannot bypass the hold or inject a legacy ranking', async () => {
  for (const query of ['year=2027', 'aggregate_date=2026-07-06', 'scope=community-insights', 'detail_views=100&rank=1']) {
    const response = await onRequestGet({ request: new Request(`https://example.test/api/interest-preview?${query}`) });
    assert.equal(response.status, 503);
    assert.deepEqual((await response.json()).items, []);
  }
});
