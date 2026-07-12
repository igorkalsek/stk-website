import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, it } from 'node:test';
import { initializeStkAnalyticsClickTracking, trackStkEvent, trackStkPageLoadEventOnce } from '../.cache/dist-test/lib/stkAnalytics.js';
import { rankRacesForPreferences } from '../.cache/dist-test/utils-race-preferences.js';

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
const originalElement = globalThis.Element;
const originalHTMLElement = globalThis.HTMLElement;
const originalHTMLAnchorElement = globalThis.HTMLAnchorElement;

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
  if (originalElement) globalThis.Element = originalElement;
  else delete globalThis.Element;
  if (originalHTMLElement) globalThis.HTMLElement = originalHTMLElement;
  else delete globalThis.HTMLElement;
  if (originalHTMLAnchorElement) globalThis.HTMLAnchorElement = originalHTMLAnchorElement;
  else delete globalThis.HTMLAnchorElement;
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
  it('tracks one related-race child-link click with target related card identity', async () => {
    const payloads = [];
    let clickHandler;
    class FakeElement {
      constructor({ dataset = {}, parent = null, href = '', tag = 'div', className = '', target = '' } = {}) {
        this.dataset = dataset;
        this.parent = parent;
        this.href = href ? `https://tekaski-koledar.si${href}` : '';
        this.rawHref = href;
        this.tag = tag;
        this.className = className;
        this.target = target;
      }
      getAttribute(name) { return name === 'href' ? this.rawHref : null; }
      hasAttribute() { return false; }
      querySelector(selector) {
        if (selector === 'h3') return { textContent: this.dataset.stkEventName || '' };
        if (selector === 'time') return { getAttribute: (name) => name === 'datetime' ? this.dataset.stkEventDate || '' : null };
        return null;
      }
      closest(selector) {
        if (selector === 'a[href], button[data-analytics-event-type], button[data-analytics-action-type]') return this.tag === 'a' ? this : null;
        let node = this;
        while (node) {
          if (selector.includes('[data-stk-event-id]') && node.dataset.stkEventId) return node;
          if (selector.includes('.related-race-card') && node.className.split(' ').includes('related-race-card')) return node;
          node = node.parent;
        }
        return null;
      }
      get textContent() { return ''; }
    }
    globalThis.Element = FakeElement;
    globalThis.HTMLElement = FakeElement;
    globalThis.HTMLAnchorElement = FakeElement;
    globalThis.window = {
      location: { pathname: '/tek/2026/source/', search: '', href: 'https://tekaski-koledar.si/tek/2026/source/' },
      localStorage: { getItem: () => null },
      setTimeout: (callback) => { callback(); return 0; }
    };
    globalThis.document = { referrer: '', body: {}, addEventListener: (type, handler) => { if (type === 'click') clickHandler = handler; } };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
      userAgent: 'node-test',
      maxTouchPoints: 0,
      sendBeacon: (_url, blob) => { payloads.push(blob.text().then((text) => JSON.parse(text))); return true; }
    } });

    const card = new FakeElement({
      className: 'related-race-card',
      dataset: { stkEventId: 'rel-123', stkEventName: 'Sorodni tek', stkEventDate: '2026-09-12', stkEventYear: '2026', analyticsPlacement: 'related_races' }
    });
    const link = new FakeElement({ tag: 'a', href: '/tek/2026/sorodni-tek/', parent: card });
    initializeStkAnalyticsClickTracking();
    clickHandler({ target: link });

    const sent = await Promise.all(payloads);
    if (originalElement) globalThis.Element = originalElement;
    else delete globalThis.Element;
    if (originalHTMLElement) globalThis.HTMLElement = originalHTMLElement;
    else delete globalThis.HTMLElement;
    if (originalHTMLAnchorElement) globalThis.HTMLAnchorElement = originalHTMLAnchorElement;
    else delete globalThis.HTMLAnchorElement;
    assert.equal(sent.length, 1);
    assert.equal(sent[0].event_type, 'related_race_clicked');
    assert.equal(sent[0].event_id, 'rel-123');
    assert.equal(sent[0].event_year, '2026');
    assert.equal(sent[0].placement, 'related_races');
  });


  it('emits one safe personalized-results payload for a valid my-races ranking signature', () => {
    const events = [
      { id: 'fast-10k', title: 'Fast 10K', date: '2026-09-12', place: 'Ljubljana', distances: '10', surface: 'cesta/asfalt', region: 'osrednjeslovenska', familyFriendly: false },
      { id: 'trail-5k', title: 'Trail 5K', date: '2026-09-13', place: 'Maribor', distances: '5', surface: 'trail', region: 'podravska', familyFriendly: true }
    ];
    const preferences = { version: 1, active: true, distanceBuckets: ['10k'], surfaceCategories: ['road'], regions: [], familyFriendly: false };
    const filters = { search: 'private free text', month: '', region: '', surface: '', distance: '', registrationFee: '', deadlineFilter: '', elevation: '', family: false, dayOfRegistration: false, route: false, quickPick: '', sort: 'my-races' };
    const sent = [];
    const renderPersonalized = (scope = { lastSignature: '' }, nextFilters = filters) => {
      const matches = rankRacesForPreferences({ events, preferences });
      const signature = JSON.stringify({ filters: { ...nextFilters, search: '' }, results: matches.map((match) => match.event.id) });
      if (nextFilters.sort === 'my-races' && signature !== scope.lastSignature) {
        scope.lastSignature = signature;
        const { search, sort, ...safeFilters } = nextFilters;
        sent.push({ event_type: 'personalized_results_used', results_count: matches.length, filters_json: JSON.stringify({ ...safeFilters, sortBy: 'my-races' }), language: 'sl', placement: 'personalized_results' });
      }
      return scope;
    };

    const firstScope = renderPersonalized();
    renderPersonalized(firstScope);
    renderPersonalized(firstScope, { ...filters, distance: '10k' });
    renderPersonalized();

    assert.equal(sent.length, 3);
    assert.equal(sent[0].event_type, 'personalized_results_used');
    assert.equal(sent[0].results_count, 1);
    assert.equal(sent[0].language, 'sl');
    assert.equal(sent[0].placement, 'personalized_results');
    assert.equal(JSON.parse(sent[0].filters_json).sortBy, 'my-races');
    assert.doesNotMatch(sent[0].filters_json, /private free text/);
    assert.doesNotMatch(sent[0].filters_json, /fast-10k|trail-5k/);
  });

  it('documents personalized ranking analytics dedupe and safe payload contract', () => {
    for (const finder of [slFinder, enFinder]) {
      assert.match(finder, /let personalizedResultsLastSignature = ''/);
      assert.match(finder, /let personalizedResultsSignature = ''/);
      assert.match(finder, /filters\.sort === 'my-races' && hasPreferences\(\)[\s\S]{0,140}rankRacesForPreferences/);
      assert.match(finder, /personalizedResultsSignature = JSON\.stringify\(\{ filters: \{ \.\.\.filters, search: '' \}, results: matches\.map\(\(match\) => match\.event\.id\) \}\)/);
      assert.match(finder, /personalizedResultsSignature && personalizedResultsSignature !== personalizedResultsLastSignature/);
      assert.match(finder, /filtersToAnalyticsJson\(\{ \.\.\.safePersonalizedFilters, sortBy: 'my-races' \}\)/);
      assert.doesNotMatch(finder, /personalized_results_used[\s\S]{0,360}localStorage/);
      assert.doesNotMatch(finder, /personalized_results_used[\s\S]{0,360}search_query/);
    }
  });

});
