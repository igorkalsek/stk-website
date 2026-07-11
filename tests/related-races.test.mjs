import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { formatRaceDistances } from '../.cache/dist-test/utils-distance-format.js';
import { buildRelatedRaceCards, buildRelatedRaces, getRelatedRaceReasonLabels } from '../.cache/dist-test/utils-related-races.js';

const ev = (overrides = {}) => ({
  id: overrides.id ?? `id-${overrides.title ?? 'Race'}`,
  row: overrides.row ?? '', year: overrides.year ?? '2026', date: overrides.date ?? '2026-06-01', dateValue: new Date(`${overrides.date ?? '2026-06-01'}T00:00:00`).getTime(),
  title: overrides.title ?? 'Race', displayTitle: overrides.title ?? 'Race', naziv_prireditve: overrides.title ?? 'Race', place: overrides.place ?? 'Ljubljana', region: overrides.region ?? 'Osrednjeslovenska', surface: overrides.surface ?? 'trail', distances: overrides.distances ?? '10; 21', startTime: '', noticeUrl: '', registrationUrl: '', voteUrl: '', publicNotes: '', cup: overrides.cup ?? '', familyFriendly: overrides.familyFriendly ?? false, kidsRaces: false,
  ...overrides
});
const related = (current, candidates, todayIso = '2026-01-01') => buildRelatedRaces({ currentEvent: current, candidates, todayIso, limit: 3 });

describe('buildRelatedRaces', () => {
  it('excludes current event, other years, past candidates and duplicates', () => {
    const current = ev({ id: 'same', title: 'Current', cup: 'Cup' });
    const dup = ev({ id: 'dup', title: 'Dup', cup: 'Cup' });
    const results = related(current, [current, ev({ year: '2027', title: 'Other', cup: 'Cup' }), ev({ title: 'Past', date: '2025-12-31', cup: 'Cup' }), dup, { ...dup, title: 'Dup copy' }]);
    assert.deepEqual(results.map((r) => r.event.title), ['Dup']);
  });

  it('limits to three, applies the six-point threshold and has no fallback', () => {
    const current = ev({ title: 'Current', cup: 'Cup' });
    const candidates = ['A','B','C','D'].map((title) => ev({ title, cup: 'Cup', date: `2026-06-0${title.charCodeAt(0)-64}` })).concat(ev({ title: 'Weak', surface: 'road', distances: '100' }));
    const results = related(current, candidates);
    assert.equal(results.length, 3);
    assert(!results.some((r) => r.event.title === 'Weak'));
    assert(results.every((r) => r.score >= 6));
  });

  it('prioritizes exact cup and deterministic tie breaking', () => {
    const current = ev({ title: 'Current', cup: 'Series', date: '2026-06-10', surface: 'road', distances: '10', region: 'A' });
    const results = related(current, [ev({ title: 'Zulu', date: '2026-09-01', cup: '', surface: 'trail', distances: '50', region: 'B' }), ev({ title: 'Alpha', date: '2026-09-01', cup: 'Series', surface: 'trail', distances: '50', region: 'B' })]);
    assert.equal(results[0].event.title, 'Alpha');
    assert(results[0].reasonKeys.includes('same-cup'));
  });

  it('scores exact, mixed and unknown surfaces correctly', () => {
    const current = ev({ surface: 'trail', distances: '100', region: 'X', date: '2026-06-01' });
    const results = related(current, [ev({ title: 'Exact', surface: 'trail', distances: '100', region: 'Y', date: '2026-06-02' }), ev({ title: 'Mixed', surface: 'cesta/trail', distances: '100', region: 'Y', date: '2026-06-03' }), ev({ title: 'Unknown exact', surface: 'foo', distances: '100', region: 'Y', date: '2026-06-04' })]);
    assert.equal(results.find((r) => r.event.title === 'Exact').score, 12);
    assert.equal(results.find((r) => r.event.title === 'Mixed').score, 10);
    assert.equal(results.find((r) => r.event.title === 'Unknown exact').score, 7);
  });

  it('handles distance thresholds, malformed, zero, negative and children distances', () => {
    let current = ev({ distances: '0; -5; 0.5; 10' });
    let results = related(current, [ev({ title: 'Strong', distances: '10.9', surface: 'x', date: '2026-06-02' }), ev({ title: 'Medium', distances: '12.5', surface: 'x', date: '2026-06-03' }), ev({ title: 'Weak', distances: '20', surface: 'y', date: '2026-10-04' }), ev({ title: 'Bad', distances: 'abc', surface: 'y', date: '2026-10-05' })]);
    assert.deepEqual(results.map((r) => r.event.title), ['Strong', 'Medium']);
    current = ev({ distances: '0.5; 1' });
    results = related(current, [ev({ title: 'Kids', distances: '0.9', surface: 'x', date: '2026-06-02' })]);
    assert.equal(results[0].event.title, 'Kids');
  });

  it('scores same region, explicit family-friendly and date proximity without exposing date as a reason', () => {
    const current = ev({ familyFriendly: true, region: 'Gorenjska', surface: 'road', distances: '5', date: '2026-06-01' });
    const result = related(current, [ev({ title: 'Family', familyFriendly: true, region: 'Gorenjska', surface: 'x', distances: '50', date: '2026-06-20' })])[0];
    assert.equal(result.score, 7);
    assert.deepEqual(result.reasonKeys, ['same-region', 'family-friendly']);
  });

  it('is language-independent, translates labels, caps two labels and builds paths', () => {
    const current = ev({ cup: 'Cup', surface: 'trail', distances: '10', region: 'R', familyFriendly: true });
    const cand = ev({ row: '7', id: '7', title: 'Candidate', cup: 'Cup', surface: 'trail', distances: '10', region: 'R', familyFriendly: true });
    const results = related(current, [cand]);
    assert.deepEqual(results.map((r) => r.event.id), ['7']);
    assert.deepEqual(getRelatedRaceReasonLabels(results[0].reasonKeys, 'sl'), ['Isti pokal ali serija', 'Podobna razdalja']);
    assert.deepEqual(getRelatedRaceReasonLabels(results[0].reasonKeys, 'en'), ['Same cup or series', 'Similar distance']);
    assert.equal(buildRelatedRaceCards(results, 'sl')[0].detailPath.startsWith('/tek/2026/'), true);
    assert.equal(buildRelatedRaceCards(results, 'en')[0].detailPath.startsWith('/en/races/2026/'), true);
  });

  it('supports sparse 2027 candidate sets', () => {
    assert.deepEqual(related(ev({ year: '2027', date: '2027-05-01' }), [ev({ year: '2027', title: 'Sparse', date: '2027-06-01', surface: 'road', distances: '100' })], '2027-01-01'), []);
  });
});

describe('related race rendering helpers', () => {
  it('does not mark related race links as external analytics clicks', () => {
    const source = readFileSync(new URL('../src/components/RelatedRaceCards.astro', import.meta.url), 'utf8');
    assert(!source.includes('data-analytics-event-type="external_link_clicked"'));
    assert(!source.includes('data-analytics-action-type="event_card_click"'));
  });

  it('formats distances with Slovenian decimal commas and English decimal points', () => {
    assert.equal(formatRaceDistances('21.1', 'sl'), '21,1 km');
    assert.equal(formatRaceDistances('21,1', 'en'), '21.1 km');
    assert.equal(formatRaceDistances('5; 10; 21,1', 'en'), '5 km · 10 km · 21.1 km');
    assert.equal(formatRaceDistances('5; 10; 21.1', 'sl'), '5 km · 10 km · 21,1 km');
  });
});
