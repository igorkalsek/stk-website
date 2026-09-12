import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatActiveFinderFilterCount, formatFinderRecoveryAction, getActiveFinderFilters, getFinderRecoverySuggestions, removeActiveFinderFilter } from '../.cache/dist-test/utils-finder-active-filters.js';
import { parseFinderUrlState } from '../.cache/dist-test/utils-finder-url-state.js';
import { readFileSync } from 'node:fs';

const full = parseFinderUrlState(new URLSearchParams('year=2027&q=Triglav&month=08&region=Gorenjska&surface=Trail&distance=over-10-to-half&fee=20&deadline=within-14&sort=registration-deadline&family=1&raceDay=1&route=1&elevation=max-800&quick=deadlines-soon,budget,trail,kids'));
const lookup = { surface: { Trail: 'Trail' }, fee: { 20: 'Do 20 €' }, deadline: { 'within-14': 'Rok v 14 dneh' }, sort: { 'registration-deadline': 'Roki prijav najprej' }, elevation: { 'max-800': 'Do 800 m+' } };
const sl = readFileSync(new URL('../src/finder/race-finder-controller.ts', import.meta.url), 'utf8');
const en = sl;
const slPage = readFileSync(new URL('../src/pages/iskalnik-tekov.astro', import.meta.url), 'utf8');
const enPage = readFileSync(new URL('../src/pages/en/find-races.astro', import.meta.url), 'utf8');

describe('active finder filters utility', () => {
  it('empty state returns no active filters', () => assert.deepEqual(getActiveFinderFilters({}, 'sl'), []));
  it('default values are hidden', () => assert.deepEqual(getActiveFinderFilters({ year: '2026', distance: 'all', sort: 'date', quick: [] }, 'sl'), []));
  it('all public filters receive chips', () => assert.equal(getActiveFinderFilters(full, 'sl', lookup).length, 16));
  it('quick picks receive individual chips', () => assert.deepEqual(getActiveFinderFilters(full, 'sl', lookup).filter((c) => c.kind === 'quick').map((c) => c.label), ['Roki se iztekajo', 'Poceni teki', 'Trail izzivi', 'Z otroki']));
  it('chips have a stable order', () => assert.deepEqual(getActiveFinderFilters(full, 'sl', lookup).map((c) => c.kind), ['q','month','region','surface','distance','fee','deadline','family','raceDay','route','elevation','sort','quick','quick','quick','quick']));
  it('uses Slovenian labels', () => assert.deepEqual(getActiveFinderFilters(full, 'sl', lookup).slice(0, 3).map((c) => c.label), ['Iskanje: Triglav', 'Avgust', 'Gorenjska']));
  it('uses English labels', () => assert.deepEqual(getActiveFinderFilters(full, 'en', { ...lookup, fee: { 20: 'Up to €20' } }).slice(0, 3).map((c) => c.label), ['Search: Triglav', 'August', 'Gorenjska']));
  it('removes q', () => assert.equal(removeActiveFinderFilter(full, 'q').q, ''));
  it('removes month', () => assert.equal(removeActiveFinderFilter(full, 'month').month, ''));
  it('removes region', () => assert.equal(removeActiveFinderFilter(full, 'region').region, ''));
  it('removes boolean filter', () => assert.equal(removeActiveFinderFilter(full, 'family').family, false));
  it('removes public sort by returning it to date', () => assert.equal(removeActiveFinderFilter(full, 'sort').sort, 'date'));
  it('removes one quick pick and keeps the others', () => assert.deepEqual(removeActiveFinderFilter(full, 'quick', 'budget').quick, ['deadlines-soon', 'trail', 'kids']));
  it('my-races is not shown', () => assert.equal(getActiveFinderFilters({ sort: 'my-races' }, 'sl').length, 0));
  it('preferences are not shown', () => assert.doesNotMatch(JSON.stringify(getActiveFinderFilters(full, 'sl')), /preference|Teki zame|Races for me/));
  it('year is not shown', () => assert.equal(getActiveFinderFilters({ year: '2027' }, 'sl').length, 0));
  it('formats localized counts', () => assert.deepEqual([1,2,3,5].map((n) => formatActiveFinderFilterCount(n, 'sl')), ['1 filter','2 filtra','3 filtri','5 filtrov']));
});

