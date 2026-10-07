import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { formatHomepageRecentUpdateMeta, selectHomepageRecentUpdates } from '../.cache/dist-test/utils-home-events.js';

const slSource = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const enSource = readFileSync(new URL('../src/pages/en/index.astro', import.meta.url), 'utf8');

describe('homepage recent updates rendering', () => {
  it('renders Slovenian recent update titles as links when matched', () => {
    assert.match(slSource, /Promise\.allSettled\(\[\s*loadJson\('\/recent_updates\?days=7&limit=4'\),\s*loadJson\('\/'\)/s);
    assert.match(slSource, /buildHomepageEventDetailPath\(matchedEvent\.event/);
    assert.match(slSource, /<h3>\$\{detailPath \? `<a href="\$\{escapeHtml\(detailPath\)\}">\$\{escapeHtml\(title\)\}<\/a>` : escapeHtml\(title\)\}<\/h3>/);
  });

  it('renders English recent update titles as links when matched', () => {
    assert.match(enSource, /Promise\.allSettled\(\[\s*loadJson\('\/recent_updates\?days=7&limit=4'\),\s*loadJson\('\/'\)/s);
    assert.match(enSource, /buildEnglishHomepageEventDetailPath\(matchedEvent\.event/);
    assert.match(enSource, /<h3>\$\{detailPath \? `<a href="\$\{escapeHtml\(detailPath\)\}">\$\{escapeHtml\(title\)\}<\/a>` : escapeHtml\(title\)\}<\/h3>/);
  });

  it('keeps recent updates visible when master loading fails', () => {
    assert.match(slSource, /masterResult\.status === 'fulfilled'[\s\S]*: null/);
    assert.match(enSource, /masterResult\.status === 'fulfilled'[\s\S]*: null/);
    assert.doesNotMatch(slSource, /throw masterResult\.reason/);
    assert.doesNotMatch(enSource, /throw masterResult\.reason/);
  });

  it('adds analytics attributes only for linked recent updates', () => {
    for (const source of [slSource, enSource]) {
      assert.match(source, /data-analytics-placement="home_updates"/);
      assert.match(source, /data-analytics-event-id="\$\{escapeHtml\(analyticsEventId\)\}"/);
      assert.match(source, /const analyticsAttributes = detailPath[\s\S]*: '';/);
    }
  });

  it('keeps the updates block compact by rendering at most four entries', () => {
    assert.match(slSource, /selectHomepageRecentUpdates\(\{ updatedEvents, newEvents, confirmedEvents \}, 4\)/);
    assert.match(enSource, /selectHomepageRecentUpdates\(\{ updatedEvents, newEvents, confirmedEvents \}, 4\)/);
  });

  it('fails closed instead of guessing when canonical recency is unavailable', () => {
    for (const source of [slSource, enSource]) {
      assert.match(source, /RECENT_UPDATES_GLOBAL_ORDER = NOT_AVAILABLE_FROM_CONTRACT/);
      assert.doesNotMatch(source, /sort\([^\n]*datum/);
    }
  });
});

for (const [language, source, labels] of [
  ['sl', slSource, { new: 'Dodano', confirmed: 'Potrjeno', updated: 'Posodobljeno' }],
  ['en', enSource, { new: 'Added', confirmed: 'Confirmed', updated: 'Updated' }]
]) {
  describe(`${language} recent update metadata`, () => {
    it('uses the shared formatter with the actual update_type in the homepage', () => {
      assert.ok(source.includes(`formatHomepageRecentUpdateMeta(update.update_type, recentUpdateDate, eventDate, '${language}')`));
    });
    for (const [type, label] of Object.entries(labels)) {
      it(`renders ${type} as ${label} and preserves the event date`, () => {
        assert.equal(formatHomepageRecentUpdateMeta(type, '6 Oct 2026', '16 Oct 2026', language),
          `${label} 6 Oct 2026 · ${language === 'sl' ? 'dogodek' : 'event'} 16 Oct 2026`);
      });
    }
    it('does not label unknown types as Updated/Posodobljeno', () => {
      for (const type of [undefined, null, '', 'unknown', 'unconfirmed', 'toString', '__proto__']) {
        assert.equal(formatHomepageRecentUpdateMeta(type, '6 Oct 2026', '16 Oct 2026', language), '16 Oct 2026');
        assert.equal(formatHomepageRecentUpdateMeta(type, '6 Oct 2026', '', language), '');
      }
    });
    it('preserves the event date when the change date is absent', () => {
      assert.equal(formatHomepageRecentUpdateMeta('new', '', '16 Oct 2026', language), '16 Oct 2026');
    });
  });
}

it('preserves explicit API types, including unknown values, through global sorting', () => {
  const selection = selectHomepageRecentUpdates({
    updatedEvents: [
      { row: '1', update_type: 'unknown', recent_update_date: '2026-10-07' },
      { row: '2', update_type: 'new', recent_update_date: '2026-10-06' },
      { row: '3', event: { update_type: 'confirmed' }, recent_update_date: '2026-10-05' }
    ], newEvents: [], confirmedEvents: []
  });
  assert.deepEqual(selection.items.map(({ update_type }) => update_type), ['unknown', 'new', 'confirmed']);
});

it('does not infer missing, null or empty update types from a typed group', () => {
  for (const type of [undefined, null, '']) {
    const selection = selectHomepageRecentUpdates({
      updatedEvents: [{ row: '1', update_type: type, recent_update_date: '2026-10-06' }],
      newEvents: [], confirmedEvents: []
    });
    assert.equal(selection.items[0].update_type, type);
    assert.equal(formatHomepageRecentUpdateMeta(selection.items[0].update_type, '6 Oct', '16 Oct', 'en'), '16 Oct');
  }
});
