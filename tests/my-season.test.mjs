import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getCompletedRaces, getNextAchievement, getSeasonAchievements, getSeasonSummary, normalizeBasicSurface } from '../.cache/dist-test/utils-my-season.js';

const item = (id, { status = 'completed', region = 'Gorenjska', surface = 'cesta', resolved = true } = {}) => ({ key: `2026:${id}`, status: 'past-or-unresolved', savedRace: { version: 2, eventId: id, year: '2026', date: '2026-01-01', title: id, status }, event: resolved ? { id, year: '2026', title: id, date: '2026-01-01', dateValue: 1, region, surface, place: 'Kraj' } : null });
const many = (n, options = {}) => Array.from({ length: n }, (_, index) => item(String(index), typeof options === 'function' ? options(index) : options));
const achievement = (items, key) => getSeasonAchievements(items).find((value) => value.key === key);

describe('My STK season', () => {
  it('counts only completed races and deduplicates keys', () => assert.equal(getCompletedRaces([item('a'), item('a'), item('b', { status: 'planning' })]).length, 1));
  it('counts normalized event regions and basic surfaces, ignoring unresolved references', () => assert.deepEqual({ regions: getSeasonSummary([item('a'), item('b', { region: 'Primorska' }), item('old', { resolved: false })]).regionCount, surfaces: getSeasonSummary([item('a'), item('b', { surface: 'trail' })]).surfaceCount }, { regions: 2, surfaces: 2 }));
  it('handles Debut 0/1, Five 4/5, Ten 9/10, Nomad 5/6 and Veteran 19/20', () => {
    assert.equal(achievement([], 'debut').achieved, false); assert.equal(achievement([item('a')], 'debut').achieved, true);
    assert.equal(achievement(many(4), 'five').achieved, false); assert.equal(achievement(many(5), 'five').achieved, true);
    assert.equal(achievement(many(9), 'ten').achieved, false); assert.equal(achievement(many(10), 'ten').achieved, true);
    assert.equal(achievement(many(5, i => ({ region: `R${i}` })), 'nomad').achieved, false); assert.equal(achievement(many(6, i => ({ region: `R${i}` })), 'nomad').achieved, true);
    assert.equal(achievement(many(19), 'veteran').achieved, false); assert.equal(achievement(many(20), 'veteran').achieved, true);
  });
  it('requires separate road, trail and mountain events for All-terrain', () => {
    assert.equal(achievement([item('r'), item('t', { surface: 'trail' }), item('m', { surface: 'gorski tek' })], 'all-terrain').achieved, true);
    assert.equal(achievement([item('x', { surface: 'cesta/trail' }), item('m', { surface: 'gorski' })], 'all-terrain').achieved, false);
    assert.equal(achievement([item('r'), item('t', { surface: 'trail' })], 'all-terrain').achieved, false);
    assert.equal(normalizeBasicSurface('mixed'), null);
  });
  it('selects the next achievement deterministically and returns null when all are achieved', () => {
    assert.equal(getNextAchievement([])?.key, 'debut'); assert.equal(getNextAchievement(many(1))?.key, 'five');
    const complete = many(20, i => ({ region: `R${i}`, surface: ['cesta', 'trail', 'gorski'][i % 3] })); assert.equal(getNextAchievement(complete), null);
  });
  it('keeps unresolved completed references safe', () => assert.doesNotThrow(() => getSeasonAchievements([item('old', { resolved: false })])));
});
