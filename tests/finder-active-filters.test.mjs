import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getActiveFinderFilters, removeActiveFinderFilter, formatActiveFinderFilterCount } from '../.cache/dist-test/utils-finder-active-filters.js';
import { parseFinderUrlState } from '../.cache/dist-test/utils-finder-url-state.js';
import { readFileSync } from 'node:fs';

const full = parseFinderUrlState(new URLSearchParams('year=2027&q=Triglav&month=08&region=Gorenjska&surface=Trail&distance=over-10-to-half&fee=20&deadline=within-14&sort=registration-deadline&family=1&raceDay=1&route=1&elevation=max-800&quick=deadlines-soon,budget,trail,kids'));
const lookup = { surface: { Trail: 'Trail' }, fee: { 20: 'Do 20 €' }, deadline: { 'within-14': 'Rok v 14 dneh' }, sort: { 'registration-deadline': 'Roki prijav najprej' }, elevation: { 'max-800': 'Do 800 m+' } };
const sl = readFileSync(new URL('../src/pages/iskalnik-tekov.astro', import.meta.url), 'utf8');
const en = readFileSync(new URL('../src/pages/en/find-races.astro', import.meta.url), 'utf8');

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

describe('active finder filters page wiring', () => {
  it('URL hydration restores chips', () => { for (const page of [sl,en]) assert.match(page, /applyFinderUrlStateToControls\(stateForYear\(initialUrlState, activeYear\)\)[\s\S]*renderResults\(\);[\s\S]*syncUrlFromControls\(\)/); });
  it('popstate restores chips without analytics', () => { for (const page of [sl,en]) { const i = page.indexOf('restoreFromCurrentUrl'); assert.match(page.slice(i, i + 500), /state\.userInteracted = false/); assert.doesNotMatch(page.slice(i, i + 500), /trackStkEvent/); } });
  it('clear hides the active filter block via canonical state', () => { for (const page of [sl,en]) assert.match(page, /syncUrlFromControls\(clearFinderUrlState\(activeYear\)\)/); });
  it('Slovenian and English finder use the same active filter utility', () => { for (const page of [sl,en]) assert.match(page, /utils-finder-active-filters/); });
  it('chip listener has no manual analytics call', () => { for (const page of [sl,en]) { const i = page.indexOf('removeActiveFilterChip'); assert.doesNotMatch(page.slice(i, i + 900), /trackStkEvent/); } });
  it('search debounce is cancelled before removing a filter', () => { for (const page of [sl,en]) assert.match(page, /const removeActiveFilterChip[\s\S]*if \(searchUrlTimer\) window\.clearTimeout\(searchUrlTimer\)/); });
});
