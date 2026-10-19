// Contract-only audit with synthetic fixtures; no network, storage or production data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateContract, validateSchema } from './contracts/race-watch/validate.mjs';
const read = name => JSON.parse(readFileSync(new URL(`./fixtures/race-watch-contract/positive/${name}.json`, import.meta.url)));
const august = '2026-08-01T00:00:00Z';
const september = '2026-09-01T00:00:00Z';
const emptySnapshot = () => ({ ...read('01-same-row-reschedule'), editions: [], revisions: [] });
const setTimes = (p, annual, aggregate, from = aggregate) => {
  p.coverage.years.forEach((y, i) => { y.history_complete_since = annual[i]; });
  p.coverage.history_complete_since = aggregate;
  p.period.from = from;
};
const invalid = (p, code) => {
  assert.deepEqual(validateSchema('response', p), []);
  const result = validateContract(p);
  assert.ok(result.errors.some(e => e.code === code), JSON.stringify(result.errors));
  assert.deepEqual(result.active, []);
};
for (const annual of [[`${august.slice(0, -1)}.100Z`, august], [august, `${august.slice(0, -1)}.100Z`]]) {
  test(`B0 P2 timestamps: reject aggregate 100 ms earlier than latest year (${annual.join(',')})`, () => {
    const p = emptySnapshot();
    setTimes(p, annual, august);
    invalid(p, 'COVERAGE');
  });
}
for (const [annual, aggregate, from] of [
  [[august, august], '2026-08-01T00:00:00.000Z', august],
  [['2026-08-01T00:00:00.000Z', august], august, '2026-08-01T00:00:00.000Z'],
  [[august, '2026-08-01T00:00:00.100Z'], '2026-08-01T00:00:00.1Z', '2026-08-01T00:00:00.10Z'],
  [[september, august], september, '2026-09-01T00:00:00.000Z']
]) {
  test(`B0 P2 timestamps: accept equivalent UTC boundaries (${aggregate}; ${from})`, () => {
    const p = emptySnapshot();
    setTimes(p, annual, aggregate, from);
    p.period.to = '2026-10-19T12:00:00.000Z';
    assert.deepEqual(validateContract(p).errors, []);
  });
}
test('B0 P2 timestamps: reject oldest annual boundary and a one-millisecond period mismatch', () => {
  const p = emptySnapshot();
  setTimes(p, [august, september], august);
  invalid(p, 'COVERAGE');
  setTimes(p, [august, september], september, '2026-09-01T00:00:00.001Z');
  invalid(p, 'COVERAGE');
});
for (const year of [0, 1]) {
  for (const completeness of ['complete', 'partial']) {
    test(`B0 P2 failed-year: reject unavailable ${2026 + year} claiming ${completeness}`, () => {
      const p = read('09-upstream-unavailable');
      p.coverage.years[year].completeness = completeness;
      invalid(p, 'AVAILABILITY');
    });
  }
  test(`B0 P2 failed-year: reject retained boundary on unavailable ${2026 + year}`, () => {
    const p = read('09-upstream-unavailable');
    p.coverage.years[year].history_complete_since = august;
    invalid(p, 'AVAILABILITY');
  });
}
test('B0 P2 failed-year: reject mixed false claims with both annual boundaries populated', () => {
  const p = read('09-upstream-unavailable');
  p.coverage.years[0].completeness = 'complete';
  p.coverage.years[1].completeness = 'partial';
  setTimes(p, [august, september], september);
  invalid(p, 'AVAILABILITY');
});
test('B0 P2 failed-year: accept unknown/null multi-year, single-year and empty-year errors', () => {
  const multi = read('09-upstream-unavailable');
  const single = structuredClone(multi);
  single.years = ['2026']; single.coverage.years = single.coverage.years.slice(0, 1);
  for (const p of [multi, single, read('18-invalid-request-empty-years')]) {
    assert.deepEqual(validateContract(p).errors, []);
    assert.deepEqual(validateContract(p).active, []);
  }
});
test('B0 P2 failed-year: reject mixed availability under a failed envelope', () => {
  const p = read('09-upstream-unavailable');
  p.coverage.years[0].availability = 'available';
  invalid(p, 'COVERAGE');
});

