import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { initializeStkAnalyticsClickTracking, normalizeOrganizerPlacement } from '../.cache/dist-test/lib/stkAnalytics.js';

const organizerPage = readFileSync('src/components/OrganizerPage.astro', 'utf8');
const organizerWorkflow = readFileSync('src/components/OrganizerWorkflow.astro', 'utf8');

test('organizer placement values use the backend contract and fail safely', () => {
  assert.equal(normalizeOrganizerPlacement('workflow'), 'organizer_workflow');
  assert.equal(normalizeOrganizerPlacement('hero'), 'organizer_home');
  assert.equal(normalizeOrganizerPlacement('main'), 'organizer_home');
  assert.equal(normalizeOrganizerPlacement('planner_final'), 'unknown');
  assert.equal(normalizeOrganizerPlacement(undefined), 'unknown');
});

test('SL and EN organizer links share the five-action analytics contract', () => {
  for (const action of ['check_2027_dates', 'confirm_race', 'find_race', 'add_race', 'view_organizer_stats_info']) {
    assert.match(`${organizerPage}\n${organizerWorkflow}`, new RegExp(action));
  }
  for (const route of ['/za-organizatorje/', '/en/for-organizers/', '/iskalnik-tekov/', '/en/find-races/', '/dodaj-ali-popravi-tek/', '/en/add-or-correct-race/']) {
    assert.match(organizerPage, new RegExp(route.replaceAll('/', '\\/')));
  }
  assert.match(organizerWorkflow, /const steps = en \?/);
  assert.doesNotMatch(organizerWorkflow, /data-analytics-event-type/);
});

test('delegated organizer clicks emit once, remain navigable, avoid external analytics, and honor opt-out', async () => {
  const payloads = [];
  let clickHandler;
  let optedOut = false;

  class FakeElement {
    constructor({ tag = 'a', href = '', dataset = {}, parent = null } = {}) {
      this.tag = tag;
      this.rawHref = href;
      this.href = href ? `https://tekaski-koledar.si${href}` : '';
      this.dataset = dataset;
      this.parent = parent;
      this.target = '';
    }
    closest(selector) {
      if (selector === 'a[href], button[data-analytics-event-type], button[data-analytics-action-type]') {
        let node = this;
        while (node) {
          if (node.tag === 'a' && node.rawHref) return node;
          node = node.parent;
        }
      }
      return null;
    }
    getAttribute(name) { return name === 'href' ? this.rawHref : null; }
    hasAttribute() { return false; }
    querySelector() { return null; }
    get textContent() { return ''; }
  }

  const originals = {
    window: globalThis.window,
    document: globalThis.document,
    Element: globalThis.Element,
    HTMLElement: globalThis.HTMLElement,
    HTMLAnchorElement: globalThis.HTMLAnchorElement,
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  };

  globalThis.Element = FakeElement;
  globalThis.HTMLElement = FakeElement;
  globalThis.HTMLAnchorElement = FakeElement;
  globalThis.window = {
    location: {
      pathname: '/dodaj-ali-popravi-tek/',
      search: '?event_name=Skrivni%20tek&notes=Obcutljive%20opombe&organizer_email=oseba%40example.com',
      href: 'https://tekaski-koledar.si/dodaj-ali-popravi-tek/?event_name=Skrivni%20tek&notes=Obcutljive%20opombe&organizer_email=oseba%40example.com'
    },
    localStorage: { getItem: () => optedOut ? 'true' : null },
    setTimeout: (callback) => { callback(); return 0; }
  };
  globalThis.document = {
    referrer: '',
    body: {},
    addEventListener: (type, handler) => { if (type === 'click') clickHandler = handler; }
  };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    userAgent: 'node-test',
    maxTouchPoints: 0,
    sendBeacon: (_url, blob) => { payloads.push(blob.text().then(JSON.parse)); return true; }
  } });

  try {
    initializeStkAnalyticsClickTracking();
    const cases = [
      ['check_2027_dates', 'hero', 'organizer_home'],
      ['check_2027_dates', 'workflow', 'organizer_workflow'],
      ['confirm_race', 'workflow', 'organizer_workflow'],
      ['view_organizer_stats_info', 'workflow', 'organizer_workflow'],
      ['find_race', 'main', 'organizer_home'],
      ['add_race', 'main', 'organizer_home']
    ];

    for (const [action, placement] of cases) {
      const link = new FakeElement({ href: '/destination/', dataset: { organizerAction: action, organizerPlacement: placement } });
      const event = { target: link, defaultPrevented: false };
      clickHandler(event);
      assert.equal(event.defaultPrevented, false);
      assert.equal(link.getAttribute('href'), '/destination/');
    }

    globalThis.window.location = { pathname: '/en/for-organizers/', search: '', href: 'https://tekaski-koledar.si/en/for-organizers/' };
    const unknownPlacementLink = new FakeElement({ href: '/en/find-races/', dataset: { organizerAction: 'find_race', organizerPlacement: 'new_surface' } });
    clickHandler({ target: unknownPlacementLink, defaultPrevented: false });

    const activeStep = new FakeElement({ tag: 'span', dataset: { organizerAction: 'confirm_race', organizerPlacement: 'workflow' } });
    clickHandler({ target: activeStep, defaultPrevented: false });

    optedOut = true;
    const optedOutLink = new FakeElement({ href: '/en/find-races/', dataset: { organizerAction: 'find_race', organizerPlacement: 'main' } });
    clickHandler({ target: optedOutLink, defaultPrevented: false });

    const sent = await Promise.all(payloads);
    assert.equal(sent.length, cases.length + 1);
    assert.deepEqual(sent.map(({ event_type }) => event_type), Array(sent.length).fill('organizer_action_clicked'));
    assert.equal(sent.filter(({ event_type }) => event_type === 'external_link_clicked').length, 0);
    assert.equal(sent.at(-1).placement, 'unknown');
    assert.deepEqual(new Set(sent.map(({ action_type }) => action_type)), new Set(cases.map(([action]) => action)));

    const allowedKeys = ['action_type', 'event_type', 'language', 'page_path', 'placement', 'user_agent_group'];
    const serializedPayloads = JSON.stringify(sent);
    for (const sensitiveValue of ['Skrivni', 'Obcutljive', 'oseba', 'event_name', 'notes', 'organizer_email']) {
      assert.doesNotMatch(serializedPayloads, new RegExp(sensitiveValue));
    }
    for (const [index, payload] of sent.entries()) {
      assert.deepEqual(Object.keys(payload).sort(), allowedKeys);
      assert.equal(payload.page_path, index === sent.length - 1 ? '/en/for-organizers/' : '/dodaj-ali-popravi-tek/');
      assert.equal(payload.language, index === sent.length - 1 ? 'en' : 'sl');
    }
  } finally {
    globalThis.window = originals.window;
    globalThis.document = originals.document;
    globalThis.Element = originals.Element;
    globalThis.HTMLElement = originals.HTMLElement;
    globalThis.HTMLAnchorElement = originals.HTMLAnchorElement;
    if (originals.navigator) Object.defineProperty(globalThis, 'navigator', originals.navigator);
    else delete globalThis.navigator;
  }
});
