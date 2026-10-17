import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { formatRaceDateBadge, getTodayIsoInLjubljana } from '../.cache/dist-test/utils-date.js';

describe('getTodayIsoInLjubljana', () => {
  it('uses the Europe/Ljubljana date during summer time', () => {
    assert.equal(getTodayIsoInLjubljana(new Date('2026-07-11T21:59:59Z')), '2026-07-11');
    assert.equal(getTodayIsoInLjubljana(new Date('2026-07-11T22:00:00Z')), '2026-07-12');
  });

  it('uses the Europe/Ljubljana date during winter time', () => {
    assert.equal(getTodayIsoInLjubljana(new Date('2026-12-31T22:59:59Z')), '2026-12-31');
    assert.equal(getTodayIsoInLjubljana(new Date('2026-12-31T23:00:00Z')), '2027-01-01');
  });

  it('returns the expected date during ordinary daytime hours', () => {
    assert.equal(getTodayIsoInLjubljana(new Date('2026-03-15T12:34:56Z')), '2026-03-15');
  });
});

describe('shared Ljubljana today helper usage', () => {
  it('keeps my-races-client on the shared helper instead of UTC ISO slicing', () => {
    const source = readFileSync(new URL('../src/my-races-client.ts', import.meta.url), 'utf8');
    assert.match(source, /getTodayIsoInLjubljana/);
    assert.doesNotMatch(source, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  });
});

describe('compact race card dates', () => {
  it('keeps a consistent weekday and short date in SL/EN', () => {
    assert.equal(formatRaceDateBadge('2026-11-07', 'sl'), 'SOB · 7. nov.');
    assert.equal(formatRaceDateBadge('2026-11-15', 'sl'), 'NED · 15. nov.');
    assert.equal(formatRaceDateBadge('2026-09-13', 'en'), 'SUN · 13 Sep');
  });
  it('includes an explicit year for a different season or mixed-year list', () => {
    assert.equal(formatRaceDateBadge('2027-06-12', 'sl', true), 'SOB · 12. jun. 2027');
    assert.equal(formatRaceDateBadge('2027-06-12', 'en', true), 'SAT · 12 Jun 2027');
    assert.equal(formatRaceDateBadge('2026-12-31', 'en', true), 'THU · 31 Dec 2026');
  });
  it('does not invent a date when input is absent or invalid', () => {
    assert.equal(formatRaceDateBadge('', 'sl'), '');
    assert.equal(formatRaceDateBadge('not-a-date', 'en'), 'not-a-date');
  });
});
