import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCourseHeading,
  buildCourseRows,
  buildFamilyInfo,
  buildKeyFacts,
  buildPrimaryActions,
  buildRaceHighlights,
  buildPublicNotes,
  buildRegistrationRows,
  formatDetailMoneyRange
} from '../.cache/dist-test/utils-race-detail-view.js';

const baseEvent = {
  id: 'r1', row: '1', year: '2026', date: '2026-05-10', dateValue: 0,
  title: 'Testni tek', displayTitle: 'Testni tek', naziv_prireditve: 'Testni tek',
  place: 'Ljubljana', region: 'Osrednjeslovenska', surface: 'CESTA', distances: '5, 10', startTime: '9:00',
  noticeUrl: '', registrationUrl: '', voteUrl: '', publicNotes: '', cup: '', familyFriendly: false, kidsRaces: false
};
const richAdditional = {
  masterRow: '1', masterRowNumber: 1, reliability: 'visoka', date: '2026-05-10', eventTitle: 'Testni tek',
  registrationMinEur: '10', registrationMaxEur: '20', registrationDeadline: '2026-05-01', earlyRegistrationDeadline: '2026-04-01',
  dayOfRegistration: 'DA', elevationGain: '250', routeUrl: 'https://example.com/route'
};
const fmt = (value) => `date:${value}`;

