import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRegistrationDeadlineViews, formatRegistrationDeadlineRelative, getDaysBetweenIsoDates, parseRegistrationDeadlineDate } from '../.cache/dist-test/utils-registration-deadlines.js';

describe('registration deadline utilities', () => {
  it('accepts only strict valid ISO dates', () => {
    assert.equal(parseRegistrationDeadlineDate('2026-07-16'), '2026-07-16');
    assert.equal(parseRegistrationDeadlineDate('2026-7-16'), '');
    assert.equal(parseRegistrationDeadlineDate('2026-02-30'), '');
    assert.equal(parseRegistrationDeadlineDate(null), '');
  });
  it('calculates date-only differences deterministically', () => assert.equal(getDaysBetweenIsoDates('2026-07-15', '2026-07-20'), 5));
  it('builds future, tomorrow, today and past states', () => {
    const views = ['2026-07-20','2026-07-16','2026-07-15','2026-07-14'].map((date) => buildRegistrationDeadlineViews({ todayIso: '2026-07-15', eventDate: '2026-08-01', registrationDeadline: date })[0]);
    assert.deepEqual(views.map((v) => v.state), ['future','tomorrow','today','past']);
  });
  it('formats Slovenian singular/plural and dedicated labels', () => {
    assert.equal(formatRegistrationDeadlineRelative({ kind: 'registration', date: '2026-07-17', daysRemaining: 2, state: 'future' }, 'sl'), 'Prijave se zaprejo čez 2 dni');
    assert.equal(formatRegistrationDeadlineRelative({ kind: 'registration', date: '2026-07-16', daysRemaining: 1, state: 'tomorrow' }, 'sl'), 'Prijave se zaprejo jutri');
    assert.equal(formatRegistrationDeadlineRelative({ kind: 'early', date: '2026-07-15', daysRemaining: 0, state: 'today' }, 'sl'), 'Cenejša prijava se konča danes');
    assert.equal(formatRegistrationDeadlineRelative({ kind: 'early', date: '2026-07-14', daysRemaining: -1, state: 'past' }, 'sl'), 'Rok cenejše prijave je potekel');
  });
  it('formats English labels', () => {
    assert.equal(formatRegistrationDeadlineRelative({ kind: 'early', date: '2026-07-20', daysRemaining: 5, state: 'future' }, 'en'), 'Early registration ends in 5 days');
    assert.equal(formatRegistrationDeadlineRelative({ kind: 'registration', date: '2026-07-14', daysRemaining: -1, state: 'past' }, 'en'), 'The registration deadline has passed');
  });
  it('orders early before final and deduplicates identical dates as registration', () => {
    assert.deepEqual(buildRegistrationDeadlineViews({ todayIso: '2026-07-01', eventDate: '2026-08-01', earlyRegistrationDeadline: '2026-07-10', registrationDeadline: '2026-07-20' }).map((d) => d.kind), ['early','registration']);
    assert.deepEqual(buildRegistrationDeadlineViews({ todayIso: '2026-07-01', eventDate: '2026-08-01', earlyRegistrationDeadline: '2026-07-20', registrationDeadline: '2026-07-20' }).map((d) => d.kind), ['registration']);
  });
  it('ignores deadlines after event date and handles missing inputs safely', () => {
    assert.deepEqual(buildRegistrationDeadlineViews({ todayIso: '2026-07-01', eventDate: '2026-07-10', registrationDeadline: '2026-07-11' }), []);
    assert.equal(buildRegistrationDeadlineViews({ todayIso: '2026-07-01', registrationDeadline: '2026-07-11' })[0].date, '2026-07-11');
    assert.deepEqual(buildRegistrationDeadlineViews({ todayIso: '2026-07-01' }), []);
  });
});
