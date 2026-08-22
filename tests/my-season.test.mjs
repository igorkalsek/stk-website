import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { formatSloveneCount, getCompletedRaces, getNextAchievement, getNextSavedRace, getSeasonAchievements, getSeasonRegionProgress, getSeasonSummary, normalizeBasicSurface } from '../.cache/dist-test/utils-my-season.js';
import { getInitialMyRacesView } from '../.cache/dist-test/utils-my-races.js';

const item = (id, { year = '2026', status = 'completed', timing = 'past-or-unresolved', region = 'Gorenjska', surface = 'cesta', resolved = true } = {}) => ({ key: `${year}:${id}`, status: timing, savedRace: { version: 2, eventId: id, year, date: `${year}-08-01`, title: id, status }, event: resolved ? { id, year, title: id, date: `${year}-08-01`, dateValue: 1, region, surface, place: 'Kraj' } : null });
const many = (n, options = {}) => Array.from({ length: n }, (_, index) => item(String(index), typeof options === 'function' ? options(index) : options));
const achievement = (items, key, year = '2026') => getSeasonAchievements(items, year).find((value) => value.key === key);

describe('My STK season', () => {
  it('counts only completed races and deduplicates keys', () => assert.equal(getCompletedRaces([item('a'), item('a'), item('b', { status: 'planning' })]).length, 1));
  it('scopes summaries and achievements to one public year', () => {
    const planning2027 = [item('done'), item('plan', { year: '2027', status: 'planning' })];
    assert.equal(getSeasonSummary(planning2027, '2026').completedCount, 1);
    const both = [item('26'), item('27', { year: '2027' })];
    assert.equal(getSeasonSummary(both, '2026').completedCount, 1); assert.equal(getSeasonSummary(both, '2027').completedCount, 1);
  });
  it('selects only a non-completed upcoming next race', () => {
    assert.equal(getNextSavedRace([item('today', { timing: 'upcoming' })]), null);
    assert.equal(getNextSavedRace([item('future-complete', { timing: 'upcoming' })]), null);
    assert.equal(getNextSavedRace([item('registered', { status: 'registered', timing: 'upcoming' })])?.savedRace.eventId, 'registered');
    assert.equal(getNextSavedRace([item('planning', { status: 'planning', timing: 'upcoming' })])?.savedRace.eventId, 'planning');
    assert.equal(getNextSavedRace([item('past', { status: 'following' })]), null);
  });
  it('builds reusable regional progress, deduplicates labels and ignores blanks', () => {
    const progress = getSeasonRegionProgress([item('a'), item('b', { region: ' gorenjska ' }), item('c', { region: 'Goriška' })], ['', 'Gorenjska', 'gorenjska', 'Goriška', 'Savinjska']);
    assert.deepEqual(progress.map(({ key, visited, completedEventCount }) => [key, visited, completedEventCount]), [['gorenjska', true, 2], ['goriška', true, 1], ['savinjska', false, 0]]);
    assert.equal(getSeasonRegionProgress([], ['A', 'B']).filter((r) => r.visited).length, 0);
  });
  it('keeps Nomad as a six-region milestone while region progress continues to Y/Y', () => {
    const six = many(6, i => ({ region: `R${i}` })); const eight = many(8, i => ({ region: `R${i}` }));
    assert.equal(achievement(six, 'nomad').achieved, true);
    assert.equal(getSeasonRegionProgress(six, many(8).map((_, i) => `R${i}`)).filter((r) => r.visited).length, 6);
    assert.equal(getSeasonRegionProgress(eight, many(8).map((_, i) => `R${i}`)).filter((r) => r.visited).length, 8);
  });
  it('handles achievement thresholds', () => {
    assert.equal(achievement([], 'debut').achieved, false); assert.equal(achievement([item('a')], 'debut').achieved, true);
    assert.equal(achievement(many(4), 'five').achieved, false); assert.equal(achievement(many(5), 'five').achieved, true);
    assert.equal(achievement(many(9), 'ten').achieved, false); assert.equal(achievement(many(10), 'ten').achieved, true);
    assert.equal(achievement(many(19), 'veteran').achieved, false); assert.equal(achievement(many(20), 'veteran').achieved, true);
  });
  it('requires separate road, trail and mountain events for All-terrain', () => {
    assert.equal(achievement([item('r'), item('t', { surface: 'trail' }), item('m', { surface: 'gorski tek' })], 'all-terrain').achieved, true);
    assert.equal(achievement([item('x', { surface: 'cesta/trail' }), item('m', { surface: 'gorski' })], 'all-terrain').achieved, false);
    assert.equal(normalizeBasicSurface('mixed'), null);
  });
  it('selects the next achievement deterministically and handles all complete', () => {
    assert.equal(getNextAchievement([])?.key, 'debut'); assert.equal(getNextAchievement(many(1))?.key, 'five');
    assert.equal(getNextAchievement(many(20, i => ({ region: `R${i}`, surface: ['cesta', 'trail', 'gorski'][i % 3] }))), null);
  });
  it('formats Slovene race, region and achievement counts', () => {
    for (const [kind, expected] of [['completed-race', ['1 opravljen tek','2 opravljena teka','3 opravljeni teki','5 opravljenih tekov']], ['region', ['1 regija','2 regiji','3 regije','5 regij']], ['achievement', ['1 dosežek','2 dosežka','3 dosežki','5 dosežkov']]]) assert.deepEqual([1,2,3,5].map((n) => formatSloveneCount(n, kind)), expected);
  });
  it('keeps unresolved references safe', () => assert.doesNotThrow(() => getSeasonAchievements([item('old', { resolved: false })])));
  it('keeps live stats outside async dashboard replacement', () => {
    const client = readFileSync('src/my-stk-client.ts', 'utf8'); const home = readFileSync('src/pages/index.astro', 'utf8');
    assert.doesNotMatch(client, /outerHTML/); assert.match(client, /content\.innerHTML/); assert.match(home, /data-my-stk-content[\s\S]*data-my-stk-global-stats/);
  });
  it('keeps the My STK region labelled after onboarding and dashboard renders in both locales', () => {
    const client = readFileSync('src/my-stk-client.ts', 'utf8');
    const sl = readFileSync('src/pages/index.astro', 'utf8');
    const en = readFileSync('src/pages/en/index.astro', 'utf8');
    assert.equal((client.match(/<h2 id="my-stk-title">/g) ?? []).length, 2);
    assert.match(sl, /aria-labelledby="my-stk-title"/);
    assert.match(en, /aria-labelledby="my-stk-title"/);
    assert.match(client, /\? 'My STK' : 'Moj STK'/);
  });
  it('uses one localized season deep-link contract while ordinary visits keep the plan view', () => {
    assert.equal(getInitialMyRacesView(''), 'plan');
    assert.equal(getInitialMyRacesView('?view=plan'), 'plan');
    assert.equal(getInitialMyRacesView('?view=season'), 'season');
    assert.equal(getInitialMyRacesView('?view=season&source=home'), 'season');
    const client = readFileSync('src/my-stk-client.ts', 'utf8');
    assert.match(client, /\/moji-teki\/\?view=season/);
    assert.match(client, /\/en\/my-races\/\?view=season/);
  });
});
