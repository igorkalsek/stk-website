import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isDistanceInRange,
  matchesRaceDistanceFilter,
  parseRaceDistancesKm
} from '../.cache/dist-test/utils-distance-filter.js';

describe('race distance parsing and filters', () => {
  it('parses semicolon-separated decimal-point distances', () => {
    assert.deepEqual(parseRaceDistancesKm('5;10;21.1'), [5, 10, 21.1]);
  });

  it('handles whitespace and decimal commas safely', () => {
    assert.deepEqual(parseRaceDistancesKm('5 ; 10 ; 21,1'), [5, 10, 21.1]);
  });

  it('ignores malformed tokens', () => {
    assert.deepEqual(parseRaceDistancesKm('5;abc;10 km;5-10;42.2'), [5, 10, 42.2]);
  });

  it('ignores zero and negative values', () => {
    assert.deepEqual(parseRaceDistancesKm('0;-5;10'), [10]);
  });

  it('returns an empty list for missing distances', () => {
    assert.deepEqual(parseRaceDistancesKm(''), []);
    assert.deepEqual(parseRaceDistancesKm(undefined), []);
  });

  it('matches each exact boundary only in its intended range', () => {
    assert.equal(isDistanceInRange(5, 'up-to-5'), true);
    assert.equal(isDistanceInRange(5, 'over-5-to-10'), false);
    assert.equal(isDistanceInRange(10, 'over-5-to-10'), true);
    assert.equal(isDistanceInRange(10, 'over-10-to-half'), false);
    assert.equal(isDistanceInRange(21.1, 'over-10-to-half'), true);
    assert.equal(isDistanceInRange(21.1, 'over-half-to-marathon'), false);
    assert.equal(isDistanceInRange(42.2, 'over-half-to-marathon'), true);
    assert.equal(isDistanceInRange(42.2, 'ultra'), false);
    assert.equal(isDistanceInRange(50, 'ultra'), true);
  });

  it('matches events with several distances when any distance is in range', () => {
    assert.equal(matchesRaceDistanceFilter('5;10;21.1', 'up-to-5'), true);
    assert.equal(matchesRaceDistanceFilter('5;10;21.1', 'over-5-to-10'), true);
    assert.equal(matchesRaceDistanceFilter('5;10;21.1', 'over-10-to-half'), true);
    assert.equal(matchesRaceDistanceFilter('5;10;21.1', 'ultra'), false);
  });

  it('keeps events with no valid distances only when no distance filter is active', () => {
    assert.equal(matchesRaceDistanceFilter('unknown', 'all'), true);
    assert.equal(matchesRaceDistanceFilter('unknown', ''), true);
    assert.equal(matchesRaceDistanceFilter('unknown', 'up-to-5'), false);
  });
});
