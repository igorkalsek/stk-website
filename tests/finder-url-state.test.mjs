import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { buildFinderUrl, buildFinderUrlForLanguage, buildFinderUrlForYear, clearFinderUrlState, parseFinderUrlState, serializeFinderUrlState, stateForYear } from '../.cache/dist-test/utils-finder-url-state.js';

const qs = (state) => serializeFinderUrlState(state).toString();

describe('finder URL state utility', () => {
  it('serializes empty state to an empty query', () => assert.equal(qs({}), ''));
  it('omits 2026', () => assert.equal(qs({ year: '2026' }), ''));
  it('keeps 2027', () => assert.equal(qs({ year: '2027' }), 'year=2027'));
  it('round-trips all public filters', () => {
    const input = new URLSearchParams('year=2027&q=Trail&month=08&region=Gorenjska&surface=trail&distance=over-10-to-half&fee=20&deadline=within-14&sort=registration-deadline&family=1&raceDay=1&route=1&elevation=max-800&quick=trail,kids');
    const parsed = parseFinderUrlState(input);
    assert.equal(qs(parsed), 'year=2027&q=Trail&month=08&region=Gorenjska&surface=trail&distance=over-10-to-half&fee=20&deadline=within-14&sort=registration-deadline&family=1&raceDay=1&route=1&elevation=max-800&quick=trail%2Ckids');
  });
  it('URL-encodes region and query text', () => assert.equal(qs({ q: 'Nočna 10ka', region: 'Zasavje & Posavje' }), 'q=No%C4%8Dna+10ka&region=Zasavje+%26+Posavje'));
  it('removes defaults', () => assert.equal(qs({ year: '2026', q: ' ', distance: 'all', sort: 'date', family: false, quick: [] }), ''));
  it('ignores unknown values', () => assert.deepEqual(parseFinderUrlState(new URLSearchParams('year=2028&month=13&distance=x&fee=99&deadline=x&sort=my-races&elevation=x&quick=x')).quick, []));
  it('accepts boolean parameters only as 1', () => {
    assert.equal(parseFinderUrlState(new URLSearchParams('family=true&raceDay=0&route=1')).family, false);
    assert.equal(parseFinderUrlState(new URLSearchParams('family=true&raceDay=0&route=1')).route, true);
  });
  it('deduplicates and stably orders quick picks', () => assert.equal(qs({ quick: ['kids', 'trail', 'kids', 'budget'] }), 'quick=budget%2Ctrail%2Ckids'));
  it('does not serialize sort=my-races', () => assert.equal(qs({ sort: 'my-races' }), ''));
  it('removes additional-data filters when switching to 2027', () => assert.equal(qs(stateForYear({ fee: '20', deadline: 'within-14', raceDay: true, route: true, elevation: 'max-800', quick: ['budget', 'route', 'kids'] }, '2027')), 'year=2027&quick=kids'));
  it('preserves parameters during language switching', () => assert.equal(buildFinderUrlForLanguage({ month: '08', surface: 'trail', family: true }, 'en'), '/en/find-races/?month=08&surface=trail&family=1'));
  it('clear keeps only active 2027', () => assert.equal(buildFinderUrl('/iskalnik-tekov/', clearFinderUrlState('2027')), '/iskalnik-tekov/?year=2027'));
  it('year URL builder keeps compatible filters for 2027', () => assert.equal(buildFinderUrlForYear('/iskalnik-tekov/', { q: 'tek', fee: '20', quick: ['budget', 'trail'] }, '2027'), '/iskalnik-tekov/?year=2027&q=tek&quick=trail'));

  it('resets public sort back to date and switches between public non-default sorts', () => {
    assert.equal(parseFinderUrlState(new URLSearchParams('sort=registration-min')).sort, 'registration-min');
    assert.equal(parseFinderUrlState(new URLSearchParams('')).sort, 'date');
    assert.equal(parseFinderUrlState(new URLSearchParams('sort=registration-max')).sort, 'registration-max');
  });
  it('keeps local my-races private during serialization', () => assert.equal(qs({ sort: 'my-races' }), ''));
});