const availabilityValues = ['available', 'partial', 'unavailable'];
const completenessValues = ['complete', 'partial', 'unknown'];
// Independent contract truth table: 'complete' needs available data + a known boundary;
// unavailable has neither a completeness claim nor a retained history guarantee.
const allowedAnnualStates = new Set([
  'available|complete|known',
  'available|partial|known', 'available|partial|null',
  'available|unknown|known', 'available|unknown|null',
  'partial|partial|known', 'partial|partial|null',
  'partial|unknown|known', 'partial|unknown|null',
  'unavailable|unknown|null'
]);
test('B0 coverage audit: all 5832 annual/aggregate availability, completeness and ok combinations', () => {
  const annualStates = availabilityValues.flatMap(availability => completenessValues.flatMap(completeness => [null, august].map(history_complete_since => ({ availability, completeness, history_complete_since }))));
  let checked = 0;
  const mismatches = [];
  for (const first of annualStates) for (const second of annualStates) {
    const rows = [first, second];
    const states = rows.map(y => `${y.availability}|${y.completeness}|${y.history_complete_since === null ? 'null' : 'known'}`);
    const annualValid = states.every(state => allowedAnnualStates.has(state));
    const allUnavailable = rows.every(y => y.availability === 'unavailable');
    const allAvailable = rows.every(y => y.availability === 'available');
    const expectedAvailability = allAvailable ? 'available' : allUnavailable ? 'unavailable' : 'partial';
    const completePossible = states.every(state => state === 'available|complete|known');
    for (const availability of availabilityValues) for (const completeness of completenessValues) for (const ok of [true, false]) {
      const p = emptySnapshot();
      p.coverage.years = rows.map((y, i) => ({ year: String(2026 + i), ...y }));
      p.coverage.availability = availability;
      p.coverage.completeness = completeness;
      p.coverage.history_complete_since = p.period.from = rows.some(y => y.history_complete_since === null) ? null : august;
      p.coverage.reasons = availability === 'available' && completeness === 'complete' ? [] : [allUnavailable ? 'upstream_timeout' : 'history_gap'];
      p.ok = ok;
      p.error = ok ? null : { code: 'UPSTREAM_UNAVAILABLE', retryable: true };
      const expected = annualValid && availability === expectedAvailability && ok === !allUnavailable &&
        (completeness !== 'complete' || completePossible) && (ok || completeness === 'unknown');
      const result = validateContract(p);
      if ((result.errors.length === 0) !== expected) mismatches.push({ states, availability, completeness, ok, expected, errors: result.errors });
      if (!expected) assert.deepEqual(result.active, []);
      checked++;
    }
  }
  assert.equal(checked, 5832);
  assert.equal(mismatches.length, 0, JSON.stringify(mismatches.slice(0, 8)));
});
for (const mutation of [
  p => { p.years.reverse(); p.coverage.years.reverse(); },
  p => { p.coverage.years.pop(); },
  p => { p.coverage.years[1].year = '2026'; },
  p => { p.coverage.reasons = ['history_gap']; },
  p => { p.coverage.completeness = 'partial'; },
  p => { p.coverage.years[1].history_complete_since = '2026-10-19T12:00:00.001Z'; p.coverage.history_complete_since = p.period.from = p.coverage.years[1].history_complete_since; }
]) {
  test(`B0 coverage audit: reject inconsistent years, reasons or future boundary (${mutation.toString()})`, () => {
    const p = emptySnapshot(); mutation(p); invalid(p, 'COVERAGE');
  });
}
test('B0 coverage audit: successful years must be supported, unsupported years remain valid in errors', () => {
  const p = emptySnapshot();
  p.years = ['2028']; p.coverage.years = [{ ...p.coverage.years[0], year: '2028' }];
  invalid(p, 'COVERAGE');
  const failure = read('09-upstream-unavailable');
  failure.years = ['2028']; failure.coverage.years = [{ ...failure.coverage.years[0], year: '2028' }];
  failure.error = { code: 'UNSUPPORTED_YEAR', retryable: false }; failure.coverage.reasons = ['request_rejected'];
  assert.deepEqual(validateContract(failure).errors, []);
});
for (const mutation of [
  e => { e.identity_status = 'review'; },
  e => { e.identity_status = 'conflict'; },
  e => { e.aliases[0].resolution = 'ambiguous'; },
  e => { e.aliases[0].resolution = 'conflict'; }
]) {
  test(`B0 coverage audit: complete annual claim cannot hide unresolved identity (${mutation.toString()})`, () => {
    const p = read('01-same-row-reschedule');
    p.revisions = []; mutation(p.editions[0]);
    p.coverage.completeness = 'partial'; p.coverage.reasons = ['identity_unresolved'];
    invalid(p, 'COVERAGE');
    p.coverage.years[0].completeness = 'partial';
    assert.deepEqual(validateContract(p).errors, []);
  });
}
test('B0 coverage audit: unavailable-year data cannot leak into an otherwise usable partial snapshot', () => {
  const p = read('10-upstream-partial');
  Object.assign(p.coverage.years[0], { availability: 'unavailable', completeness: 'unknown', history_complete_since: null });
  Object.assign(p.coverage.years[1], { availability: 'available', completeness: 'complete', history_complete_since: august });
  invalid(p, 'COVERAGE');
  const crossYear = read('12-cross-year-same-edition');
  Object.assign(crossYear.coverage, { availability: 'partial', completeness: 'partial', history_complete_since: null, reasons: ['upstream_timeout'] });
  crossYear.period.from = null;
  Object.assign(crossYear.coverage.years[0], { availability: 'unavailable', completeness: 'unknown', history_complete_since: null });
  const result = validateContract(crossYear);
  assert.deepEqual(result.errors, []);
  assert.equal(result.active.length, 1); // The same exact edition is available via requested 2027.
});
const retryableErrors = new Set(['UPSTREAM_UNAVAILABLE', 'INVALID_UPSTREAM']);
for (const code of ['INVALID_REQUEST', 'UNSUPPORTED_CONTRACT', 'UNSUPPORTED_YEAR', 'UPSTREAM_UNAVAILABLE', 'INVALID_UPSTREAM', 'CONTRACT_CONFLICT', 'PAYLOAD_LIMIT', 'METHOD_NOT_ALLOWED']) {
  test(`B0 coverage audit: retryable flag follows the documented error class (${code})`, () => {
    const p = read('09-upstream-unavailable');
    p.error = { code, retryable: !retryableErrors.has(code) };
    invalid(p, 'AVAILABILITY');
    p.error.retryable = retryableErrors.has(code);
    assert.deepEqual(validateContract(p).errors, []);
  });
}
test('B0 coverage audit: error envelopes exclude payload data; successful empty scopes remain valid', () => {
  const p = read('09-upstream-unavailable');
  p.editions = read('01-same-row-reschedule').editions;
  invalid(p, 'AVAILABILITY');
  p.editions = []; p.revisions = read('01-same-row-reschedule').revisions;
  invalid(p, 'AVAILABILITY');
  p.revisions = []; p.error = null; invalid(p, 'AVAILABILITY');
  const success = emptySnapshot();
  assert.deepEqual(validateContract(success).errors, []);
  success.error = { code: 'INVALID_REQUEST', retryable: false }; invalid(success, 'AVAILABILITY');
});
for (const identity of ['verified', 'review', 'conflict']) for (const resolution of ['unique', 'ambiguous', 'conflict']) {
  test(`B0 coverage audit: active proof requires verified identity and unique aliases (${identity}/${resolution})`, () => {
    const p = read('01-same-row-reschedule');
    p.editions[0].identity_status = identity; p.editions[0].aliases[0].resolution = resolution;
    p.coverage.completeness = p.coverage.years[0].completeness = 'partial'; p.coverage.reasons = ['identity_unresolved'];
    if (identity === 'verified' && resolution === 'unique') assert.equal(validateContract(p).active.length, 1);
    else invalid(p, 'IDENTITY_UNVERIFIED');
  });
}
for (const state of ['expired', 'retracted', 'conflict']) {
  test(`B0 temporal audit: historical proof TTL cannot exceed its original policy (${state})`, () => {
    const p = read('08-expired-proof-return-after-60-days');
    const r = p.revisions[0];
    for (const field of ['confirmed_at', 'verified_at', 'recorded_at', 'published_at']) r[field] = '2026-09-01T12:00:00Z';
    r.evidence_state = state;
    r.retracted_at = state === 'retracted' ? '2026-09-17T12:00:00Z' : null;
    r.valid_until = '2026-09-16T12:00:00Z'; // 15 days exceeds the 14-day maximum at verification.
    invalid(p, 'PROOF_TTL');
    r.valid_until = '2026-09-15T12:00:00Z';
    assert.deepEqual(validateContract(p).errors, []);
    assert.equal(validateContract(p).revisions.length, 1);
  });
}
test('B0 temporal audit: millisecond expiry, renewal, future effect and invalid calendar dates', () => {
  const p = read('01-same-row-reschedule');
  p.generated_at = p.period.to = '2026-10-26T11:59:59.999Z';
  assert.equal(validateContract(p).active.length, 1);
  for (const time of ['2026-10-26T12:00:00.000Z', '2026-10-26T12:00:00.001Z']) {
    p.generated_at = p.period.to = time; invalid(p, 'PROOF_EXPIRED');
  }
  const renewed = read('01-same-row-reschedule');
  renewed.generated_at = renewed.period.to = renewed.revisions[0].verified_at = '2026-10-20T12:00:00Z';
  renewed.revisions[0].effective_at = '2026-11-07T08:00:00Z';
  assert.deepEqual(validateContract(renewed).errors, []);
  renewed.revisions[0].verified_at = '2026-10-20T12:00:00.001Z'; invalid(renewed, 'REVISION_TIME');
  for (const date of ['2026-02-29', '2026-02-30']) {
    const bad = read('01-same-row-reschedule'); bad.editions[0].public_snapshot.date = date;
    assert.ok(validateSchema('response', bad).length);
  }
});
test('B0 coverage audit: null boundaries, empty-year failures and schema enums never become successful guarantees', () => {
  const p = emptySnapshot();
  p.coverage.completeness = 'partial'; p.coverage.reasons = ['history_gap'];
  p.coverage.years[0].completeness = 'partial';
  setTimes(p, [null, september], null);
  assert.deepEqual(validateContract(p).errors, []);
  p.period.from = september; invalid(p, 'COVERAGE');
  const empty = read('18-invalid-request-empty-years');
  empty.ok = true; empty.error = null; invalid(empty, 'AVAILABILITY');
  for (const mutate of [
    value => { value.years.push('2026'); },
    value => { value.coverage.availability = 'stale'; },
    value => { value.coverage.years[0].completeness = 'unverified'; }
  ]) {
    const bad = emptySnapshot(); mutate(bad);
    assert.ok(validateContract(bad).errors.some(e => e.code === 'SCHEMA'));
    assert.deepEqual(validateContract(bad).active, []);
  }
});
test('B0 status audit: active lifecycle status and exact event fields must match; history remains independent', () => {
  for (const [name, expected] of [['11-date-pending', 'postponed'], ['03-cancelled-removed', 'cancelled']]) {
    for (const status of ['scheduled', 'postponed', 'cancelled', 'completed', 'unknown']) {
      const p = read(name); p.editions[0].canonical_status = status;
      if (status === expected) assert.equal(validateContract(p).active.length, 1);
      else invalid(p, 'SNAPSHOT');
    }
  }
  for (const [name, field, wrong] of [['01-same-row-reschedule', 'date', '2026-11-21'], ['13-event-time-change', 'start_time', '10:00'], ['14-venue-change', 'venue', 'SINTETIČNO druga lokacija']]) {
    const p = read(name); p.editions[0].public_snapshot[field] = wrong; invalid(p, 'SNAPSHOT');
  }
  const route = read('15-route-time-change');
  assert.deepEqual(validateContract(route).errors, []); // Route-specific time is not the event-wide start time.
});
test('B0 temporal audit: unknown event date has a seven-day cap; future history and source times fail', () => {
  const p = read('03-cancelled-removed'); p.editions[0].public_snapshot.date = null;
  assert.deepEqual(validateContract(p).errors, []);
  p.revisions[0].valid_until = '2026-10-27T12:00:00Z'; invalid(p, 'PROOF_TTL');
  for (const mutate of [
    value => { value.editions[0].history_complete_since = '2026-10-19T12:00:00.001Z'; },
    value => { value.editions[0].current_master.proof.verified_at = '2026-10-19T12:00:00.001Z'; },
    value => { value.editions[0].aliases[0].proof.verified_at = '2026-10-19T12:00:00.001Z'; },
    value => { value.revisions[0].source_published_at = '2026-10-19T12:00:00.001Z'; }
  ]) {
    const bad = read('01-same-row-reschedule'); mutate(bad);
    assert.ok(validateContract(bad).errors.length);
    assert.deepEqual(validateContract(bad).active, []);
  }
});