describe('finder no-results recovery utility', () => {
  const countMatches = (events) => (state) => events.filter((event) =>
    (!state.q || event.title.toLocaleLowerCase('sl-SI').includes(state.q.toLocaleLowerCase('sl-SI')))
    && (!state.region || event.region === state.region)
    && (state.distance === 'all' || event.distance === state.distance)
    && (!state.family || event.family)
    && (!state.quick.includes('trail') || event.trail)
  ).length;
  const events = [
    { title: 'Alpine trail', region: 'Gorenjska', distance: 'ultra', family: false, trail: true },
    { title: 'City five', region: 'Podravska', distance: 'up-to-5', family: true, trail: false },
    { title: 'Forest ten', region: 'Savinjska', distance: 'over-5-to-10', family: true, trail: true },
    { title: 'River ten', region: 'Goriška', distance: 'over-5-to-10', family: false, trail: true }
  ];

  it('offers a filter whose removal restores results and omits one that still returns zero', () => {
    const suggestions = getFinderRecoverySuggestions(
      { region: 'Primorska', distance: 'ultra' },
      'sl',
      countMatches(events),
      { region: { Primorska: 'Primorska' }, distance: { ultra: 'Nad 42,2 km' } }
    );
    assert.deepEqual(suggestions.map(({ filter, resultCount }) => [filter.kind, resultCount]), [['region', 1]]);
  });

  it('sorts multiple recoveries by result count, uses active-filter order for ties, and caps the list at three', () => {
    const suggestions = getFinderRecoverySuggestions(
      { q: 'missing', region: 'Gorenjska', distance: 'up-to-5', family: true, quick: ['trail'], sort: 'registration-min' },
      'en',
      (state) => ({ q: 8, region: 5, distance: 5, family: 3, quick: 2 }[
        !state.q ? 'q' : !state.region ? 'region' : state.distance === 'all' ? 'distance' : !state.family ? 'family' : !state.quick.length ? 'quick' : 'none'
      ] ?? 0)
    );
    assert.deepEqual(suggestions.map(({ filter, resultCount }) => [filter.kind, resultCount]), [['q', 8], ['region', 5], ['distance', 5]]);
    assert.equal(suggestions.some(({ filter }) => filter.kind === 'sort'), false);
  });

  it('supports query, boolean, and quick-pick candidates', () => {
    const suggestions = getFinderRecoverySuggestions(
      { q: 'missing', family: true, quick: ['trail'] },
      'en',
      (state) => !state.q ? 4 : !state.family ? 3 : !state.quick.length ? 2 : 0
    );
    assert.deepEqual(suggestions.map(({ filter }) => filter.kind), ['q', 'family', 'quick']);
  });

  it('formats safe localized query, quick-pick, and result-count labels', () => {
    const [query] = getActiveFinderFilters({ q: '<script>' }, 'en');
    const [quick] = getActiveFinderFilters({ quick: ['trail'] }, 'sl');
    const [family] = getActiveFinderFilters({ family: true }, 'en');
    const [region] = getActiveFinderFilters({ region: 'Gorenjska' }, 'sl');
    assert.equal(formatFinderRecoveryAction(query, 'en', '4 races'), 'Remove search "<script>" · 4 races');
    assert.equal(formatFinderRecoveryAction(quick, 'sl', '2 dogodka'), 'Odstranite "Trail izzivi" · 2 dogodka');
    assert.equal(formatFinderRecoveryAction(family, 'en', '1 race'), 'Remove Family-friendly · 1 race');
    assert.equal(formatFinderRecoveryAction(region, 'sl', '3 dogodki'), 'Odstranite Regija: Gorenjska · 3 dogodki');
  });

  it('returns no suggestion when no single removal restores results', () => {
    assert.deepEqual(getFinderRecoverySuggestions({ q: 'missing', region: 'Primorska' }, 'sl', () => 0), []);
  });
});