describe('finder pages share URL state wiring', () => {
  const sl = readFileSync(new URL('../src/pages/iskalnik-tekov.astro', import.meta.url), 'utf8');
  const en = readFileSync(new URL('../src/pages/en/find-races.astro', import.meta.url), 'utf8');
  it('applies URL state after populateFilters', () => { for (const page of [sl,en]) assert.match(page, /populateFilters\(\);\s*applyFinderUrlStateToControls/); });
  it('initial hydration does not mark userInteracted', () => { for (const page of [sl,en]) assert.match(page, /userInteracted: false/); });
  it('input and change use replaceState', () => { for (const page of [sl,en]) assert.match(page, /history\.replaceState/); });
  it('clear removes params', () => { for (const page of [sl,en]) assert.match(page, /clearFinderUrlState\(activeYear\)/); });
  it('quick picks are restored', () => { for (const page of [sl,en]) assert.match(page, /stateForYear\(finderState, activeYear\)\.quick\.forEach/); });
  it('popstate reapplies state', () => { for (const page of [sl,en]) assert.match(page, /addEventListener\('popstate', restoreFromCurrentUrl\)/); });
  it('Slovenian and English use the same utility', () => { for (const page of [sl,en]) assert.match(page, /utils-finder-url-state/); });
  it('Copy link has no manual analytics call nearby', () => { for (const page of [sl,en]) { const start = page.indexOf("copyLinkButton?.addEventListener"); assert.doesNotMatch(page.slice(start, start + 700), /trackStkEvent/); } });
  it('preferences are not written to URL', () => { for (const page of [sl,en]) assert.doesNotMatch(page, /preferenceDistanceInputs[\s\S]{0,300}syncUrlFromControls/); });

  it('public sort is always applied while preserving local my-races for default URL sort', () => {
    for (const page of [sl,en]) {
      assert.match(page, /const applyPublicSortState = \(finderState: FinderUrlState, preservePersonalSort = true\)/);
      assert.match(page, /sortSelect\.value === 'my-races' &&[\s\S]*finderState\.sort === 'date'/);
      assert.match(page, /sortSelect\.value = finderState\.sort/);
      assert.match(page, /applyPublicSortState\(finderState\)/);
      assert.doesNotMatch(page, /finderState\.sort !== 'date'\) sortSelect\.value/);
    }
  });
  it('search input uses debounce and other filters remain immediate', () => {
    for (const page of [sl,en]) {
      assert.match(page, /let searchUrlTimer: number \| undefined/);
      assert.match(page, /searchInput\?\.addEventListener\('input'/);
      assert.match(page, /window\.setTimeout\(\(\) => \{[\s\S]*renderResults\(\);[\s\S]*syncUrlFromControls\(\);[\s\S]*\}, 250\)/);
      assert.match(page, /formElement\?\.addEventListener\('change', resetVisibleResults\)/);
      assert.match(page, /quickPickButtons\.forEach/);
    }
  });
  it('search input is not handled twice by the generic form input listener', () => {
    for (const page of [sl,en]) assert.match(page, /if \(event\.target === searchInput\) return;/);
  });
  it('Clipboard API rejection shows fallback text without execCommand', () => {
    assert.match(sl, /catch \{[\s\S]*Povezavo kopirajte iz naslovne vrstice\./);
    assert.match(en, /catch \{[\s\S]*Copy the link from the address bar\./);
    for (const page of [sl,en]) assert.doesNotMatch(page, /document\.execCommand/);
  });
  it('Slovenian and English finder keep identical sort, debounce and clipboard behavior', () => {
    for (const token of ['applyPublicSortState', 'searchUrlTimer', 'event.target === searchInput', 'navigator.clipboard.writeText']) {
      assert.equal(sl.includes(token), true);
      assert.equal(en.includes(token), true);
    }
  });
});
