import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeFinderSearchText, normalizeSloveneText } from '../.cache/dist-test/utils-event-detail.js';

const matches = (text, query) => normalizeFinderSearchText(text).includes(normalizeFinderSearchText(query));

describe('finder Slovene caron matching', () => {
  it('matches titles and places with, without, and with mixed carons', () => {
    for (const query of ['Čaven', 'Caven', 'ČAVEN', 'CAVEN', 'C\u030caven']) {
      assert.equal(matches('Čaven Vertikal & Trail Lokavec', query), true);
    }
    for (const query of ['Šmaver', 'Smaver', 'SMAVER']) {
      assert.equal(matches('Sabotin Trail Evening Šmaver', query), true);
    }
    for (const query of ['Žužemberk', 'Zuzemberk', 'Žuzemberk']) {
      assert.equal(matches('Tek Žužemberk', query), true);
    }
    assert.equal(matches('Caven Trail', 'Čaven'), true);
  });

  it('preserves the shared normalizer used by event eligibility and other filters', () => {
    assert.equal(normalizeSloveneText('ČŠŽ POTRJENO'), 'čšž potrjeno');
    assert.equal(normalizeFinderSearchText('ČŠŽ POTRJENO'), 'csz potrjeno');
  });

  it('does not correct typos, reorder words, add synonyms, or fold other accents', () => {
    for (const query of ['Cavet', 'Cavenn', 'Trail Caven', 'Slovenija', 'Bled']) {
      assert.equal(matches('Čaven Vertikal & Trail Lokavec', query), false);
    }
    assert.equal(matches('Konjiški otroški tek Slovenske Konjice', 'Konjiški otroški tej'), false);
    assert.equal(matches('Café Run', 'Cafe'), false);
  });
});
