// Synthetic mutations only; regression coverage for PR #236's P2 findings.
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

for (const status of ['scheduled', 'cancelled', 'completed', 'unknown']) {
  test(`B0 P2 pending: reject active null-date reschedule with ${status} status`, () => {
    const p = read('11-date-pending');
    p.editions[0].canonical_status = status;
    assert.deepEqual(validateSchema('response', p), []);
    const result = validateContract(p);
    assert.ok(result.errors.some(e => e.code === 'SNAPSHOT'), JSON.stringify(result.errors));
    assert.deepEqual(result.active, []);
  });
}
test('B0 P2 pending: accept active postponed and dated scheduled reschedules', () => {
  for (const name of ['11-date-pending', '01-same-row-reschedule']) {
    const result = validateContract(read(name));
    assert.deepEqual(result.errors, []);
    assert.equal(result.active.length, 1);
  }
});
for (const state of ['expired', 'retracted']) {
  test(`B0 P2 pending: ${state} null-date history does not force current postponed status`, () => {
    const p = read('11-date-pending');
    p.editions[0].canonical_status = 'scheduled';
    p.revisions[0].evidence_state = state;
    if (state === 'expired') p.generated_at = p.period.to = '2027-01-10T12:00:00Z';
    else p.revisions[0].retracted_at = p.generated_at;
    const result = validateContract(p);
    assert.deepEqual(result.errors, []);
    assert.equal(result.revisions.length, 1);
    assert.deepEqual(result.active, []);
  });
}
const august = '2026-08-01T00:00:00Z';
const september = '2026-09-01T00:00:00Z';
const october = '2026-10-01T00:00:00Z';
const setHistoryCoverage = (p, year2026, year2027, aggregate) => {
  p.coverage.years[0].history_complete_since = year2026;
  p.coverage.years[1].history_complete_since = year2027;
  p.coverage.history_complete_since = p.period.from = aggregate;
};
for (const scenario of ['aggregate', 'edition-year', 'current-master', 'alias-only', 'second-edition', 'unknown-boundary', 'partial-aggregate-complete-year']) {
  test(`B0 P2 history: reject unsupported complete history (${scenario})`, () => {
    const crossYear = ['edition-year', 'current-master', 'alias-only'].includes(scenario);
    const p = read(crossYear ? '12-cross-year-same-edition' : scenario === 'second-edition' ? '04-same-family-two-editions' : '01-same-row-reschedule');
    const e = p.editions[scenario === 'second-edition' ? 1 : 0];
    e.history_complete_since = october;
    if (crossYear) {
      e.history_complete_since = september;
      if (scenario === 'edition-year') {
        setHistoryCoverage(p, august, october, october);
        e.aliases = e.aliases.filter(a => a.year === '2027');
      } else {
        setHistoryCoverage(p, october, august, october);
        if (scenario === 'current-master') e.aliases = e.aliases.filter(a => a.year === '2026');
        else {
          // Retain 2027 only as an explicit historical alias, with no current locator.
          e.previous_master[0].valid_to = '2026-10-18T12:00:00Z';
          e.current_master.valid_from = e.previous_master[0].valid_to;
          e.current_master.valid_to = p.generated_at;
          e.previous_master.push(e.current_master);
          e.current_master = null;
        }
      }
    }
    if (scenario === 'unknown-boundary') setHistoryCoverage(p, null, august, null);
    if (scenario === 'partial-aggregate-complete-year') {
      p.coverage.completeness = 'partial';
      p.coverage.reasons = ['history_gap'];
      // 2026 still promises complete history from August; the aggregate warning is insufficient.
    }
    assert.deepEqual(validateSchema('response', p), []);
    const result = validateContract(p);
    assert.ok(result.errors.some(error => error.code === 'COVERAGE'), JSON.stringify(result.errors));
    assert.deepEqual(result.active, []);
  });
}
for (const boundary of [august, '2026-08-01T00:00:00.000Z', '2026-07-01T00:00:00Z']) {
  test(`B0 P2 history: accept edition history covering the advertised boundary (${boundary})`, () => {
    const p = read('01-same-row-reschedule');
    p.editions[0].history_complete_since = boundary;
    assert.deepEqual(validateContract(p).errors, []);
    assert.equal(validateContract(p).active.length, 1);
  });
}
test('B0 P2 history: compare each edition with its applicable year, not unrelated years', () => {
  const p = read('01-same-row-reschedule');
  setHistoryCoverage(p, october, august, october);
  p.editions[0].history_complete_since = september;
  assert.deepEqual(validateContract(p).errors, []);
  setHistoryCoverage(p, august, october, october);
  p.editions[0].history_complete_since = august;
  assert.deepEqual(validateContract(p).errors, []);
});
test('B0 P2 history: accept an explicitly partial affected year while retaining known revisions', () => {
  const p = read('01-same-row-reschedule');
  p.editions[0].history_complete_since = october;
  p.coverage.completeness = p.coverage.years[0].completeness = 'partial';
  p.coverage.reasons = ['history_gap'];
  const result = validateContract(p);
  assert.deepEqual(result.errors, []);
  assert.equal(result.revisions.length, 1);
  assert.equal(result.active.length, 1);
});
