import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildGoogleCalendarEventUrl } from '../.cache/dist-test/utils-calendar.js';
import { buildPreferenceRegionInputId, buildRaceFinderCalendarEventInput, englishRaceFinderLocale, sloveneRaceFinderLocale } from '../.cache/dist-test/finder/race-finder-locales.js';

const calendarEvent = {
  title: 'Ljubljana 10K Trail',
  date: '2026-08-15',
  location: 'Ljubljana',
  noticeUrl: 'https://example.com/notice',
  registrationUrl: 'https://example.com/register'
};

const googleDetails = (url) => new URL(url).searchParams.get('details') ?? '';

describe('race finder locale regressions', () => {
  it('formats Slovenian result counts', () => {
    assert.deepEqual([0, 1, 2, 3, 5].map((count) => sloveneRaceFinderLocale.formatResultCount(count)), [
      '0 dogodkov',
      '1 dogodek',
      '2 dogodka',
      '3 dogodki',
      '5 dogodkov'
    ]);
  });

  it('formats English result counts', () => {
    assert.deepEqual([0, 1, 2].map((count) => englishRaceFinderLocale.formatResultCount(count)), [
      '0 races',
      '1 race',
      '2 races'
    ]);
  });

  it('formats localized pagination counts', () => {
    assert.equal(sloveneRaceFinderLocale.formatVisibleResultCount(30, 50), 'Prikazanih je 30 od 50 dogodkov');
    assert.equal(englishRaceFinderLocale.formatVisibleResultCount(30, 50), 'Showing 30 of 50 races');
  });

  it('formats localized surface option labels without changing option values', () => {
    assert.deepEqual(['cesta', 'gorski', 'oviratlon'].map((value) => sloveneRaceFinderLocale.formatSurface(value)), [
      'Cesta',
      'Gorski',
      'Oviratlon'
    ]);
    assert.deepEqual(['cesta', 'gorski', 'oviratlon'].map((value) => englishRaceFinderLocale.formatSurface(value)), [
      'Road',
      'Mountain',
      'Obstacle run'
    ]);
  });

  it('passes the locale language into calendar event descriptions without changing event identity fields', () => {
    const slInput = buildRaceFinderCalendarEventInput(sloveneRaceFinderLocale, calendarEvent);
    const enInput = buildRaceFinderCalendarEventInput(englishRaceFinderLocale, calendarEvent);

    assert.equal(slInput.title, calendarEvent.title);
    assert.equal(slInput.date, calendarEvent.date);
    assert.equal(slInput.location, calendarEvent.location);
    assert.equal(enInput.title, calendarEvent.title);
    assert.equal(enInput.date, calendarEvent.date);
    assert.equal(enInput.location, calendarEvent.location);

    const slDetails = googleDetails(buildGoogleCalendarEventUrl(slInput));
    const enDetails = googleDetails(buildGoogleCalendarEventUrl(enInput));
    assert.match(slDetails, /Dodano iz Slovenskega Tekaškega Koledarja/);
    assert.match(slDetails, /Razpis:/);
    assert.match(enDetails, /Added from Slovenski Tekaški Koledar/);
    assert.match(enDetails, /Official info:/);
  });

  it('builds localized preference region input ids', () => {
    assert.equal(buildPreferenceRegionInputId('sl', 2), 'pref-region-sl-2');
    assert.equal(buildPreferenceRegionInputId('en', 2), 'pref-region-en-2');
  });

  it('does not share the Slovenian result-count function with English after locale spreading', () => {
    assert.notEqual(englishRaceFinderLocale.formatResultCount, sloveneRaceFinderLocale.formatResultCount);
    assert.equal(englishRaceFinderLocale.formatResultCount(1), '1 race');
  });
});
