// Synthetic mutations only; regression coverage for PR #236's three P2 findings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateContract, validateSchema } from './contracts/race-watch/validate.mjs';
const read = name => JSON.parse(readFileSync(new URL(`./fixtures/race-watch-contract/positive/${name}.json`, import.meta.url)));
const moved = () => read('02-new-row-reschedule');
const addEarlierBinding = (payload, from, to) => {
  const edition = payload.editions[0];
  const binding = structuredClone(edition.previous_master[0]);
  binding.binding_id = binding.binding_id.replace(/1$/, '3');
  binding.locator.row = 799;
  binding.valid_from = from;
  binding.valid_to = to;
  edition.previous_master.push(binding);
};
for (const scenario of ['previous-current', 'cross-year', 'previous-previous']) {
  test(`B0 P2 intervals: reject same-edition overlap across different locators (${scenario})`, () => {
    const p = scenario === 'cross-year' ? read('12-cross-year-same-edition') : moved();
    if (scenario === 'previous-previous') addEarlierBinding(p, '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z');
    else p.editions[0].current_master.valid_from = '2026-10-18T12:00:00Z';
    assert.deepEqual(validateSchema('response', p), []);
    const result = validateContract(p);
    assert.ok(result.errors.some(e => e.code === 'EDITION_BINDING_OVERLAP'), JSON.stringify(result.errors));
    assert.deepEqual(result.active, []);
  });
}
for (const gap of [false, true]) {
  test(`B0 P2 intervals: accept ${gap ? 'gaps between' : 'touching endpoints of'} same-edition bindings`, () => {
    const p = moved();
    addEarlierBinding(p, '2026-07-01T00:00:00Z', gap ? '2026-07-31T00:00:00Z' : '2026-08-01T00:00:00Z');
    if (gap) p.editions[0].previous_master[0].valid_to = '2026-10-18T12:00:00Z';
    assert.deepEqual(validateContract(p).errors, []);
    assert.equal(validateContract(p).active.length, 1);
  });
}
for (const resolution of ['ambiguous', 'conflict']) {
  for (const history of ['empty', 'expired']) {
    test(`B0 P2 aliases: reject complete coverage with ${resolution} alias and ${history} history`, () => {
      const p = read(history === 'expired' ? '08-expired-proof-return-after-60-days' : '01-same-row-reschedule');
      if (history === 'empty') p.revisions = [];
      p.editions[0].aliases[0].resolution = resolution;
      assert.equal(p.editions[0].identity_status, 'verified');
      assert.deepEqual(validateSchema('response', p), []);
      const result = validateContract(p);
      assert.ok(result.errors.some(e => e.code === 'COVERAGE'), JSON.stringify(result.errors));
      assert.deepEqual(result.active, []);
      // The identity may be known while a legacy alias is unresolved: declare partial.
      p.coverage.completeness = p.coverage.years[0].completeness = 'partial';
      p.coverage.reasons = ['identity_unresolved'];
      const partial = validateContract(p);
      assert.deepEqual(partial.errors, []);
      assert.equal(partial.revisions.length, p.revisions.length);
      assert.deepEqual(partial.active, []);
    });
  }
}
for (const scenario of ['requested-years', 'empty-years']) {
  test(`B0 P2 failure: require unknown completeness for ok:false (${scenario})`, () => {
    const p = read(scenario === 'requested-years' ? '09-upstream-unavailable' : '18-invalid-request-empty-years');
    p.coverage.completeness = 'partial';
    assert.deepEqual(validateSchema('response', p), []);
    const result = validateContract(p);
    assert.ok(result.errors.some(e => e.code === 'AVAILABILITY'), JSON.stringify(result.errors));
    assert.deepEqual(result.active, []);
    // The original unavailable/unknown error envelope remains valid.
    p.coverage.completeness = 'unknown';
    assert.deepEqual(validateContract(p).errors, []);
  });
}