describe('active finder filters page wiring', () => {
  it('URL hydration restores chips', () => { for (const page of [sl,en]) assert.match(page, /applyFinderUrlStateToControls\(stateForYear\(initialUrlState, activeYear\)\)[\s\S]*renderResults\(\);[\s\S]*syncUrlFromControls\(\)/); });
  it('popstate restores chips without analytics', () => { for (const page of [sl,en]) { const i = page.indexOf('restoreFromCurrentUrl'); assert.match(page.slice(i, i + 500), /state\.userInteracted = false/); assert.doesNotMatch(page.slice(i, i + 500), /trackStkEvent/); } });
  it('clear hides the active filter block via canonical state', () => { for (const page of [sl,en]) assert.match(page, /syncUrlFromControls\(clearFinderUrlState\(activeYear\)\)/); });
  it('Slovenian and English finder use the same controller and active filter utility', () => {
    assert.match(slPage, /initializeRaceFinder\(sloveneRaceFinderLocale\)/);
    assert.match(enPage, /initializeRaceFinder\(englishRaceFinderLocale\)/);
    assert.match(sl, /utils-finder-active-filters/);
  });
  it('chip listener has no manual analytics call', () => { for (const page of [sl,en]) { const i = page.indexOf('removeActiveFilterChip'); assert.doesNotMatch(page.slice(i, i + 900), /trackStkEvent/); } });
  it('search debounce is cancelled before removing a filter', () => { for (const page of [sl,en]) assert.match(page, /const removeActiveFilterChip[\s\S]*if \(searchUrlTimer\) window\.clearTimeout\(searchUrlTimer\)/); });
  it('main results and recovery simulations reuse the same side-effect-free matcher', () => {
    for (const page of [sl,en]) {
      assert.match(page, /state\.filtered = filterFinderEvents\(filters, deferAdditionalSelection\)/);
      assert.match(page, /\(finderState\) => filterFinderEvents\(getFiltersForFinderState\(finderState\), false\)\.length/);
      const start = page.indexOf('const filterFinderEvents');
      assert.doesNotMatch(page.slice(start, page.indexOf('let searchAnalyticsTimer', start)), /trackStkEvent|renderResults|fetch\(/);
    }
  });
});

describe('quick-pick derived filter rebuild contract', () => {
  const pages = [sl, en];
  it('empty finder block is hidden and CSS removes its layout space', () => {
    const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
    for (const page of [slPage, enPage]) assert.match(page, /<div class="active-filters" data-active-filters hidden>/);
    assert.match(css, /\.active-filters\[hidden\]\s*{\s*display:\s*none;/);
  });
  it('quick trail creates only its quick chip in the visual summary', () => assert.deepEqual(getActiveFinderFilters({ quick: ['trail'] }, 'sl').map((chip) => chip.label), ['Trail izzivi']));
  it('quick-derived controls are resolved from canonical URL state', () => {
    for (const page of pages) {
      assert.match(page, /const resolveFinderStateWithQuickPicks/);
      assert.match(page, /quickPick === 'budget'[\s\S]*resolved\.fee = '20'/);
      assert.match(page, /quickPick === 'kids'[\s\S]*resolved\.family = true/);
      assert.match(page, /quickPick === 'route'[\s\S]*resolved\.route = true/);
      assert.match(page, /quickPick === 'deadlines-soon'[\s\S]*resolved\.deadline = 'within-14'[\s\S]*resolved\.sort = 'registration-deadline'/);
      assert.match(page, /quickPick === 'first-race'[\s\S]*resolved\.surface = beginnerSurface/);
    }
  });
  it('removing a quick chip rebuilds from canonical URL state, renders once, and syncs once', () => {
    for (const page of pages) {
      const start = page.indexOf('const removeActiveFilterChip');
      const body = page.slice(start, page.indexOf('  const applyPublicSortState', start));
      assert.match(body, /removeActiveFinderFilter\(getFinderUrlStateForUrl\(\), kind, value\)/);
      assert.match(body, /rebuildControlsFromFinderState\(stateForYear\(nextState, activeYear\)\)/);
      assert.equal((body.match(/renderResults\(\)/g) ?? []).length, 1);
      assert.equal((body.match(/syncUrlFromControls\(\)/g) ?? []).length, 1);
    }
  });
  it('direct manual filters are stored separately from selected quick picks', () => {
    for (const page of pages) {
      assert.match(page, /let directFinderState: FinderUrlState/);
      assert.match(page, /updateDirectFinderStateFromControl\(event\.target\)/);
      assert.match(page, /rebuildControlsFromFinderState\(\{ \.\.\.directFinderState, year: activeYear, quick: \[\.\.\.selectedQuickPicks\] \}\)/);
    }
  });
  it('invalid chip kinds are guarded before state changes', () => {
    assert.equal(getActiveFinderFilters({ quick: ['trail'], surface: 'Trail' }, 'sl', { surface: { Trail: 'Trail' } }).map((chip) => chip.label).join('|'), 'Trail|Trail izzivi');
    for (const page of pages) {
      const start = page.indexOf('const removeActiveFilterChip');
      const body = page.slice(start, page.indexOf('  const applyPublicSortState', start));
      assert.match(body, /if \(!isActiveFilterKind\(kind\)\)/);
      assert.match(body, /return;/);
    }
  });
  it('Slovenian and English pages keep matching direct and derived rebuild logic', () => {
    const snippets = ['resolveFinderStateWithQuickPicks', 'rebuildControlsFromFinderState', 'getFinderUrlStateForUrl', 'updateDirectFinderStateFromControl'];
    for (const snippet of snippets) assert.equal(sl.includes(snippet), en.includes(snippet));
  });
});
