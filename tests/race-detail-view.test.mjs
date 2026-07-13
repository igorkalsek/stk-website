import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  buildCourseHeading,
  buildCourseRows,
  buildFamilyInfo,
  buildKeyFacts,
  areEquivalentPublicActionUrls,
  buildPrimaryActions,
  buildRaceHighlights,
  buildPublicNotes,
  buildRegistrationRows,
  formatDetailMoneyRange,
  formatFamilyPublicNote
} from '../.cache/dist-test/utils-race-detail-view.js';
import { buildEnglishEventDetailPath } from '../.cache/dist-test/utils-event-detail.js';

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

  it('formats recognized family public notes for display without mutating the source note', () => {
    const raw = 'družinam prijazno: otroški teki 100 m/500 m/1.6 km; vsak tretji otrok iz družine brezplačen.';
    assert.equal(formatFamilyPublicNote(raw, 'sl'), 'Družinam prijazno: otroški teki na 100 m, 500 m in 1,6 km; vsak tretji otrok iz iste družine nastopi brezplačno.');
    assert.equal(raw, 'družinam prijazno: otroški teki 100 m/500 m/1.6 km; vsak tretji otrok iz družine brezplačen.');
    assert.equal(formatFamilyPublicNote('https://example.com/otroški-teki 1.6 km', 'sl'), 'https://example.com/otroški-teki 1.6 km');
  });

  it('labels route links that point to the same notice URL without changing analytics', () => {
    const same = { ...baseEvent, noticeUrl: 'https://example.com/info.pdf', additionalData: { ...richAdditional, routeUrl: 'https://example.com/info.pdf/' } };
    const different = { ...baseEvent, noticeUrl: 'https://example.com/info.pdf?type=notice', additionalData: { ...richAdditional, routeUrl: 'https://example.com/info.pdf?type=route' } };
    assert.equal(buildCourseRows(same, 'sl')[0].value, 'Trasa je vključena v razpis');
    assert.equal(buildCourseRows(same, 'en')[0].value, 'Course is included in the race information');
    assert.equal(buildCourseRows(same, 'sl')[0].analyticsType, 'trasa');
    assert.equal(buildCourseRows(different, 'sl')[0].value, 'Odpri traso ali zemljevid');
    assert.equal(buildCourseRows(different, 'en')[0].value, 'Open route or map');
  });

  it('does not display duplicated family text in public notes', () => {
    const event = { ...baseEvent, familyFriendly: true, publicNotes: 'Družinam prijazno: otroški teki.' };
    const family = buildFamilyInfo(event, 'sl');
    assert.equal(buildPublicNotes(event, 'sl', family), '');
    const rawEvent = { ...baseEvent, familyFriendly: true, publicNotes: 'družinam prijazno: otroški teki 100 m/500 m/1.6 km; vsak tretji otrok iz družine brezplačen.' };
    assert.equal(buildPublicNotes(rawEvent, 'sl', buildFamilyInfo(rawEvent, 'sl')), '');
  });

  it('renders valid primary action combinations with combined labels and analytics', () => {
    assert.deepEqual(buildPrimaryActions({ registrationUrl: 'https://example.com/reg', noticeUrl: '' }, 'sl').map((a) => a.label), ['Prijava']);
    assert.deepEqual(buildPrimaryActions({ registrationUrl: '', noticeUrl: 'https://example.com/info' }, 'en').map((a) => a.label), ['Official info']);
    const distinct = buildPrimaryActions({ registrationUrl: 'https://example.com/reg', noticeUrl: 'https://example.com/info' }, 'en');
    assert.deepEqual(distinct.map((a) => a.label), ['Registration', 'Official info']);
    assert.deepEqual(distinct.map((a) => a.analyticsType), ['prijava', 'razpis']);
    const combinedSl = buildPrimaryActions({ registrationUrl: 'https://example.com/a', noticeUrl: 'https://example.com/a' }, 'sl');
    assert.deepEqual(combinedSl.map((a) => a.label), ['Razpis in prijava']);
    assert.equal(combinedSl[0].analyticsType, 'prijava');
    assert.deepEqual(buildPrimaryActions({ registrationUrl: 'https://example.com/a', noticeUrl: 'https://example.com/a/' }, 'en').map((a) => a.label), ['Official info and registration']);
    assert.deepEqual(buildPrimaryActions({ registrationUrl: 'https://example.com/a#registration', noticeUrl: 'https://example.com/a' }, 'en').map((a) => a.label), ['Official info and registration']);
    assert.deepEqual(buildPrimaryActions({ registrationUrl: 'https://example.com/a?b=2&a=1', noticeUrl: 'https://example.com/a?a=1&b=2' }, 'en').map((a) => a.label), ['Official info and registration']);
    assert.equal(buildPrimaryActions({ registrationUrl: 'https://example.com/a?type=registration', noticeUrl: 'https://example.com/a?type=notice' }, 'en').length, 2);
    assert.equal(buildPrimaryActions({ registrationUrl: 'https://registration.example.com/a', noticeUrl: 'https://example.com/a' }, 'en').length, 2);
    assert.deepEqual(buildPrimaryActions({ registrationUrl: 'javascript:alert(1)', noticeUrl: 'https://example.com/info' }, 'sl').map((a) => a.label), ['Razpis']);
    assert.deepEqual(buildPrimaryActions({ registrationUrl: 'https://example.com/reg', noticeUrl: 'notaurl' }, 'sl').map((a) => a.label), ['Prijava']);
    assert.deepEqual(buildPrimaryActions({ registrationUrl: 'notaurl', noticeUrl: 'javascript:alert(1)' }, 'sl'), []);
  });

  it('compares public action URLs deterministically without broad equivalence', () => {
    assert.equal(areEquivalentPublicActionUrls('https://example.si/event', 'https://example.si/event/'), true);
    assert.equal(areEquivalentPublicActionUrls('https://example.si/event?a=1&b=2', 'https://example.si/event?b=2&a=1'), true);
    assert.equal(areEquivalentPublicActionUrls('https://example.si/event#registration', 'https://example.si/event'), true);
    assert.equal(areEquivalentPublicActionUrls('https://example.si/event?type=registration', 'https://example.si/event?type=notice'), false);
    assert.equal(areEquivalentPublicActionUrls('https://registration.example.si/event', 'https://example.si/event'), false);
    assert.equal(areEquivalentPublicActionUrls('http://example.si/event', 'https://example.si/event'), false);
    assert.equal(areEquivalentPublicActionUrls('notaurl', 'https://example.si/event'), false);
  });

  it('supports 2027 sparse events without 2026-only enrichment data', () => {
    const event2027 = { ...baseEvent, year: '2027', additionalData: null, voteUrl: '' };
    assert.deepEqual(buildKeyFacts(event2027, 'en'), []);
    assert.deepEqual(buildRegistrationRows(event2027, 'en', fmt), []);
    assert.deepEqual(buildRaceHighlights(event2027, 'en'), []);
  });

  it('uses equivalent Slovenian and English structure and preserves tracked action types', () => {
    const event = { ...baseEvent, registrationUrl: 'https://example.com/reg', noticeUrl: 'https://example.com/info', additionalData: richAdditional };
    assert.deepEqual(buildKeyFacts(event, 'sl'), []);
    assert.deepEqual(buildKeyFacts(event, 'en'), []);
    assert.deepEqual(buildPrimaryActions(event, 'sl').map((a) => a.analyticsType), ['prijava', 'razpis']);
    assert.equal(buildCourseRows(event, 'en')[0].analyticsType, 'trasa');
  });


  it('builds English detail paths for 2026 and 2027 with the event year', () => {
    assert.equal(buildEnglishEventDetailPath(baseEvent), '/en/races/2026/r000001-testni-tek/');
    assert.equal(buildEnglishEventDetailPath({ ...baseEvent, year: '2027', date: '2027-05-10' }), '/en/races/2027/r000001-testni-tek/');
  });

  it('uses the updated highlight headings in Slovenian and English detail routes', () => {
    const slovenePage = readFileSync('src/pages/tek/[year]/[slug].astro', 'utf8');
    const englishPage = readFileSync('src/pages/en/races/[year]/[slug].astro', 'utf8');
    assert.match(slovenePage, /Kaj izstopa pri tem teku\?/);
    assert.doesNotMatch(slovenePage, /Zakaj je ta tek zanimiv\?/);
    assert.match(englishPage, /What stands out about this race/);
    assert.doesNotMatch(englishPage, /Why this race stands out/);
  });

  it('keeps equivalent UX hierarchy, split CTA styling and analytics attributes on both detail routes', () => {
    const slovenePage = readFileSync('src/pages/tek/[year]/[slug].astro', 'utf8');
    const englishPage = readFileSync('src/pages/en/races/[year]/[slug].astro', 'utf8');
    for (const page of [slovenePage, englishPage]) {
      assert.match(page, /event-detail-hero-layout/);
      assert.match(page, /event-detail-hero-facts/);
      assert.match(page, /event-detail-hero-chip-featured/);
      assert.match(page, /action.kind === 'registration' \? 'button button-primary event-detail-top-action' : 'button button-secondary-light event-detail-top-action'/);
      assert.match(page, /data-analytics-link-type=\{action\.analyticsType\}/);
      assert.match(page, /data-analytics-calendar-type="google"/);
      assert.match(page, /detailItems.length > 0/);
      assert.match(page, /data-analytics-event-type="share_clicked"/);
      assert.match(page, /data-analytics-event-type="correction_clicked"/);
      assert.match(page, /data-saved-race-button/);
    }
    assert.match(slovenePage, /aria-label="Najpomembnejši podatki"/);
    assert.match(slovenePage, /label: 'Razdalje'/);
    assert.match(slovenePage, /Google koledar/);
    assert.match(slovenePage, /Odpri zemljevid/);
    assert.match(englishPage, /aria-label="Key race facts"/);
    assert.match(englishPage, /label: 'Distances'/);
    assert.match(englishPage, /Google Calendar/);
    assert.match(englishPage, /Open map/);
  });

  it('builds no highlights for sparse events without qualifying facts', () => {
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, distances: '5', surface: 'CESTA' }, 'sl'), []);
  });

  it('limits highlights to four useful items using deterministic priority', () => {
    const event = { ...baseEvent, distances: '5;10;85', cup: 'PGT Pokal', kidsRaces: true, additionalData: { ...richAdditional, elevationGain: '2500', registrationMinEur: '0', dayOfRegistration: 'DA' } };
    assert.deepEqual(buildRaceHighlights(event, 'en'), [
      'The longest course is 85 km, offering a substantial ultra challenge.',
      '2500 m of elevation gain is listed for the event.',
      'The organizer lists children’s races or categories.',
      'The race is part of the PGT Pokal series or cup.'
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
      'Prijava je predvidena tudi na dan dogodka.'
    ]);
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, elevationGain: '1200' } }, 'en')[0], '1200 m of elevation gain is listed for the event.');
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, elevationGain: '2500' } }, 'sl')[0], 'Za dogodek je navedenih 2500 m+ vzpona.');
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, elevationGain: '2500' } }, 'en')[0], '2500 m of elevation gain is listed for the event.');
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, elevationGain: '600' } }, 'sl')[0], 'Za dogodek je navedenih približno 600 m+ vzpona.');
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, elevationGain: '600' } }, 'en')[0], 'Around 600 m of elevation gain is listed for the event.');
    const generated = [
      ...buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, elevationGain: '2500' } }, 'sl'),
      ...buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, elevationGain: '2500' } }, 'en')
    ].join(' ');
    assert.doesNotMatch(generated, /Najdaljša trasa vključuje|The longest course includes/);
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, elevationGain: '1.200' } }, 'en'), [
      'Race-day registration is listed as available.'
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

  it('requires valid HTTP or HTTPS route URLs without turning route availability into a generic highlight', () => {
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, routeUrl: 'ftp://example.com/route', dayOfRegistration: '', elevationGain: '' } }, 'sl'), []);
    assert.deepEqual(buildRaceHighlights({ ...baseEvent, additionalData: { ...richAdditional, routeUrl: 'https://example.com/route', dayOfRegistration: '', elevationGain: '' } }, 'sl'), []);
  });

  it('preserves cup names and returns equivalent Slovenian and English categories', () => {
    const event = { ...baseEvent, distances: '5;10;21,1', cup: 'PGT Pokal VERTIKAL', familyFriendly: true };
    assert.deepEqual(buildRaceHighlights(event, 'sl'), [
      'Dogodek je izrecno označen kot družinam prijazen.',
      'Tek je del serije oziroma pokala PGT Pokal VERTIKAL.',
      'Na voljo je več razdalj: od 5 do 21,1 km.'
    ]);
    assert.deepEqual(buildRaceHighlights(event, 'en'), [
      'The event is explicitly marked as family-friendly.',
      'The race is part of the PGT Pokal VERTIKAL series or cup.',
      'Several distances are available, from 5 to 21.1 km.'
    ]);
  });

  it('supports 2027 highlights without additional data and avoids duplicate concepts', () => {
    const event2027 = { ...baseEvent, year: '2027', distances: '5;10;21,1;21.1', cup: 'Slovenija teče', additionalData: null };
    assert.deepEqual(buildRaceHighlights(event2027, 'en'), [
      'The race is part of the Slovenija teče series or cup.',
      'Several distances are available, from 5 to 21.1 km.'
    ]);
  });
});
