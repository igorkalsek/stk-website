import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet } from '../.cache/dist-test/interest/functions/api/interest-preview.js';
import { interestContract } from './fixtures/interest-contract.mjs';

const header = 'X-STK-Interest-Diagnostic';
const enabled = (year = '2026') => ({
  request: new Request(`https://site.test/api/interest-preview?year=${year}`),
  env: { STK_INTEREST_PREVIEW_ENABLED: 'true' }
});
const failureBody = {
  ok: false, endpoint: 'site-analytics', type: 'interest_preview',
  error: 'interest_preview_temporarily_unavailable', items: []
};
async function failure(response, diagnostic) {
  assert.equal(response.status, 503);
  assert.equal(response.headers.get(header), diagnostic);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.deepEqual([...response.headers.keys()].sort(), [
    'cache-control', 'content-type', header.toLowerCase()
  ].sort());
  assert.deepEqual(await response.json(), failureBody);
}

for (const flag of [undefined, 'false', 'TRUE', '1']) {
  test(`disabled flag (${flag}) makes no upstream call`, async t => {
    const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('Unexpected network call'));
    const context = enabled();
    context.env.STK_INTEREST_PREVIEW_ENABLED = flag;
    await failure(await onRequestGet(context), 'disabled');
    assert.equal(fetch.mock.callCount(), 0);
  });
}

test('invalid year is rejected before fetch', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('Unexpected network call'));
  await failure(await onRequestGet(enabled('2028')), 'invalid_year');
  assert.equal(fetch.mock.callCount(), 0);
});

test('request construction failure remains visible without a network call', async t => {
  const context = enabled();
  const NativeRequest = Request;
  t.mock.method(globalThis, 'Request', class extends NativeRequest {
    constructor(url, init) {
      assert.equal(init.redirect, 'manual');
      throw new TypeError('Runtime error with private URL or secret');
    }
  });
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('Unexpected network call'));
  await failure(await onRequestGet(context), 'request_config_error');
  assert.equal(fetch.mock.callCount(), 0);
});

test('fetch failure does not expose exception details', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new TypeError('Private URL, secret, personal data'); });
  await failure(await onRequestGet(enabled()), 'fetch_error');
});

for (const status of [301, 302, 303, 304, 307, 308, 400, 429, 500, 503]) {
  test(`upstream HTTP ${status} is diagnosed without forwarding headers or reading the body`, async t => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      calls++;
      assert.equal(init.redirect, 'manual');
      assert.equal(init.cache, 'no-store');
      assert.deepEqual(init.headers, { accept: 'application/json' });
      assert.equal(url, 'https://stk-master-api.igor-kalsek.workers.dev/site-analytics?scope=recent-interest&year=2026&limit=20');
      return { status, ok: false, headers: new Headers({ location: 'https://private.test/secret', 'set-cookie': 'secret' }),
        json: () => assert.fail('Failure body must not be read') };
    });
    await failure(await onRequestGet(enabled()), status < 400 ? 'upstream_redirect' : 'upstream_status');
    assert.equal(calls, 1);
  });
}

test('malformed JSON is distinguished from a rejected contract', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{"private":', { status: 200 }));
  await failure(await onRequestGet(enabled()), 'invalid_json');
});

for (const payload of [null, { private: 'secret' }, { ...interestContract(), score_version: 'v1' }]) {
  test(`valid JSON rejected by the validator returns contract_rejected (${JSON.stringify(payload).slice(0, 30)})`, async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
    await failure(await onRequestGet(enabled()), 'contract_rejected');
  });
}

test('body transport failure is a fetch error rather than invalid JSON', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200,
    json: async () => { throw new TypeError('Private transport details'); } }));
  await failure(await onRequestGet(enabled()), 'fetch_error');
});

for (const stage of ['fetch', 'body']) {
  test(`55s timeout during ${stage} has priority over other errors`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let signal;
    const aborted = () => new Promise((_, reject) => signal.addEventListener('abort',
      () => reject(new SyntaxError('Private abort detail')), { once: true }));
    t.mock.method(globalThis, 'fetch', async (_, init) => {
      signal = init.signal;
      if (stage === 'fetch') return aborted();
      return { ok: true, status: 200, json: aborted };
    });
    const pending = onRequestGet(enabled());
    // Allow the body read to start before advancing the timer.
    for (let i = 0; i < 10; i++) await Promise.resolve();
    t.mock.timers.tick(54999);
    assert.equal(signal.aborted, false);
    t.mock.timers.tick(1);
    await failure(await pending, 'timeout');
    assert.equal(signal.aborted, true);
  });
}

for (const year of ['2026', '2027']) {
  test(`${year} success preserves the JSON and omits the failure diagnostic; timer is cleared`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const payload = interestContract([], { year });
    const NativeRequest = Request;
    const configurations = [];
    const context = enabled(year);
    t.mock.method(globalThis, 'Request', class extends NativeRequest {
      constructor(url, init) {
        configurations.push(init);
        if (init.redirect !== 'manual') throw new TypeError('Unsupported redirect mode');
        super(url, init);
      }
    });
    let signal;
    t.mock.method(globalThis, 'fetch', async (_, init) => {
      assert.strictEqual(init, configurations[0]);
      assert.equal(init.redirect, 'manual');
      signal = init.signal;
      return Response.json(payload);
    });
    const response = await onRequestGet(context);
    assert.equal(configurations.length, 1);
    assert.equal(configurations[0].redirect, 'manual');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get(header), null);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), payload);
    t.mock.timers.tick(55000);
    assert.equal(signal.aborted, false);
  });
}

test('timer is cleared on an early upstream failure', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  t.mock.method(globalThis, 'fetch', async (_, init) => {
    signal = init.signal;
    return new Response(null, { status: 503 });
  });
  await failure(await onRequestGet(enabled()), 'upstream_status');
  t.mock.timers.tick(55000);
  assert.equal(signal.aborted, false);
});
