import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { formatRaceDateStatus, getTodayIsoInLjubljana } from '../.cache/dist-test/utils-date.js';

describe('race-profile relative date: Europe/Ljubljana calendar days', () => {
  it('changes at Ljubljana midnight, not UTC or build time', () => {
    const before = getTodayIsoInLjubljana(new Date('2026-11-06T22:30:00Z'));
    const after = getTodayIsoInLjubljana(new Date('2026-11-06T23:30:00Z'));
    assert.equal(before, '2026-11-06');
    assert.equal(after, '2026-11-07');
    assert.equal(formatRaceDateStatus('2026-11-07', 'sl', before), 'Prihaja čez 1 dan');
    assert.equal(formatRaceDateStatus('2026-11-07', 'en', after), 'Today');
    assert.equal(formatRaceDateStatus('2026-11-07', 'sl', after), 'Danes');
  });

  it('distinguishes future, today, past and invalid dates in both languages', () => {
    assert.equal(formatRaceDateStatus('2026-11-08', 'en', '2026-11-06'), 'Coming in 2 days');
    assert.equal(formatRaceDateStatus('2026-11-07', 'sl', '2026-11-06'), 'Prihaja čez 1 dan');
    assert.equal(formatRaceDateStatus('2026-11-05', 'en', '2026-11-06'), 'This race has already passed');
    assert.equal(formatRaceDateStatus('2026-11-05', 'sl', '2026-11-06'), 'Dogodek je že mimo');
    assert.equal(formatRaceDateStatus('2026-02-31', 'sl', '2026-02-01'), '');
    assert.equal(formatRaceDateStatus('invalid', 'en', '2026-11-06'), '');
  });

  it('does not miscount calendar days when clocks change in March', () => {
    assert.equal(getTodayIsoInLjubljana(new Date('2027-03-27T23:30:00Z')), '2027-03-28');
    assert.equal(formatRaceDateStatus('2027-03-29', 'en', '2027-03-28'), 'Coming in 1 day');
    assert.equal(getTodayIsoInLjubljana(new Date('2027-03-28T22:30:00Z')), '2027-03-29');
    assert.equal(formatRaceDateStatus('2027-03-29', 'en', '2027-03-29'), 'Today');
  });

  it('uses client status markup without stale build-time labels on both profiles', () => {
    for (const path of ['src/pages/tek/[year]/[slug].astro', 'src/pages/en/races/[year]/[slug].astro']) {
      const markup = readFileSync(path, 'utf8');
      assert.match(markup, /data-race-date-status/);
      assert.match(markup, /data-event-date=\{event.date\}/);
      assert.match(markup, /initRaceDateStatuses\(\)/);
      assert.doesNotMatch(markup, /getDateStatus|const eventStatus =/);
    }
  });
});
