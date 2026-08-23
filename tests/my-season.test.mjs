import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { formatSeasonRegionLabel, formatSeasonSurfaceLabel, formatSloveneCount, getCompletedRaces, getNextAchievement, getNextSavedRace, getSeasonAchievements, getSeasonRegionProgress, getSeasonSummary, normalizeBasicSurface } from '../.cache/dist-test/utils-my-season.js';
import { getInitialMyRacesView } from '../.cache/dist-test/utils-my-races.js';
import { renderSeason } from '../.cache/dist-test/my-races-client.js';
import { attachMyStkAdditionalData, enrichMyStkWhenReady, renderMyStkNextRace } from '../.cache/dist-test/my-stk-client.js';

const item = (id, { year = '2026', status = 'completed', timing = 'past-or-unresolved', region = 'Gorenjska', surface = 'cesta', resolved = true } = {}) => ({ key: `${year}:${id}`, status: timing, savedRace: { version: 2, eventId: id, year, date: `${year}-08-01`, title: id, status }, event: resolved ? { id, year, title: id, date: `${year}-08-01`, dateValue: 1, region, surface, place: 'Kraj' } : null });
const canonicalRegions = ['Pomurska', 'Podravska', 'Koroška', 'Savinjska', 'Zasavska', 'Posavska', 'Jugovzhodna', 'Primorsko-notranjska', 'Osrednjeslovenska', 'Gorenjska', 'Goriška', 'Obalno-kraška'];
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
    const six = many(6, i => ({ region: canonicalRegions[i] })); const eight = many(8, i => ({ region: canonicalRegions[i] }));
    assert.equal(achievement(six, 'nomad').achieved, true);
    assert.equal(getSeasonRegionProgress(six, canonicalRegions.slice(0, 8)).filter((r) => r.visited).length, 6);
    assert.equal(getSeasonRegionProgress(eight, canonicalRegions.slice(0, 8)).filter((r) => r.visited).length, 8);
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
    assert.equal(getNextAchievement(many(20, i => ({ region: canonicalRegions[i % canonicalRegions.length], surface: ['cesta', 'trail', 'gorski'][i % 3] }))), null);
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
  it('renders linked live stamps, unlinked legacy stamps, and decorative surface symbols', () => {
    const legacy = { ...item('legacy', { resolved: false }), snapshot: { version: 1, eventId: 'legacy', year: '2026', date: '2026-08-01', title: 'Stari tek', place: 'Celje', region: 'Savinjska', surface: 'trail' } };
    const html = renderSeason([item('road'), item('trail', { surface: 'trail' }), item('mountain', { surface: 'gorski tek' }), legacy], canonicalRegions, 'sl');
    assert.match(html, /<a class="season-stamp is-road" href="\/tek\/2026\//);
    assert.match(html, /<article class="season-stamp is-unresolved is-trail">[\s\S]*Stari tek[\s\S]*podrobnosti niso več na voljo/);
    assert.doesNotMatch(html.match(/<article class="season-stamp is-unresolved[\s\S]*?<\/article>/)?.[0] ?? '', /href=/);
    assert.match(html, /season-stamp is-trail/); assert.match(html, /season-stamp is-mountain/);
    assert.equal((html.match(/season-stamp-icon/g) ?? []).length, 4);
    for (const svg of html.match(/<svg class="(?:season-stamp-icon|achievement-symbol)"[\s\S]*?<\/svg>/g) ?? []) assert.doesNotMatch(svg, /tabindex|focusable/);
  });
  it('uses neutral stamps and truthful localized labels for mixed and non-standard surfaces', () => {
    const races = [item('road'), item('trail', { surface: 'trail' }), item('mountain', { surface: 'gorski tek' }), item('mixed', { surface: 'cesta/trail' }), item('gravel', { surface: 'makadam' })];
    const getStamp = (html, id) => (html.match(/<a class="season-stamp [^"]+"[^>]*>[\s\S]*?<\/a>/g) ?? []).find((stamp) => stamp.includes(`<strong>${id}</strong>`)) ?? '';
    const sl = renderSeason(races, canonicalRegions, 'sl');
    const en = renderSeason(races, canonicalRegions, 'en');
    assert.match(getStamp(sl, 'road'), /data-surface-icon="road"[\s\S]*STK · cesta/);
    assert.match(getStamp(sl, 'trail'), /data-surface-icon="trail"[\s\S]*STK · trail/);
    assert.match(getStamp(sl, 'mountain'), /data-surface-icon="mountain"[\s\S]*STK · gorski tek/);
    for (const [id, slLabel, enLabel] of [['mixed', 'cesta\/trail', 'Road\/trail'], ['gravel', 'makadam', 'Gravel road']]) {
      const slStamp = getStamp(sl, id); const enStamp = getStamp(en, id);
      assert.match(slStamp, /class="season-stamp is-other"/); assert.match(enStamp, /class="season-stamp is-other"/);
      assert.match(slStamp, /data-surface-icon="other"/); assert.match(enStamp, /data-surface-icon="other"/);
      assert.match(slStamp, new RegExp(`STK · ${slLabel}`)); assert.match(enStamp, new RegExp(`STK · ${enLabel}`));
      assert.doesNotMatch(slStamp, /data-surface-icon="road"|STK · Cesta/); assert.doesNotMatch(enStamp, /data-surface-icon="road"|STK · Road(?:<|\s)/);
      const icon = slStamp.match(/<svg class="season-stamp-icon"[\s\S]*?<\/svg>/)?.[0] ?? '';
      assert.match(icon, /aria-hidden="true"/); assert.doesNotMatch(icon, /tabindex|focusable/);
    }
  });
  it('reserves mobile stamp space for the seal and switches narrow passports to one column', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');
    const mobileRule = css.indexOf('.season-stamp { min-height: 108px;');
    const mobile = css.slice(css.lastIndexOf('@media (max-width: 720px)', mobileRule), mobileRule + 100);
    const narrowRule = css.indexOf('.season-passport { grid-template-columns: 1fr; }', mobileRule);
    const narrow = css.slice(css.lastIndexOf('@media (max-width: 600px)', narrowRule), narrowRule + 70);
    assert.match(mobile, /\.season-stamp \{ min-height: 108px; padding: \.7rem 4\.3rem \.7rem \.7rem; \}/);
    assert.match(narrow, /\.season-passport \{ grid-template-columns: 1fr; \}/);
    assert.match(css, /\.season-stamp-seal \{[^}]*right: \.75rem;[^}]*width: 3rem;[^}]*height: 3rem;/);
  });
  it('renders equivalent localized achievement states without changing thresholds', () => {
    const races = many(3, i => ({ region: canonicalRegions[i], surface: i === 0 ? 'cesta' : 'trail' }));
    const sl = renderSeason(races, canonicalRegions, 'sl');
    const en = renderSeason(races, canonicalRegions, 'en');
    const emptySl = renderSeason([], canonicalRegions, 'sl');
    const emptyEn = renderSeason([], canonicalRegions, 'en');
    for (const [key, target] of [['debut', 1], ['five', 5], ['ten', 10], ['nomad', 6], ['all-terrain', 3], ['veteran', 20]]) {
      assert.match(sl, new RegExp(`data-achievement="${key}"[\\s\\S]*?<progress max="${target}"`));
    }
    assert.match(sl, /data-achievement-state="achieved"[\s\S]*Osvojeno/);
    assert.match(sl, /data-achievement-state="next"[\s\S]*Naslednji dosežek/);
    assert.match(sl, /data-achievement-state="active"[\s\S]*V napredku/);
    assert.match(emptySl, /data-achievement-state="locked"[\s\S]*Zaklenjeno/);
    assert.match(en, /data-achievement-state="achieved"[\s\S]*Achieved/);
    assert.match(en, /data-achievement-state="next"[\s\S]*Next achievement/);
    assert.match(en, /data-achievement-state="active"[\s\S]*In progress/);
    assert.match(emptyEn, /data-achievement-state="locked"[\s\S]*Locked/);
    assert.equal((sl.match(/<svg class="achievement-symbol" aria-hidden="true"/g) ?? []).length, 6);
  });
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

describe('Slovenia regional progress map', () => {
  it('maps all 12 regions and preserves visited progress without recalculating it', async () => {
    const { getSloveniaMapRegions, SLOVENIA_STATISTICAL_REGIONS } = await import('../.cache/dist-test/utils-slovenia-map.js');
    const progress = getSeasonRegionProgress([item('a'), item('b', { region: 'Goriška' })], SLOVENIA_STATISTICAL_REGIONS.map((region) => region.sl));
    const mapped = getSloveniaMapRegions(progress, 'sl');
    assert.equal(mapped.length, 12);
    assert.equal(mapped.filter((region) => region.visited).length, 2);
    assert.equal(mapped.find((region) => region.sl === 'Gorenjska').completedEventCount, 1);
    assert.equal(mapped.find((region) => region.sl === 'Pomurska').visited, false);
    const southeast = getSloveniaMapRegions([{ key: 'jugovzhodna', label: 'Jugovzhodna', visited: true, completedEventCount: 1 }], 'en').find((region) => region.nuts === 'SI037');
    assert.equal(southeast.visited, true);
    assert.equal(southeast.completedEventCount, 1);
    assert.equal(southeast.label, 'Southeast Slovenia');
  });

  it('renders localized accessible empty and visited states with the same geometry', async () => {
    const { renderSloveniaRegionsMap } = await import('../.cache/dist-test/utils-slovenia-map.js');
    const empty = renderSloveniaRegionsMap([], 'sl');
    assert.equal((empty.match(/class="slovenia-map-region/g) ?? []).length, 12);
    assert.match(empty, /Obiskanih je 0 od 12 statističnih regij/);
    assert.match(empty, /Gorenjska: še ni obiskana, brez opravljenih tekov/);
    const visited = renderSloveniaRegionsMap([{ key: 'gorenjska', label: 'Gorenjska', visited: true, completedEventCount: 2 }], 'en', 'compact');
    assert.equal((visited.match(/data-visited="true"/g) ?? []).length, 1);
    assert.match(visited, /Upper Carniola: visited, 2 completed races/);
    assert.match(visited, /Mura region: not visited, no completed races/);
    assert.doesNotMatch(visited, /Gorenjska:/);
    assert.doesNotMatch(visited, /tabindex=/);
    assert.doesNotMatch(visited, /role="listitem"/);
    assert.match(visited, /class="slovenia-map-outline"/);
  });

  it('renders a complete screen-reader list beside the compact home map', async () => {
    const { renderSloveniaRegionStatusList } = await import('../.cache/dist-test/utils-slovenia-map.js');
    const list = renderSloveniaRegionStatusList([{ key: 'gorenjska', label: 'Gorenjska', visited: true, completedEventCount: 2 }], 'sl', 'sr-only');
    assert.match(list, /class="slovenia-map-status-list sr-only"/);
    assert.equal((list.match(/<li>/g) ?? []).length, 12);
    assert.match(list, /Gorenjska: obiskana, 2 opravljena teka\./);
    assert.match(list, /Pomurska: še ni obiskana, brez opravljenih tekov\./);
    const homeClient = readFileSync(new URL('../src/my-stk-client.ts', import.meta.url), 'utf8');
    assert.match(homeClient, /renderSloveniaRegionStatusList\(regions, language, 'sr-only'\)/);
  });

  it('uses the shared Slovene grammar for regional completed-race counts', async () => {
    const { renderSloveniaRegionStatusList } = await import('../.cache/dist-test/utils-slovenia-map.js');
    const expected = new Map([[1, '1 opravljen tek'], [2, '2 opravljena teka'], [3, '3 opravljeni teki'], [4, '4 opravljeni teki'], [5, '5 opravljenih tekov'], [22, '22 opravljena teka'], [23, '23 opravljeni teki'], [24, '24 opravljeni teki'], [25, '25 opravljenih tekov']]);
    for (const [count, label] of expected) {
      assert.equal(formatSloveneCount(count, 'completed-race'), label);
      const list = renderSloveniaRegionStatusList([{ key: 'gorenjska', label: 'Gorenjska', visited: true, completedEventCount: count }], 'sl');
      assert.match(list, new RegExp(`Gorenjska: obiskana, ${label}\\.`));
    }
  });

  it('ignores unknown legacy regions in map counters and the Nomad achievement', async () => {
    const { getSloveniaMapRegions } = await import('../.cache/dist-test/utils-slovenia-map.js');
    const items = [...canonicalRegions.map((region, index) => item(`canonical-${index}`, { region })), item('legacy', { region: 'Stara napačna regija' })];
    const progress = getSeasonRegionProgress(items, [...canonicalRegions, 'Stara napačna regija']);
    const mapped = getSloveniaMapRegions(progress, 'sl');
    const visitedMapRegions = mapped.filter((region) => region.visited).length;
    assert.equal(mapped.length, 12);
    assert.equal(visitedMapRegions, 12);
    assert.equal(getSeasonSummary(items).regionCount, visitedMapRegions);
    assert.ok(visitedMapRegions <= 12);
    const legacyOnly = [item('legacy-only', { region: 'Stara napačna regija' })];
    assert.equal(getSeasonSummary(legacyOnly).regionCount, 0);
    assert.equal(achievement(legacyOnly, 'nomad').current, 0);
  });

  it('merges canonical aliases into one visited region and sums completed races', async () => {
    const { getSloveniaMapRegions, renderSloveniaRegionsMap, renderSloveniaRegionStatusList } = await import('../.cache/dist-test/utils-slovenia-map.js');
    const aliases = [
      { key: 'jugovzhodna', label: 'Jugovzhodna', visited: true, completedEventCount: 1 },
      { key: 'jugovzhodna slovenija', label: 'Jugovzhodna Slovenija', visited: true, completedEventCount: 2 }
    ];
    const mapped = getSloveniaMapRegions(aliases, 'sl');
    const southeast = mapped.filter((region) => region.nuts === 'SI037');
    assert.equal(southeast.length, 1);
    assert.equal(southeast[0].visited, true);
    assert.equal(southeast[0].completedEventCount, 3);
    const map = renderSloveniaRegionsMap(aliases, 'sl', 'full');
    assert.equal((map.match(/data-visited="true"/g) ?? []).length, 1);
    assert.match(map, /Jugovzhodna Slovenija: obiskana, 3 opravljeni teki\./);
    assert.match(renderSloveniaRegionStatusList(aliases, 'sl'), /Jugovzhodna Slovenija: obiskana, 3 opravljeni teki\./);
  });

  it('supports the complete state and shares one renderer between season and home', async () => {
    const { renderSloveniaRegionsMap, SLOVENIA_STATISTICAL_REGIONS } = await import('../.cache/dist-test/utils-slovenia-map.js');
    const complete = SLOVENIA_STATISTICAL_REGIONS.map((region) => ({ key: region.key, label: region.sl, visited: true, completedEventCount: 1 }));
    assert.equal((renderSloveniaRegionsMap(complete, 'en').match(/data-visited="true"/g) ?? []).length, 12);
    const seasonClient = readFileSync(new URL('../src/my-races-client.ts', import.meta.url), 'utf8');
    const homeClient = readFileSync(new URL('../src/my-stk-client.ts', import.meta.url), 'utf8');
    assert.match(seasonClient, /renderSloveniaRegionsMap\(regionProgress, language, 'full'\)/);
    assert.match(homeClient, /renderSloveniaRegionsMap\(regions, language, 'compact'\)/);
    assert.doesNotMatch(renderSloveniaRegionsMap(complete, 'sl', 'compact'), /tabindex=/);
  });
});
