import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { formatSeasonRegionLabel, formatSeasonSurfaceLabel, formatSloveneCount, getCompletedRaces, getNextAchievement, getNextSavedRace, getSeasonAchievements, getSeasonRegionProgress, getSeasonSummary, normalizeBasicSurface } from '../.cache/dist-test/utils-my-season.js';
import { getInitialMyRacesView } from '../.cache/dist-test/utils-my-races.js';
import { attachMyStkAdditionalData, enrichMyStkWhenReady, renderMyStkNextRace } from '../.cache/dist-test/my-stk-client.js';

const item = (id, { year = '2026', status = 'completed', timing = 'past-or-unresolved', region = 'Gorenjska', surface = 'cesta', resolved = true } = {}) => ({ key: `${year}:${id}`, status: timing, savedRace: { version: 2, eventId: id, year, date: `${year}-08-01`, title: id, status }, event: resolved ? { id, year, title: id, date: `${year}-08-01`, dateValue: 1, region, surface, place: 'Kraj' } : null });
const many = (n, options = {}) => Array.from({ length: n }, (_, index) => item(String(index), typeof options === 'function' ? options(index) : options));
const achievement = (items, key, year = '2026') => getSeasonAchievements(items, year).find((value) => value.key === key);

describe('My STK review regressions', () => {
  it('joins additional data with the stable sheet-row event key and renders its deadline', () => {
    const event = { id: '', row: '101', year: '2026', title: 'Testni tek', naziv_prireditve: 'Testni tek', date: '2026-09-20', dateValue: 1, place: 'Kraj', region: 'Gorenjska', surface: 'cesta', distances: '', startTime: '', noticeUrl: '', registrationUrl: '', voteUrl: '', publicNotes: '', cup: '', familyFriendly: false, kidsRaces: false, displayTitle: 'Testni tek' };
    const race = { key: '2026:r000101', status: 'upcoming', savedRace: { version: 2, eventId: 'r000101', year: '2026', date: event.date, title: event.title, status: 'planning' }, event };
    const additional = [{ year: '2026', masterSheet: '2026', masterRow: '101', masterRowNumber: 101, date: event.date, eventTitle: event.title, reliability: 'visoka', registrationDeadline: '2026-09-10', earlyRegistrationDeadline: '', organizer: '', organizerWebsite: '', distances: '', surface: '', startTime: '', registrationUrl: '', noticeUrl: '', publicNotes: '', cup: '', familyFriendly: '', kidsRaces: '', feeMin: '', feeMax: '', raceDayRegistration: '', routeUrl: '', elevationGain: '' }];
    const [enriched] = attachMyStkAdditionalData([race], new Map([['2026', additional]]), ['2026']);
    assert.equal(enriched.event.additionalData.registrationDeadline, '2026-09-10');
    assert.match(renderMyStkNextRace(enriched, 'sl', '2026-08-23', '/iskalnik-tekov/'), /Naslednji prijavni rok[\s\S]*10\. sep/);
  });

  it('renders before controlled optional enrichment, applies its deadline, and rejects a stale render', async () => {
    const event = { id: '', row: '101', year: '2026', title: 'Testni tek', naziv_prireditve: 'Testni tek', date: '2026-09-20', dateValue: 1, place: 'Kraj', region: 'Gorenjska', surface: 'cesta', distances: '', startTime: '', noticeUrl: '', registrationUrl: '', voteUrl: '', publicNotes: '', cup: '', familyFriendly: false, kidsRaces: false, displayTitle: 'Testni tek' };
    const race = { key: '2026:r000101', status: 'upcoming', savedRace: { version: 2, eventId: 'r000101', year: '2026', date: event.date, title: event.title, status: 'planning' }, event };
    const additional = [{ year: '2026', masterSheet: '2026', masterRow: '101', masterRowNumber: 101, date: event.date, eventTitle: event.title, reliability: 'visoka', registrationDeadline: '2026-09-10', earlyRegistrationDeadline: '' }];
    let resolveAdditional;
    const pendingAdditional = new Promise((resolve) => { resolveAdditional = resolve; });
    let card = renderMyStkNextRace(race, 'sl', '2026-08-23', '/iskalnik-tekov/');
    const enrichment = enrichMyStkWhenReady([race], new Map([['2026', pendingAdditional]]), ['2026'], () => true, ([enriched]) => { card = renderMyStkNextRace(enriched, 'sl', '2026-08-23', '/iskalnik-tekov/'); });
    assert.match(card, /Testni tek/);
    assert.doesNotMatch(card, /Naslednji prijavni rok/);
    resolveAdditional(additional);
    await enrichment;
    assert.match(card, /Naslednji prijavni rok[\s\S]*10\. sep/);

    const currentCard = card;
    let resolveStale;
    const stalePending = new Promise((resolve) => { resolveStale = resolve; });
    const staleEnrichment = enrichMyStkWhenReady([race], new Map([['2026', stalePending]]), ['2026'], () => false, () => { card = 'stale render'; });
    resolveStale(additional);
    await staleEnrichment;
    assert.equal(card, currentCard);
  });

  it('clears localized statistic skeleton semantics after values load', () => {
    for (const file of ['src/pages/index.astro', 'src/pages/en/index.astro']) {
      const source = readFileSync(file, 'utf8');
      assert.match(source, /element\.textContent = value/);
      assert.match(source, /element\.classList\.remove\('stat-loading'\)/);
      assert.match(source, /element\.removeAttribute\('aria-label'\)/);
    }
  });
});

