import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateContract, validateSchema, proofMaxAgeMs, activeAtUse } from './contracts/race-watch/validate.mjs';
const fixtures = new URL('./fixtures/race-watch-contract/', import.meta.url);
const read = file => JSON.parse(readFileSync(new URL(file, fixtures)));
const manifest = read('manifest.json');
const base = () => read('positive/01-same-row-reschedule.json');
assert.equal(manifest.synthetic, true);
for (const c of manifest.cases) test(`B0 synthetic: ${c.file}`, () => {
  const payload = read(c.file), result = validateContract(payload);
  assert.equal(result.errors.length === 0, c.valid, JSON.stringify(result.errors));
  if (c.error) assert.ok(result.errors.some(e => e.code === c.error), JSON.stringify(result.errors));
  assert.equal(result.active.length, c.active_count);
  if (c.valid) {
    assert.equal(result.revisions.length, c.revision_count);
    for (const edition of payload.editions) assert.deepEqual(validateSchema('edition', edition), []);
    for (const revision of payload.revisions) assert.deepEqual(validateSchema('revision', revision), []);
  }
});
test('B0 ambiguous identity/alias never yields an active verified change, across all four types', () => {
  for (const status of ['review', 'conflict']) for (const type of ['rescheduled', 'cancelled', 'time_changed', 'venue_changed']) {
    const p = base(), r = p.revisions[0];
    p.editions[0].identity_status = status;
    r.change_type = type;
    if (type === 'cancelled') Object.assign(r, { field: 'status', before: 'scheduled', after: 'cancelled' });
    if (type === 'time_changed') Object.assign(r, { field: 'start_time', before: '09:00', after: '08:00' });
    if (type === 'venue_changed') Object.assign(r, { field: 'venue', before: 'SINTETIČNO A', after: 'SINTETIČNO B' });
    assert.equal(validateContract(p).active.length, 0);
    assert.ok(validateContract(p).errors.some(e => e.code === 'IDENTITY_UNVERIFIED'));
  }
  for (const resolution of ['ambiguous', 'conflict']) {
    const p = base(); p.editions[0].aliases[0].resolution = resolution;
    assert.equal(validateContract(p).active.length, 0);
  }
});
test('B0 global reused alias cannot claim unique even with non-overlapping generations', () => {
  const p = read('positive/05-reused-row-ambiguous-v2.json');
  p.editions[1].aliases[0].resolution = 'unique';
  p.editions[1].aliases[0].proof = structuredClone(base().editions[0].aliases[0].proof);
  assert.ok(validateContract(p).errors.some(e => e.code === 'ALIAS_COLLISION'));
});
test('B0 expiry is exclusive, retained history survives and GET does not renew it', () => {
  const p = base(), r = p.revisions[0];
  p.generated_at = p.period.to = '2026-10-26T11:59:59Z';
  assert.equal(validateContract(p).active.length, 1);
  p.generated_at = p.period.to = r.valid_until;
  assert.ok(validateContract(p).errors.some(e => e.code === 'PROOF_EXPIRED'));
  r.evidence_state = 'expired';
  const result = validateContract(p);
  assert.deepEqual(result.errors, []);
  assert.equal(result.active.length, 0);
  assert.equal(result.revisions.length, 1);
  assert.equal(r.verified_at, '2026-10-19T12:00:00Z');
});
test('B0 proximity shortens maximum evidence age; past dates never regain a longer TTL', () => {
  const p = base(), r = p.revisions[0], e = p.editions[0];
  assert.equal(proofMaxAgeMs(r, e, '2026-09-01T12:00:00Z'), 14 * 86400000);
  assert.equal(proofMaxAgeMs(r, e, '2026-10-19T12:00:00Z'), 7 * 86400000);
  assert.equal(proofMaxAgeMs(r, e, '2026-11-01T12:00:00Z'), 86400000);
  assert.equal(proofMaxAgeMs(r, e, '2027-03-01T12:00:00Z'), 86400000);
  r.before = '2026-10-26'; r.after = '2026-12-01';
  // Seven days at verification => 24 h, so seven-day valid_until is invalid.
  assert.ok(validateContract(p).errors.some(e => e.code === 'PROOF_TTL'));
});
test('B0 Ljubljana civil-day boundaries include spring/autumn DST', () => {
  const p = base(), r = p.revisions[0], e = p.editions[0];
  r.before = r.after = '2026-11-02';
  assert.equal(proofMaxAgeMs(r, e, '2026-10-25T22:59:59Z'), 7 * 86400000);
  assert.equal(proofMaxAgeMs(r, e, '2026-10-25T23:00:00Z'), 86400000);
  r.before = r.after = '2026-04-06';
  assert.equal(proofMaxAgeMs(r, e, '2026-03-29T21:59:59Z'), 7 * 86400000);
  assert.equal(proofMaxAgeMs(r, e, '2026-03-29T22:00:00Z'), 86400000);
});
test('B0 supersession retains predecessor, rejects cycles/dangling references and duplicate sequence', () => {
  const p = base(), first = p.revisions[0];
  first.evidence_state = 'superseded';
  const next = structuredClone(first);
  Object.assign(next, { revision_id: first.revision_id.replace(/1$/, '2'), change_set_id: first.change_set_id.replace(/1$/, '2'), sequence: 2, before: first.after, after: '2026-11-21', evidence_state: 'active', supersedes_revision_id: first.revision_id });
  p.revisions.push(next);
  p.editions[0].public_snapshot.date = next.after;
  assert.deepEqual(validateContract(p).errors, []);
  assert.equal(validateContract(p).active.length, 1);
  first.supersedes_revision_id = next.revision_id;
  assert.ok(validateContract(p).errors.some(e => e.code === 'SUPERSEDES'));
  first.supersedes_revision_id = null; next.sequence = 1;
  assert.ok(validateContract(p).errors.some(e => e.code === 'SEQUENCE'));
});
test('B0 schemas reject unknown properties and preserve opaque identity boundary', () => {
  const p = base();
  p.editions[0].edition_id = 'R999999|2026-11-07';
  assert.ok(validateContract(p).errors.some(e => e.code === 'SCHEMA'));
  const q = base(); q.editions[0].private_email = 'synthetic@example.invalid';
  assert.ok(validateContract(q).errors.some(e => e.code === 'SCHEMA'));
});
test('B0 validator never mutates the supplied snapshot', () => {
  for (const c of manifest.cases) {
    const p = read(c.file), original = structuredClone(p);
    validateContract(p);
    assert.deepEqual(p, original);
  }
});

test('B0 a cached response is re-evaluated at use; identity persists through MOVE and year change', () => {
  const p = base();
  assert.equal(activeAtUse(p, '2026-10-20T12:00:00Z').length, 1);
  assert.equal(activeAtUse(p, '2027-01-10T12:00:00Z').length, 0);
  assert.equal(p.revisions.length, 1);
  for (const file of ['02-new-row-reschedule', '03-cancelled-removed', '12-cross-year-same-edition']) {
    const e = read(`positive/${file}.json`).editions[0];
    assert.equal(e.edition_id, p.editions[0].edition_id);
    assert.equal(e.edition_year, '2026');
  }
  const editions = read('positive/04-same-family-two-editions.json').editions;
  assert.equal(editions[0].race_id, editions[1].race_id);
  assert.notEqual(editions[0].edition_id, editions[1].edition_id);
});
