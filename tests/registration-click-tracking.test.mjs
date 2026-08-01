import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, describe, it } from 'node:test';
import { initializeStkAnalyticsClickTracking } from '../.cache/dist-test/lib/stkAnalytics.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const finder = read('src/finder/race-finder-controller.ts');
const slDetail = read('src/pages/tek/[year]/[slug].astro');
const enDetail = read('src/pages/en/races/[year]/[slug].astro');

const originals = {
  window: globalThis.window,
  document: globalThis.document,
  Element: globalThis.Element,
  HTMLElement: globalThis.HTMLElement,
  HTMLAnchorElement: globalThis.HTMLAnchorElement,
  navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator')
};

after(() => {
  globalThis.window = originals.window;
  globalThis.document = originals.document;
  globalThis.Element = originals.Element;
  globalThis.HTMLElement = originals.HTMLElement;
  globalThis.HTMLAnchorElement = originals.HTMLAnchorElement;
  if (originals.navigator) Object.defineProperty(globalThis, 'navigator', originals.navigator);
  else delete globalThis.navigator;
});

describe('registration click writer compatibility contract', () => {
  it('marks registration actions in both localized finders and detail pages', () => {
    assert.match(finder, /data-analytics-link-type="\$\{escapeHtml\(action\.analyticsType\)\}"/);
    for (const detail of [slDetail, enDetail]) {
      assert.match(detail, /data-analytics-link-type=\{action\.analyticsType\}/);
      assert.match(detail, /data-analytics-event-id=\{event\.id\}/);
      assert.match(detail, /data-analytics-event-year=\{event\.year\}/);
    }
  });

  it('normalizes old and new aliases once while preserving full event identity and destination', async () => {
    const pending = [];
    let clickHandler;

    class FakeElement {
      constructor({ dataset = {}, parent = null, href = '', text = '', tag = 'a' } = {}) {
        this.dataset = dataset;
        this.parent = parent;
        this.href = href;
        this.text = text;
        this.tag = tag;
        this.target = '_blank';
      }
      get textContent() { return this.text; }
      getAttribute(name) { return name === 'href' ? this.href : null; }
      hasAttribute() { return false; }
      querySelector() { return null; }
      closest(selector) {
        if (selector === 'a[href], button[data-analytics-event-type], button[data-analytics-action-type]') return this.tag === 'a' && this.href ? this : null;
        let node = this;
        while (node) {
          if (selector.includes('[data-analytics-event-name]') && node.dataset.analyticsEventName) return node;
          node = node.parent;
        }
        return null;
      }
    }

    globalThis.Element = FakeElement;
    globalThis.HTMLElement = FakeElement;
    globalThis.HTMLAnchorElement = FakeElement;
    globalThis.window = {
      location: { pathname: '/iskalnik-tekov/', search: '', href: 'https://tekaski-koledar.si/iskalnik-tekov/' },
      localStorage: { getItem: () => null },
      setTimeout: (callback) => { callback(); return 0; }
    };
    globalThis.document = { referrer: '', addEventListener: (type, handler) => { if (type === 'click') clickHandler = handler; } };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
      userAgent: 'node-test', maxTouchPoints: 0,
      sendBeacon: (_url, blob) => { pending.push(blob.text().then(JSON.parse)); return true; }
    } });

    initializeStkAnalyticsClickTracking();
    const click = (action, year = '2026', id = 'r000123', text = '') => {
      const card = new FakeElement({ tag: 'article', dataset: {
        analyticsEventId: id, analyticsEventName: 'Testni tek', analyticsEventDate: `${year}-09-12`,
        analyticsEventYear: year, analyticsPlacement: 'finder_results'
      } });
      const link = new FakeElement({ dataset: action ? { analyticsLinkType: action } : {}, parent: card, href: `https://example.com/${action || 'external'}`, text });
      clickHandler({ target: link });
    };

    // Slovenian finder, English finder, Slovenian detail and English detail use the same delegated contract.
    click('prijava');
    globalThis.window.location.pathname = '/en/find-races/'; click('registration_click');
    globalThis.window.location.pathname = '/tek/2026/test/'; click('prijava');
    globalThis.window.location.pathname = '/en/races/2026/test/'; click('prijava');
    click('razpis');
    click('trasa');
    click('map_click');
    click('organizer_website');
    click('other');
    click('', '2026', 'r000123', 'Details');
    click('prijava', '2027', 'r000123');

    const payloads = await Promise.all(pending);
    assert.equal(payloads.length, 10, 'an unmarked non-registration link does not create a classified event');
    assert.deepEqual(payloads.map(({ action_type }) => action_type), [
      'prijava', 'prijava', 'prijava', 'prijava', 'razpis', 'trasa', 'trasa', 'uradna_stran', 'other', 'prijava'
    ]);
    assert.equal(payloads.filter(({ action_type }) => action_type === 'prijava').length, 5);
    assert.deepEqual(payloads[0], {
      event_type: 'external_link_clicked', page_path: '/iskalnik-tekov/', language: 'sl', event_id: 'r000123',
      event_name: 'Testni tek', event_date: '2026-09-12', event_year: '2026', target_url: 'https://example.com/prijava',
      action_type: 'prijava', search_query: '', filters_json: '', results_count: '', target_domain: 'example.com',
      calendar_type: '', referrer: '', user_agent_group: 'desktop', notes: '', placement: 'finder_results'
    });
    assert.deepEqual(payloads.filter(({ event_id }) => event_id === 'r000123').slice(-2).map(({ event_year }) => event_year), ['2026', '2027']);
  });
});
