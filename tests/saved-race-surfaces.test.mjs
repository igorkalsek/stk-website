import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const files = {
  homeSl: read('src/pages/index.astro'),
  homeEn: read('src/pages/en/index.astro'),
  familySl: read('src/pages/druzinam-prijazni-teki.astro'),
  familyEn: read('src/pages/en/family-friendly-races.astro'),
  votedSl: read('src/pages/najbolj-glasovani-teki.astro'),
  votedEn: read('src/pages/en/most-voted-races.astro'),
  related: read('src/components/RelatedRaceCards.astro'),
  relatedUtils: read('src/utils-related-races.ts'),
  header: read('src/components/Header.astro')
};

const allSurfaceSources = [files.homeSl, files.homeEn, files.familySl, files.familyEn, files.votedSl, files.votedEn, files.related];

describe('saved race button surfaces', () => {
  it('adds saved race buttons to all requested Slovenian and English surfaces', () => {
    allSurfaceSources.forEach((source) => assert.match(source, /data-saved-race-button/));
    assert.match(files.homeSl, /data-hero-preview-list[\s\S]*data-nearest-events[\s\S]*data-top-events/);
    assert.match(files.homeEn, /data-hero-preview-list[\s\S]*data-nearest-events[\s\S]*data-top-events/);
  });

  it('uses stable event IDs and the required data attributes', () => {
    [files.homeSl, files.homeEn, files.familySl, files.familyEn, files.votedSl, files.votedEn, files.relatedUtils].forEach((source) => {
      assert.match(source, /getStableEventId/);
    });
    allSurfaceSources.forEach((source) => {
      assert.match(source, /data-event-id/);
      assert.match(source, /data-event-year/);
      assert.match(source, /data-event-date/);
      assert.match(source, /data-event-title/);
    });
  });

  it('keeps buttons outside the primary related-card link and omits them without stable IDs', () => {
    assert.match(files.relatedUtils, /stableEventId: string/);
    assert.match(files.related, /<a[\s\S]*class="related-race-card-link"[\s\S]*<\/a>[\s\S]*race\.stableEventId && \(/);
    assert.doesNotMatch(files.related, /<a[\s\S]*data-saved-race-button[\s\S]*<\/a>/);
  });

  it('initializes saved race buttons after dynamic rendering', () => {
    [files.homeSl, files.homeEn, files.familySl, files.familyEn, files.votedSl, files.votedEn].forEach((source) => {
      assert.match(source, /initSavedRaceButtons\(/);
      assert.match(source, /innerHTML[\s\S]{0,240}initSavedRaceButtons\(/);
    });
  });



  it('uses icon-only saved race buttons in the compact homepage hero preview only', () => {
    assert.match(files.homeSl, /renderSavedRaceButton\(event, title, dateValue, place, true\)/);
    assert.match(files.homeEn, /renderSavedRaceButton\(event, title, dateValue, place, true\)/);
    assert.match(files.homeSl, /data-saved-race-icon-only="true"/);
    assert.match(files.homeEn, /data-saved-race-icon-only="true"/);
    assert.match(files.homeSl, /data-saved-race-remove-label="Odstrani iz Mojih tekov"/);
    assert.match(files.homeEn, /data-saved-race-remove-label="Remove from My races"/);
    assert.match(files.homeSl, /iconOnly \? '' : '<span data-saved-race-label>Shrani tek<\/span>'/);
    assert.match(files.homeEn, /iconOnly \? '' : '<span data-saved-race-label>Save race<\/span>'/);
    [files.familySl, files.familyEn, files.votedSl, files.votedEn, files.related].forEach((source) => {
      assert.doesNotMatch(source, /data-saved-race-icon-only/);
      assert.doesNotMatch(source, /saved-race-icon-button/);
    });
  });

  it('uses the updated Slovenian navigation label', () => {
    assert.match(files.header, /label: 'Osebni koledar'/);
    assert.doesNotMatch(files.header, /href: '\/osebni-koledar\/', label: 'Koledar'/);
  });
});
