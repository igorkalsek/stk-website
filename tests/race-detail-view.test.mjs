import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCourseHeading,
  buildCourseRows,
  buildFamilyInfo,
  buildKeyFacts,
  buildPrimaryActions,
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
  });

  it('uses equivalent Slovenian and English structure and preserves tracked action types', () => {
    const event = { ...baseEvent, registrationUrl: 'https://example.com/reg', noticeUrl: 'https://example.com/info', additionalData: richAdditional };
    assert.deepEqual(buildKeyFacts(event, 'sl').map((row) => row.label), ['Razdalje', 'Čas začetka', 'Podlaga', 'Kraj', 'Regija']);
    assert.deepEqual(buildKeyFacts(event, 'en').map((row) => row.label), ['Distances', 'Start time', 'Surface', 'Location', 'Region']);
    assert.deepEqual(buildPrimaryActions(event, 'sl').map((a) => a.analyticsType), ['prijava', 'razpis']);
    assert.equal(buildCourseRows(event, 'en')[0].analyticsType, 'trasa');
  });
});
