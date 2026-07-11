import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { getTodayIsoInLjubljana } from '../.cache/dist-test/utils-date.js';

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