describe('race detail view model', () => {
  it('omits registration and course sections when optional data is absent', () => {
    assert.deepEqual(buildRegistrationRows(baseEvent, 'sl', fmt), []);
    assert.deepEqual(buildCourseRows(baseEvent, 'sl'), []);
  });

  it('omits blank public notes', () => {
    assert.equal(buildPublicNotes({ ...baseEvent, publicNotes: '   ' }, 'sl', []), '');
  });

  it('formats money ranges without inferring zero from blank or malformed values', () => {
    assert.equal(formatDetailMoneyRange('', ''), '');
    assert.equal(formatDetailMoneyRange('   ', '   '), '');
    assert.equal(formatDetailMoneyRange('0', ''), '0 €');
    assert.equal(formatDetailMoneyRange('0,00', ''), '0 €');
    assert.equal(formatDetailMoneyRange('', '0.00'), '0 €');
    assert.equal(formatDetailMoneyRange('', '20'), '20 €');
    assert.equal(formatDetailMoneyRange('10', ''), '10 €');
    assert.equal(formatDetailMoneyRange('10', '10'), '10 €');
    assert.equal(formatDetailMoneyRange('10', '20'), '10–20 €');
    assert.equal(formatDetailMoneyRange('free', 'unknown'), '');
    assert.equal(formatDetailMoneyRange('free', '20', 'en'), '20 €');
    assert.equal(formatDetailMoneyRange('10.5', '20.75', 'en'), '10.50–20.75 €');
  });

  it('omits blank fee rows and full registration sections when no registration fields are usable', () => {
    const event = { ...baseEvent, additionalData: { ...richAdditional, registrationMinEur: '', registrationMaxEur: '   ', registrationDeadline: '', earlyRegistrationDeadline: '', dayOfRegistration: '' } };
    assert.deepEqual(buildRegistrationRows(event, 'sl', fmt), []);
    const withDeadline = { ...event, additionalData: { ...event.additionalData, registrationDeadline: '2026-05-01' } };
    assert.deepEqual(buildRegistrationRows(withDeadline, 'en', fmt).map((row) => row.label), ['Registration deadline']);
  });

  it('chooses route and elevation headings based on visible course rows', () => {
    const routeOnly = { ...baseEvent, additionalData: { ...richAdditional, elevationGain: '' } };
    const elevationOnly = { ...baseEvent, additionalData: { ...richAdditional, routeUrl: '' } };
    const both = { ...baseEvent, additionalData: richAdditional };
    assert.equal(buildCourseHeading(routeOnly, 'sl'), 'Trasa');
    assert.equal(buildCourseHeading(elevationOnly, 'sl'), 'Višinski podatki');
    assert.equal(buildCourseHeading(both, 'sl'), 'Trasa in višinski podatki');
    assert.equal(buildCourseHeading(routeOnly, 'en'), 'Course');
    assert.equal(buildCourseHeading(elevationOnly, 'en'), 'Elevation');
    assert.equal(buildCourseHeading(both, 'en'), 'Course and elevation');
    assert.equal(buildCourseRows(elevationOnly, 'en').length, 1);
  });

  it('renders family information only from explicit source fields', () => {
    assert.deepEqual(buildFamilyInfo({ ...baseEvent, distances: '0.5, 1, 5' }, 'sl'), []);
    assert.deepEqual(buildFamilyInfo({ ...baseEvent, familyFriendly: true, publicNotes: 'Družinam prijazno: otroški teki.' }, 'sl'), ['Družinam prijazno: otroški teki.']);
  });

  it('does not display duplicated family text in public notes', () => {
    const event = { ...baseEvent, familyFriendly: true, publicNotes: 'Družinam prijazno: otroški teki.' };
    const family = buildFamilyInfo(event, 'sl');
    assert.equal(buildPublicNotes(event, 'sl', family), '');
  });

  it('renders valid primary links only and deduplicates identical URLs', () => {
    assert.deepEqual(buildPrimaryActions({ registrationUrl: 'javascript:alert(1)', noticeUrl: '' }, 'sl'), []);
    assert.deepEqual(buildPrimaryActions({ registrationUrl: 'https://example.com/a', noticeUrl: 'https://example.com/a' }, 'en').map((a) => a.label), ['Registration']);
    assert.deepEqual(buildPrimaryActions({ registrationUrl: 'https://example.com/reg', noticeUrl: 'https://example.com/info' }, 'en').map((a) => a.analyticsType), ['prijava', 'razpis']);
  });

  it('supports 2027 sparse events without 2026-only enrichment data', () => {
    const event2027 = { ...baseEvent, year: '2027', additionalData: null, voteUrl: '' };
    assert.ok(buildKeyFacts(event2027, 'en').length > 0);
    assert.deepEqual(buildRegistrationRows(event2027, 'en', fmt), []);
    assert.deepEqual(buildRaceHighlights(event2027, 'en'), []);
  });

  it('uses equivalent Slovenian and English structure and preserves tracked action types', () => {
    const event = { ...baseEvent, registrationUrl: 'https://example.com/reg', noticeUrl: 'https://example.com/info', additionalData: richAdditional };
    assert.deepEqual(buildKeyFacts(event, 'sl').map((row) => row.label), ['Razdalje', 'Čas začetka', 'Podlaga', 'Kraj', 'Regija']);
    assert.deepEqual(buildKeyFacts(event, 'en').map((row) => row.label), ['Distances', 'Start time', 'Surface', 'Location', 'Region']);
    assert.deepEqual(buildPrimaryActions(event, 'sl').map((a) => a.analyticsType), ['prijava', 'razpis']);
    assert.equal(buildCourseRows(event, 'en')[0].analyticsType, 'trasa');
  });

  it('builds no highlights for sparse events without qualifying facts', () => {
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, distances: '5', surface: 'CESTA' }, 'sl'), []);
  });

  it('limits highlights to three using deterministic priority', () => {
    const event = { ...baseEvent, distances: '5;10;85', cup: 'PGT Pokal', kidsRaces: true, additionalData: { ...richAdditional, elevationGain: '2500', registrationMinEur: '0', dayOfRegistration: 'DA' } };
    assert.deepEqual(buildRaceHighlights(event, 'en'), [
      'The longest course is 85 km, offering a substantial ultra challenge.',
      'The longest course includes 2500 m of elevation gain.',
      'Several distances are available, from 5 to 85 km.'
    ]);
  });

  it('parses multiple distances, ignores malformed entries and formats decimals by language', () => {
    const event = { ...baseEvent, distances: 'abc;5;0;-2;10 km;21,1;5-10' };
    assert.deepEqual(buildRaceHighlights(event, 'sl'), ['Na voljo je več razdalj: od 5 do 21,1 km.']);
    assert.deepEqual(buildRaceHighlights(event, 'en'), ['Several distances are available, from 5 to 21.1 km.']);
  });

  it('uses the longest valid distance for strong ultra wording', () => {
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, distances: '10;80,5' }, 'sl'), ['Najdaljša trasa meri 80,5 km in predstavlja izrazit ultra izziv.']);
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, distances: '10;43' }, 'en'), ['The event also includes an ultra-distance race.']);
  });

  it('uses only valid positive elevation values and thresholds', () => {
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, elevationGain: '0' } }, 'sl'), [
      'Prijava je predvidena tudi na dan dogodka.',
      'Na voljo je povezava do trase ali zemljevida.'
    ]);
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, elevationGain: '1200' } }, 'en')[0], 'The race offers a substantial mountain challenge with 1200 m of elevation gain.');
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, elevationGain: '1.200' } }, 'en'), [
      'Race-day registration is listed as available.',
      'A route or map link is available.'
    ]);
  });

  it('uses short-and-steep wording and suppresses duplicate elevation highlights', () => {
    const event = { ...baseEvent, distances: '5;10', surface: 'gorski', additionalData: { ...richAdditional, elevationGain: '900', routeUrl: '' } };
    assert.deepEqual(buildRaceHighlights(event, 'en'), ['A short distance is combined with substantial climbing.', 'Race-day registration is listed as available.']);
  });

  it('requires explicit family or children data and never infers it from short distance alone', () => {
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, distances: '1;5;10' }, 'en'), ['Several distances are available, from 1 to 10 km.']);
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, familyFriendly: true }, 'sl'), ['Dogodek je izrecno označen kot družinam prijazen.']);
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, kidsRaces: true, familyFriendly: true }, 'en'), ['The organizer lists children’s races or categories.']);
  });

  it('creates free-participation highlights only from explicit zero fee data', () => {
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, registrationMinEur: '', registrationMaxEur: '', dayOfRegistration: '', elevationGain: '', routeUrl: '' } }, 'sl'), []);
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, registrationMinEur: '0,00', registrationMaxEur: '', dayOfRegistration: '', elevationGain: '', routeUrl: '' } }, 'sl'), ['Za del programa je navedena brezplačna udeležba.']);
  });

  it('requires explicit positive race-day registration values', () => {
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, dayOfRegistration: 'NE', elevationGain: '', routeUrl: '' } }, 'en'), []);
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, dayOfRegistration: 'yes', elevationGain: '', routeUrl: '' } }, 'en'), ['Race-day registration is listed as available.']);
  });

  it('requires valid HTTP or HTTPS route URLs', () => {
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, routeUrl: 'ftp://example.com/route', dayOfRegistration: '', elevationGain: '' } }, 'sl'), []);
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, routeUrl: 'https://example.com/route', dayOfRegistration: '', elevationGain: '' } }, 'sl'), ['Na voljo je povezava do trase ali zemljevida.']);
  });

  it('preserves cup names and returns equivalent Slovenian and English categories', () => {
    const event = { ...baseEvent, distances: '5;10;21,1', cup: 'PGT Pokal VERTIKAL', familyFriendly: true };
    assert.deepEqual(buildRaceHighlights(event, 'sl'), [
      'Na voljo je več razdalj: od 5 do 21,1 km.',
      'Dogodek je izrecno označen kot družinam prijazen.',
      'Tek je del serije oziroma pokala PGT Pokal VERTIKAL.'
    ]);
    assert.deepEqual(buildRaceHighlights(event, 'en'), [
      'Several distances are available, from 5 to 21.1 km.',
      'The event is explicitly marked as family-friendly.',
      'The race is part of the PGT Pokal VERTIKAL series or cup.'
    ]);
  });

  it('supports 2027 highlights without additional data and avoids duplicate concepts', () => {
    const event2027 = { ...baseEvent, year: '2027', distances: '5;10;21,1;21.1', cup: 'Slovenija teče', additionalData: null };
    assert.deepEqual(buildRaceHighlights(event2027, 'en'), [
      'Several distances are available, from 5 to 21.1 km.',
      'The race is part of the Slovenija teče series or cup.'
    ]);
  });
});
