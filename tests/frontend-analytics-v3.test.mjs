import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, it } from 'node:test';
import { trackStkEvent, trackStkPageLoadEventOnce } from '../.cache/dist-test/lib/stkAnalytics.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const analytics = read('src/lib/stkAnalytics.ts');
const savedClient = read('src/saved-races-client.ts');
const myRacesClient = read('src/my-races-client.ts');
const slFinder = read('src/pages/iskalnik-tekov.astro');
const enFinder = read('src/pages/en/find-races.astro');
const related = read('src/components/RelatedRaceCards.astro');
const slDetail = read('src/pages/tek/[year]/[slug].astro');
const enDetail = read('src/pages/en/races/[year]/[slug].astro');
const slFamily = read('src/pages/druzinam-prijazni-teki.astro');
const enFamily = read('src/pages/en/family-friendly-races.astro');

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

const installAnalyticsBrowser = () => {
  const payloads = [];
  globalThis.window = {
    location: { pathname: '/test/', search: '', href: 'https://tekaski-koledar.si/test/' },
    localStorage: { getItem: () => null },
    setTimeout: (callback) => { callback(); return 0; }
  };
  globalThis.document = { referrer: '', body: {} };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    userAgent: 'node-test',
    maxTouchPoints: 0,
    sendBeacon: (_url, blob) => { payloads.push(blob.text().then((text) => JSON.parse(text))); return true; }
  } });
  return payloads;
};

afterEach(() => {
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
  if (originalNavigatorDescriptor) Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
  else delete globalThis.navigator;
});

describe('frontend analytics v3 contract', () => {
  it('keeps existing events and allows all new frontend event types', () => {
    for (const eventType of ['search_performed', 'no_results_search', 'external_link_clicked', 'calendar_add_clicked', 'vote_clicked', 'tekobot_clicked', 'share_clicked', 'correction_clicked', 'copy_clicked', 'race_saved', 'race_unsaved', 'event_detail_viewed', 'event_card_clicked', 'related_race_clicked', 'my_races_viewed', 'my_races_bulk_ics_exported', 'personalized_results_used']) {
      assert.match(analytics, new RegExp(`'${eventType}'`));
    }
  });

  it('serializes placement with the writer-approved allowlist', () => {
    for (const placement of ['home_featured', 'home_this_week', 'home_interest', 'finder_results', 'family_results', 'most_voted_results', 'race_detail', 'related_races', 'my_races', 'personalized_results', 'personal_calendar', 'unknown']) {
      assert.match(analytics, new RegExp(`'${placement}'`));
    }
    assert.match(analytics, /placement: normalizePlacement\(payload\.placement\)/);
  });

  it('tracks save and unsave only after an actual local state change', () => {
    assert.match(savedClient, /before === result\.saved\) return/);
    assert.match(savedClient, /event_type: result\.saved \? 'race_saved' : 'race_unsaved'/);
  });

  it('deduplicates page-load detail and my-races views without localStorage', () => {
    assert.match(analytics, /pageLoadTrackedEventsByScope = new WeakMap<object, Set<string>>/);
    assert.match(slDetail, /event_detail_viewed/);
    assert.match(enDetail, /event_detail_viewed/);
    assert.match(myRacesClient, /my_races_viewed/);
  });

  it('assigns placements for finder cards, related races, my races, and personalized results', () => {
    assert.match(slFinder, /data-analytics-placement="finder_results"/);
    assert.match(enFinder, /data-analytics-placement="finder_results"/);
    assert.match(slFamily, /data-analytics-placement="family_results"[\s\S]{0,260}data-analytics-event-year="\$\{escapeHtml\(event\.date\.slice\(0, 4\)\)\}"/);
    assert.match(enFamily, /data-analytics-placement="family_results"[\s\S]{0,260}data-analytics-event-year="\$\{escapeHtml\(event\.date\.slice\(0, 4\)\)\}"/);
    assert.match(related, /data-analytics-placement="related_races"/);
    assert.match(myRacesClient, /data-analytics-placement="my_races"/);
    assert.match(slFinder, /placement: 'personalized_results'/);
    assert.match(enFinder, /placement: 'personalized_results'/);
  });

  it('tracks related clicks with target card identity and suppresses duplicate listener registration', () => {
    assert.match(analytics, /placement === 'related_races' \? 'related_race_clicked' : 'event_card_clicked'/);
    assert.match(analytics, /getEventContext\(link\)/);
    assert.match(analytics, /hasInitializedStkAnalyticsClickTracking/);
  });

  it('allows the same page-load event again for a new page-load scope', async () => {
    const payloads = installAnalyticsBrowser();
    const eventPayload = { event_type: 'my_races_viewed', language: 'sl', placement: 'my_races' };
    const firstScope = {};
    const secondScope = {};
    trackStkPageLoadEventOnce('my-races', eventPayload, firstScope);
    trackStkPageLoadEventOnce('my-races', eventPayload, firstScope);
    trackStkPageLoadEventOnce('my-races', eventPayload, secondScope);
    assert.deepEqual((await Promise.all(payloads)).map((payload) => payload.event_type), ['my_races_viewed', 'my_races_viewed']);
  });

  it('suppresses invalid event-scoped payloads without blocking valid fallbacks', async () => {
    const payloads = installAnalyticsBrowser();
    trackStkEvent({ event_type: 'event_card_clicked', event_id: 'r000001', event_name: 'Missing year', event_date: '2026-05-10', placement: 'finder_results' });
    trackStkEvent({ event_type: 'event_card_clicked', event_name: 'Fallback race', event_date: '2026-05-10', event_year: '2026', placement: 'finder_results' });
    assert.deepEqual((await Promise.all(payloads)).map((payload) => payload.event_name), ['Fallback race']);
  });

  it('tracks bulk ICS export count and omits free search text from personalized-results payloads', () => {
    assert.match(myRacesClient, /results_count: events.length/);
    assert.match(myRacesClient, /calendar_type: 'ics'/);
    assert.match(slFinder, /const \{ search, \.\.\.safePersonalizedFilters \} = filters/);
    assert.doesNotMatch(slFinder, /personalized_results_used[\s\S]{0,240}search_query/);
    assert.doesNotMatch(enFinder, /personalized_results_used[\s\S]{0,240}search_query/);
  });
});
