import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInterestPreview, matchInterestMasters } from '../.cache/dist-test/utils-interest-preview.js';
import { onRequestGet } from '../.cache/dist-test/interest/functions/api/interest-preview.js';
import { interestContract } from './fixtures/interest-contract.mjs';

const now = new Date('2026-11-02T12:00:00Z');
const item = { event_id: 'R000002', event_name: 'Testni tek – primer', event_date: '2026-11-08' };
const payload = () => interestContract([item], { now });
const master = { row: '2', naziv_prireditve: item.event_name, datum: item.event_date, status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA' };

test('strict v2 contract validates, preserves analytic order and matches current canonical year/row/date/name', () => {
  const items = parseInterestPreview(payload(), '2026', now);
  assert.equal(items[0].community_interest_score_7d, 10);
  assert.equal(matchInterestMasters(items, [master], '2026')[0].row, '2');
  const p = interestContract([{ ...item, event_date: '2027-11-08' }], { year: '2027', now });
  assert.equal(parseInterestPreview(p, '2027', now)[0].event_year, '2027');
  assert.throws(() => parseInterestPreview(p, '2026', now));
});
test('legacy, stale, malformed, partial, low-quality, duplicate, unsorted and invalid scores are rejected', () => {
  for (const mutate of [p => delete p.contract, p => p.score_version = 'v1', p => p.period.final_day_complete = false,
    p => p.captured_at = '2026-11-01T12:00:00Z', p => p.master_captured_at = 'invalid', p => p.expires_at = now.toISOString(),
    p => p.generated_at = '2026-11-03T12:00:00Z', p => p.period.to = '2026-10-31', p => p.quality.valid = 0,
    p => p.items[0].community_interest_score_7d = 999, p => p.items[0].event_date = '2026-02-30',
    p => p.items.push({ ...p.items[0], rank: 2 }), p => p.items[0].event_year = '2027']) {
    const p = payload(); mutate(p); assert.throws(() => parseInterestPreview(p, '2026', now));
  }
  const p = interestContract([item, { ...item, event_id: 'R000003', community_interest_score_7d: 20, active_actions_7d: 4 }], { now });
  assert.throws(() => parseInterestPreview(p, '2026', now));
});
test('missing/ambiguous/moved/hidden Master identities fail instead of silently substituting races', () => {
  const items = parseInterestPreview(payload(), '2026', now);
  for (const masters of [[], [master, master], [{ ...master, datum: '2026-11-09' }], [{ ...master, naziv_prireditve: 'Drug tek' }],
    [{ ...master, year: '2027' }], [{ ...master, vidno_v_javnem_koledarju: 'NE' }]])
    assert.throws(() => matchInterestMasters(items, masters, '2026'));
  assert.deepEqual(parseInterestPreview(interestContract([], { now }), '2026', now), []);
});
test('a fresh analytics capture cannot extend expiry past the older Master freshness deadline', () => {
  const p = payload(); p.master_captured_at = new Date(now.getTime() - 299000).toISOString();
  assert.throws(() => parseInterestPreview(p, '2026', now));
  p.expires_at = new Date(now.getTime() + 1000).toISOString();
  assert.equal(parseInterestPreview(p, '2026', now).length, 1);
});
test('Pages relay is gated, sends only fixed Worker read parameters and fails closed on API errors', async t => {
  const enabled = { request: new Request('https://site.test/api/interest-preview?year=2027&scope=legacy&upstream=https://secret.invalid'), env: { STK_INTEREST_PREVIEW_ENABLED: 'true' } };
  const p = interestContract([], { year: '2027' }); let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls++; assert.equal(url, 'https://stk-master-api.igor-kalsek.workers.dev/site-analytics?scope=recent-interest&year=2027&limit=20');
    assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store');
    return new Response(JSON.stringify(p), { headers: { 'content-type': 'application/json' } });
  });
  assert.equal((await onRequestGet(enabled)).status, 200); assert.equal(calls, 1);
  assert.equal((await onRequestGet({ ...enabled, env: {} })).status, 503); assert.equal(calls, 1);
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, type: 'interest_preview', items: [] }));
  assert.equal((await onRequestGet(enabled)).status, 503);
  globalThis.fetch = async () => { throw Error('private backend URL/token'); };
  const error = await onRequestGet(enabled); assert.equal(error.status, 503); assert.doesNotMatch(await error.text(), /private backend/);
});