describe('My STK season', () => {
  it('counts only completed races and deduplicates keys', () => assert.equal(getCompletedRaces([item('a'), item('a'), item('b', { status: 'planning' })]).length, 1));
  it('scopes completed races to one public year at a deterministic date', () => {
    const planning2027 = [item('done'), item('plan', { year: '2027', status: 'planning' })];
    assert.equal(getCompletedRaces(planning2027, '2026', '2026-08-23').length, 1);
    const both = [item('26'), item('27', { year: '2027' })];
    assert.equal(getCompletedRaces(both, '2026', '2026-08-23').length, 1); assert.equal(getCompletedRaces(both, '2027', '2026-08-23').length, 0);
  });
  it('counts yesterday and today but rejects tomorrow defensively', () => { const dates = ['2026-08-21', '2026-08-22', '2026-08-23']; const rows = dates.map((date, i) => ({ ...item(String(i)), savedRace: { ...item(String(i)).savedRace, date }, event: { ...item(String(i)).event, date } })); assert.deepEqual(getCompletedRaces(rows, '2026', '2026-08-22').map((row) => row.savedRace.date), dates.slice(0, 2)); });
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
  it('includes snapshot-only regions once and keeps the denominator consistent', () => {
    const unresolved = { ...item('archived', { resolved: false }), snapshot: { version: 1, eventId: 'archived', year: '2026', date: '2026-08-01', title: 'Archived', place: 'Kraj', region: ' Gorenjska ', surface: 'cesta' } };
    const liveWithSameSnapshot = { ...item('live', { region: 'gorenjska' }), snapshot: { version: 1, eventId: 'live', year: '2026', date: '2026-08-01', title: 'Live', place: 'Kraj', region: 'GORENJSKA', surface: 'cesta' } };
    const items = [unresolved, liveWithSameSnapshot];
    const progress = getSeasonRegionProgress(items, ['Gorenjska'], '2026', '2026-08-23');
    assert.deepEqual(progress.map(({ key, label, visited, completedEventCount }) => [key, label, visited, completedEventCount]), [['gorenjska', 'Gorenjska', true, 2]]);
    assert.ok(getSeasonSummary(items, '2026', '2026-08-23').regionCount <= progress.length);
    assert.equal(formatSeasonRegionLabel(progress[0].label, 'en'), 'Upper Carniola');
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
  it('localizes API region and surface labels only for the English season view', () => {
    assert.equal(formatSeasonRegionLabel('Gorenjska', 'en'), 'Upper Carniola');
    assert.equal(formatSeasonRegionLabel('Osrednjeslovenska', 'en'), 'Central Slovenia');
    const canonicalSurfaces = ['cesta', 'asfalt', 'makadam', 'trail', 'cesta/trail', 'gorski tek'];
    assert.deepEqual(canonicalSurfaces.map((surface) => formatSeasonSurfaceLabel(surface, 'en')), ['Road', 'Asphalt', 'Gravel road', 'Trail', 'Road/trail', 'Mountain race']);
    assert.equal(formatSeasonRegionLabel('Gorenjska', 'sl'), 'Gorenjska');
    assert.equal(formatSeasonSurfaceLabel('cesta', 'sl'), 'cesta');
    assert.doesNotMatch(formatSeasonRegionLabel('Gorenjska', 'en'), /Gorenjska/);
    assert.doesNotMatch(['asfalt', 'makadam', 'gorski tek'].map((surface) => formatSeasonSurfaceLabel(surface, 'en')).join(' · '), /asfalt|makadam|gorski tek/i);
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
  it('refreshes My STK re-entrantly without duplicate listeners or stale async renders', () => {
    const client = readFileSync('src/my-stk-client.ts', 'utf8');
    assert.match(client, /new WeakMap<HTMLElement, MyStkRuntime>/);
    assert.match(client, /if \(!runtime\.listening[\s\S]*addEventListener\(SAVED_RACES_CHANGED_EVENT/);
    assert.match(client, /const renderVersion = \+\+runtime\.renderVersion/);
    assert.match(client, /runtime\.renderVersion !== renderVersion/);
    assert.match(client, /if \(!runtime\.viewed\)[\s\S]*my_stk_viewed/);
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
