import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const slovenePage = readFileSync(new URL('../src/pages/iskalnik-tekov.astro', import.meta.url), 'utf8');
const englishPage = readFileSync(new URL('../src/pages/en/find-races.astro', import.meta.url), 'utf8');

const options = ['all', 'up-to-5', 'over-5-to-10', 'over-10-to-half', 'over-half-to-marathon', 'ultra'];

describe('race search distance filter UI wiring', () => {
  it('adds equivalent Slovenian and English select filters with stable values', () => {
    for (const page of [slovenePage, englishPage]) {
      assert.match(page, /name="distance" data-filter="distance"/);
      for (const value of options) assert.match(page, new RegExp(`value="${value}"`));
    }
    assert.match(slovenePage, />Razdalja</);
    assert.match(slovenePage, />Nad 10 do 21,1 km</);
    assert.match(englishPage, />Distance</);
    assert.match(englishPage, />Over 10 to 21\.1 km</);
  });

  it('wires distance into filtering and existing analytics payloads', () => {
    for (const page of [slovenePage, englishPage]) {
      assert.match(page, /matchesRaceDistanceFilter\(event\.distances, filters\.distance\)/);
      assert.match(page, /distanceFilter: filters\.distance === 'all' \? '' : filters\.distance/);
    }
  });

  it('keeps English search year-aware for 2026 and 2027', () => {
    assert.match(englishPage, /getPublicYearFromSearchParams/);
    assert.match(englishPage, /buildMasterApiPath\(activeYear\)/);
    assert.match(englishPage, /date\.startsWith\(`\$\{activeYear\}-`\)/);
    assert.match(englishPage, /The 2027 calendar is being updated\./);
  });
});

describe('race preference compact UX wiring', () => {
  it('uses distinct intro and privacy sentences with correct compact/reset action labels', () => {
    assert.equal((slovenePage.match(/Izberite razdalje, podlage in regije, ki vas zanimajo\./g) ?? []).length, 1);
    assert.equal((slovenePage.match(/Preference ostanejo samo v tem brskalniku in se ne pošiljajo STK\./g) ?? []).length, 1);
    assert.equal((englishPage.match(/Choose the distances, surfaces and regions you are interested in\./g) ?? []).length, 1);
    assert.equal((englishPage.match(/Preferences stay only in this browser and are not sent to STK\./g) ?? []).length, 1);
    assert.match(slovenePage, /data-reset-preferences>Ponastavite<\/button>/);
    assert.match(slovenePage, /data-cancel-preferences hidden>Prekličite urejanje<\/button>/);
    assert.match(englishPage, /data-reset-preferences>Reset<\/button>/);
    for (const label of ['Do 5 km', '5–10 km', '10–21,1 km', '21,1–42,2 km', 'Nad 42,2 km']) assert.match(slovenePage, new RegExp(`>${label}<`));
    for (const label of ['Up to 5 km', '5–10 km', '10–21.1 km', '21.1–42.2 km', 'Over 42.2 km']) assert.match(englishPage, new RegExp(`>${label.replace('.', '\.')}<`));
  });

  it('defines compact active, inactive, editing and reset controls without exposing reset for first render', () => {
    for (const page of [slovenePage, englishPage]) {
      assert.match(page, /data-preferences-ready="false"/);
      assert.match(page, /data-preferences-compact/);
      assert.match(page, /data-preferences-form hidden/);
      assert.match(page, /data-activate-preferences hidden/);
      assert.match(page, /data-cancel-preferences hidden/);
      assert.match(page, /data-reset-preferences-form hidden/);
      assert.match(page, /aria-expanded="false"/);
      assert.match(page, /aria-controls="race-preferences-form-/);
    }
  });

  it('uses dynamic result descriptions for every sort mode', () => {
    for (const page of [slovenePage, englishPage]) {
      assert.match(page, /getRaceFinderResultDescription\(filters\.sort, preferenceLanguage\)/);
      assert.doesNotMatch(page, /sorted by the selected entry fee/);
      assert.doesNotMatch(page, /urejeni po izbrani startnini/);
    }
  });
});


describe('race search analytics source cleanup', () => {
  it('does not mark Slovenian race-title or detail links as external analytics clicks', () => {
    assert.doesNotMatch(slovenePage, /search-event-title-link" href="\$\{escapeHtml\(detailPath\)\}"[^`]*external_link_clicked/);
    assert.doesNotMatch(slovenePage, /search-event-title-link" href="\$\{escapeHtml\(detailPath\)\}"[^`]*event_card_click/);
    assert.doesNotMatch(slovenePage, /search-detail-cta" href="\$\{escapeHtml\(detailPath\)\}"[^`]*(data-analytics-event-type|data-analytics-action-type|data-analytics-link-type|data-stk-action)/);
  });

  it('retains external registration and announcement link metadata in race finders', () => {
    for (const page of [slovenePage, englishPage]) {
      assert.match(page, /data-analytics-link-type="prijava"/);
      assert.match(page, /data-analytics-link-type="razpis"/);
    }
  });
});
