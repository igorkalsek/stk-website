// Optional local workerd smoke test; no deployment, real upstream or project dependency changes.
// npm install --prefix /tmp/stk-dev047-runtime --cache /tmp/stk-dev047-npm-cache --no-audit --no-fund miniflare@4.20260730.0
// STK_MINIFLARE_PATH=/tmp/stk-dev047-runtime/node_modules/miniflare node tests/interest-preview-runtime.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { interestContract } from './fixtures/interest-contract.mjs';

const require = createRequire(import.meta.url);
const { Miniflare, Response: MockResponse } = require(process.env.STK_MINIFLARE_PATH || 'miniflare');
const relay = fileURLToPath(new URL('../functions/api/interest-preview.ts', import.meta.url));
const { outputFiles } = await build({
  stdin: { contents: `import { onRequestGet } from ${JSON.stringify(relay)};
    export default { fetch(request) {
      const flag = new URL(request.url).searchParams.get('testFlag') || 'true';
      return onRequestGet({ request, env: { STK_INTEREST_PREVIEW_ENABLED: flag } });
    } };`, resolveDir: process.cwd() },
  bundle: true, format: 'esm', platform: 'browser', write: false
});
const replies = [];
let calls = 0;
const reply = (status, body, headers, year = '2026') => replies.push(request => {
  assert.equal(request.method, 'GET');
  assert.equal(request.url, `https://stk-master-api.igor-kalsek.workers.dev/site-analytics?scope=recent-interest&year=${year}&limit=20`);
  assert.equal(request.headers.get('accept'), 'application/json');
  return new MockResponse(body, { status, headers });
});
const mf = new Miniflare({ modules: true, script: outputFiles[0].text,
  compatibilityDate: '2026-07-30', cf: false,
  outboundService: request => {
    calls++;
    assert.ok(replies.length, 'Unexpected outbound request (including redirect following)');
    return replies.shift()(request);
  }
});
const failureBody = { ok: false, endpoint: 'site-analytics', type: 'interest_preview',
  error: 'interest_preview_temporarily_unavailable', items: [] };
let checks = 0, release, watchdog;
async function failure(code, query = 'year=2026') {
  const response = await mf.dispatchFetch(`https://site.test/api/interest-preview?${query}`);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('X-STK-Interest-Diagnostic'), code);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('location'), null);
  assert.deepEqual(await response.json(), failureBody);
  checks++;
}
try {
  await failure('disabled', 'testFlag=false');
  await failure('invalid_year', 'year=2028');
  assert.equal(calls, 0);
  for (const year of ['2026', '2027']) {
    const payload = interestContract([], { year });
    reply(200, JSON.stringify(payload), undefined, year);
    const response = await mf.dispatchFetch(`https://site.test/api/interest-preview?year=${year}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-STK-Interest-Diagnostic'), null);
    assert.deepEqual(await response.json(), payload);
    checks++;
  }
  for (const status of [301, 302, 303, 304, 307, 308]) {
    reply(status, status === 304 ? null : '', { location: 'https://must-not-follow.invalid/' });
    await failure('upstream_redirect');
  }
  reply(503, 'private upstream failure');
  await failure('upstream_status');
  reply(200, '{');
  await failure('invalid_json');
  reply(200, JSON.stringify({ private: 'rejected contract' }));
  await failure('contract_rejected');
  // Exercise the unchanged real 55-second deadline in workerd (no fake timers).
  replies.push(() => new Promise(resolve => {
    release = resolve;
    watchdog = setTimeout(() => resolve(new MockResponse('{}')), 60000);
  }));
  const started = performance.now();
  await failure('timeout');
  const elapsed = performance.now() - started;
  assert.ok(elapsed >= 54000 && elapsed < 60000, `Timeout took ${elapsed}ms`);
  release(new MockResponse('{}'));
  assert.equal(replies.length, 0);
  assert.equal(calls, 12, 'Only the expected upstream calls were made');
  console.log(`workerd: ${checks} checks passed, timeout ${Math.round(elapsed)}ms; no real upstream calls`);
} finally {
  clearTimeout(watchdog);
  release?.(new MockResponse('{}'));
  await mf.dispose();
}
