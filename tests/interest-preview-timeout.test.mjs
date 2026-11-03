import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { parseInterestPreview, matchInterestMasters } from '../.cache/dist-test/utils-interest-preview.js';
import { onRequestGet } from '../.cache/dist-test/interest/functions/api/interest-preview.js';
import { interestContract } from './fixtures/interest-contract.mjs';

const now = new Date('2026-11-02T12:00:00Z');
// Execute the actual SL/EN request code without moving it out of the Astro pages.
function browserLoader(locale, fetch) {
  const source = readFileSync(new URL(`../src/pages/${locale === 'en' ? 'en/' : ''}index.astro`, import.meta.url), 'utf8');
  const start = source.indexOf('  const interestRequests =');
  const end = source.indexOf('  type DeadlineType', start);
  assert.ok(start >= 0 && end > start);
  const { outputText } = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
  });
  return runInNewContext(outputText + '\nasync (rows, limit, year) => matchInterestMasters(parseInterestPreview(await loadInterestPreviewPayload(year), year), rows, year).slice(0, limit);', {
    INTEREST_PREVIEW_URL: '/api/interest-preview', fetch, AbortController, Date,
    setTimeout, clearTimeout, parseInterestPreview, matchInterestMasters
  });
}

const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const enabled = year => ({ request: new Request(`https://site.test/api/interest-preview?year=${year}`),
  env: { STK_INTEREST_PREVIEW_ENABLED: 'true' } });
const pendingUntilAbort = signal => new Promise((_, reject) => {
  signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
});

for (const locale of ['sl', 'en']) for (const year of ['2026', '2027']) {
  test(`${locale}/${year} accepts a 36.6s cold relay response at 90% quality`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now });
    const item = { event_id: 'R000002', event_name: 'Testni tek', event_date: `${year}-11-08` };
    const p = interestContract([item], { year, now, candidates: 10 });
    p.quality = { candidates: 10, valid: 9, excluded: 1, verified_percent: 90 };
    let upstreamSignal, browserSignal;
    t.mock.method(globalThis, 'fetch', (url, init) => {
      assert.equal(url, `https://stk-master-api.igor-kalsek.workers.dev/site-analytics?scope=recent-interest&year=${year}&limit=20`);
      upstreamSignal = init.signal;
      return Promise.race([
        pendingUntilAbort(init.signal),
        new Promise(resolve => setTimeout(() => resolve(Response.json(p)), 36600))
      ]);
    });
    const load = browserLoader(locale, (url, init) => {
      assert.equal(url, `/api/interest-preview?year=${year}`);
      browserSignal = init.signal;
      return Promise.race([pendingUntilAbort(init.signal), onRequestGet(enabled(year))]);
    });
    let completed = false;
    const result = load([{ row: '2', naziv_prireditve: item.event_name, datum: item.event_date,
      status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA' }], 5, year)
      .then(items => { completed = true; return items; });
    t.mock.timers.tick(20001); await flush();
    assert.equal(completed, false);
    assert.equal(upstreamSignal.aborted, false);
    assert.equal(browserSignal.aborted, false);
    t.mock.timers.tick(16599);
    assert.equal((await result)[0].row, '2');
    // Both request timers must be cleared after success.
    t.mock.timers.tick(60000);
    assert.equal(upstreamSignal.aborted, false);
    assert.equal(browserSignal.aborted, false);
  });

  test(`${locale}/${year} aborts an unresponsive browser request at 60s and permits a fresh retry`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now });
    let signal, calls = 0;
    const load = browserLoader(locale, async (_, init) => {
      signal = init.signal;
      if (++calls === 1) return pendingUntilAbort(signal);
      return Response.json(interestContract([], { year, now: new Date() }));
    });
    const failure = assert.rejects(load([], 5, year), { name: 'AbortError' });
    t.mock.timers.tick(59999); assert.equal(signal.aborted, false);
    t.mock.timers.tick(1); await failure;
    assert.equal(signal.aborted, true);
    assert.equal((await load([], 5, year)).length, 0);
    assert.equal(calls, 2);
  });
}

for (const year of ['2026', '2027']) {
  test(`${year} relay aborts at 55s and returns uncacheable 503 with no fallback`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now });
    let signal;
    t.mock.method(globalThis, 'fetch', (_, init) => {
      signal = init.signal;
      return pendingUntilAbort(signal);
    });
    const pending = onRequestGet(enabled(year));
    t.mock.timers.tick(54999); assert.equal(signal.aborted, false);
    t.mock.timers.tick(1);
    const response = await pending;
    assert.equal(signal.aborted, true);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await response.json()).items, []);
  });
}
