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
