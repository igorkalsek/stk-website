import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { countSavedRaceStatuses, filterSavedRaceResolutionsByStatus, resolveSavedRaces, sortResolvedSavedRaces } from '../.cache/dist-test/utils-my-races.js';
import { getExportableUpcomingRaceEvents, getStorage, initMyRacesPage, removeSavedRaceFromMyRaces, renderPrimaryActionLinks } from '../.cache/dist-test/my-races-client.js';

const saved = (eventId, year = '2026', date = `${year}-05-10`, title = 'Saved', status = 'following') => ({ version: 2, eventId, year, date, title, status });
const apiEvent = ({ row = '173', year = '2026', date = `${year}-05-10`, title = 'Testni tek', status = 'potrjeno', visible = 'DA' } = {}) => ({ row, datum: date, naziv_prireditve: title, kraj: 'Kranj', regija: 'Gorenjska', status_dogodka: status, vidno_v_javnem_koledarju: visible, povezava_razpis: 'https://example.com/info', povezava_prijava: 'https://example.com/register' });

describe('my races resolver', () => {
  it('resolves saved year:eventId references from public master payloads', () => {
    const items = resolveSavedRaces([saved('r000173')], { 2026: [apiEvent()] }, '2026-01-01');
    assert.equal(items[0].event?.title, 'Testni tek');
    assert.equal(items[0].status, 'upcoming');
  });

  it('keeps unresolvable references removable as past-or-unresolved', () => {
    const items = resolveSavedRaces([saved('r999999')], { 2026: [apiEvent()] }, '2026-01-01');
    assert.equal(items[0].event, null);
    assert.equal(items[0].key, '2026:r999999');
    assert.equal(items[0].status, 'past-or-unresolved');
  });

  it('filters unconfirmed and hidden API events through the existing public event mapper', () => {
    const items = resolveSavedRaces([saved('r000173'), saved('r000174')], { 2026: [apiEvent({ row: '173', status: 'osnutek' }), apiEvent({ row: '174', visible: 'NE' })] }, '2026-01-01');
    assert.deepEqual(items.map((item) => item.event), [null, null]);
  });

  it('keeps 2026 and 2027 saved races separate', () => {
    const items = resolveSavedRaces([saved('r000173', '2026'), saved('r000173', '2027')], { 2026: [apiEvent({ year: '2026' })], 2027: [apiEvent({ year: '2027' })] }, '2026-01-01');
    assert.equal(items.filter((item) => item.event).length, 2);
  });

  it('sorts upcoming resolved races by date', () => {
    const items = resolveSavedRaces([saved('r000002'), saved('r000001')], { 2026: [apiEvent({ row: '2', date: '2026-09-01' }), apiEvent({ row: '1', date: '2026-03-01' })] }, '2026-01-01');
    assert.deepEqual(sortResolvedSavedRaces(items).map((item) => item.key), ['2026:r000001', '2026:r000002']);
  });
});


describe('my races status helpers', () => {
  const items = [saved('a', '2026', '2026-01-01', 'A', 'following'), saved('b', '2026', '2026-01-02', 'B', 'registered'), saved('c', '2026', '2026-01-03', 'C', 'completed')].map((savedRace) => ({ savedRace, event: null, key: `${savedRace.year}:${savedRace.eventId}`, status: 'past-or-unresolved' }));
  it('counts statuses including unresolved references', () => assert.deepEqual(countSavedRaceStatuses(items), { following: 1, planning: 0, registered: 1, completed: 1 }));
  it('supports All and individual status filters', () => { assert.equal(filterSavedRaceResolutionsByStatus(items, 'all').length, 3); assert.deepEqual(filterSavedRaceResolutionsByStatus(items, 'registered').map((item) => item.savedRace.eventId), ['b']); });
});

describe('my races primary actions', () => {
  const event = (noticeUrl, registrationUrl) => ({ noticeUrl, registrationUrl });

  it('renders one combined action for equivalent notice and registration URLs', () => {
    const html = renderPrimaryActionLinks(event('https://example.com/race?b=2&a=1', 'https://example.com/race?a=1&b=2'), 'sl');
    assert.equal((html.match(/<a /g) ?? []).length, 1);
    assert.match(html, /Razpis in prijava/);
    assert.match(html, /rel="noopener noreferrer"/);
  });

  it('renders two actions for distinct notice and registration URLs', () => {
    const html = renderPrimaryActionLinks(event('https://example.com/info', 'https://example.com/register'), 'sl');
    assert.equal((html.match(/<a /g) ?? []).length, 2);
    assert.match(html, /Razpis/);
    assert.match(html, /Prijava/);
  });

  it('renders localized English labels for combined and distinct actions', () => {
    assert.match(renderPrimaryActionLinks(event('https://example.com/race', 'https://example.com/race/'), 'en'), /Official info and registration/);
    const distinct = renderPrimaryActionLinks(event('https://example.com/info', 'https://example.com/register'), 'en');
    assert.match(distinct, /Official info/);
    assert.match(distinct, /Registration/);
  });
});


describe('my races ICS export event selection', () => {
  it('includes only resolved upcoming events and excludes past or unresolved references', () => {
    const items = resolveSavedRaces([saved('r000173'), saved('r000174'), saved('r999999')], { 2026: [apiEvent({ row: '173', date: '2026-05-10' }), apiEvent({ row: '174', date: '2025-05-10' })] }, '2026-01-01');
    const exportable = getExportableUpcomingRaceEvents(items, 'sl');
    assert.deepEqual(exportable.map((event) => event.uid), ['2026-r000173-20260510@slovenski-tekaski-koledar']);
  });

  it('does not include hidden or unconfirmed events because they remain unresolved', () => {
    const items = resolveSavedRaces([saved('r000173'), saved('r000174')], { 2026: [apiEvent({ row: '173', visible: 'NE' }), apiEvent({ row: '174', status: 'osnutek' })] }, '2026-01-01');
    assert.deepEqual(getExportableUpcomingRaceEvents(items, 'en'), []);
  });

  it('excludes completed and past races while including active upcoming statuses and deduplicating', () => {
    const items = resolveSavedRaces([
      saved('r000171', '2026', '2026-05-08', 'Following saved', 'following'),
      saved('r000172', '2026', '2026-05-09', 'Planning saved', 'planning'),
      saved('r000173', '2026', '2026-05-10', 'Registered saved', 'registered'),
      saved('r000174', '2026', '2026-05-11', 'Completed saved', 'completed'),
      saved('r000175', '2026', '2025-05-12', 'Past saved', 'following'),
      saved('r000172', '2026', '2026-05-09', 'Duplicate planning saved', 'planning')
    ], { 2026: [
      apiEvent({ row: '171', date: '2026-05-08', title: 'Following Export Run' }),
      apiEvent({ row: '172', date: '2026-05-09', title: 'Planning Export Trail' }),
      apiEvent({ row: '173', date: '2026-05-10', title: 'Registered Export Race' }),
      apiEvent({ row: '174', date: '2026-05-11', title: 'Completed Export Race' }),
      apiEvent({ row: '175', date: '2025-05-12', title: 'Past Export Race' })
    ] }, '2026-01-01');
    assert.deepEqual(getExportableUpcomingRaceEvents(items, 'sl').map((event) => event.title), ['Following Export Run', 'Planning Export Trail', 'Registered Export Race']);
  });

  it('deduplicates by year:eventId and supports 2026 plus 2027 in one export list', () => {
    const items = resolveSavedRaces([saved('r000173', '2026'), saved('r000173', '2026'), saved('r000173', '2027')], { 2026: [apiEvent({ year: '2026', date: '2026-06-01' })], 2027: [apiEvent({ year: '2027', date: '2027-06-01' })] }, '2026-01-01');
    const exportable = getExportableUpcomingRaceEvents(items, 'sl');
    assert.deepEqual(exportable.map((event) => event.uid), ['2026-r000173-20260601@slovenski-tekaski-koledar', '2027-r000173-20270601@slovenski-tekaski-koledar']);
  });
});


describe('my races remove analytics', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const storageWith = (races) => {
    let value = JSON.stringify({ version: 2, races: races.map((item) => ({ version: 2, ...item })) });
    return { getItem: () => value, setItem: (_key, next) => { value = next; }, removeItem() {} };
  };
  const installAnalyticsBrowser = () => {
    const payloads = [];
    globalThis.window = { location: { pathname: '/moji-teki/', search: '', href: 'https://tekaski-koledar.si/moji-teki/' }, localStorage: { getItem: () => null }, setTimeout: (callback) => { callback(); return 0; } };
    globalThis.document = { referrer: '', body: {} };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'node-test', maxTouchPoints: 0, sendBeacon: (_url, blob) => { payloads.push(blob.text().then((text) => JSON.parse(text))); return true; } } });
    return payloads;
  };
  const restoreBrowser = () => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    if (originalNavigatorDescriptor) Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
    else delete globalThis.navigator;
  };

  it('emits one race_unsaved after a successful local removal', async () => {
    const payloads = installAnalyticsBrowser();
    const storage = storageWith([saved('r000173', '2026', '2026-05-10', 'Saved title')]);
    assert.equal(removeSavedRaceFromMyRaces(storage, { eventId: 'r000173', year: '2026' }, { eventName: 'Resolved title', eventDate: '2026-05-10', language: 'sl' }), true);
    const sent = await Promise.all(payloads);
    assert.equal(sent.length, 1);
    assert.deepEqual({ event_type: sent[0].event_type, event_id: sent[0].event_id, event_name: sent[0].event_name, event_date: sent[0].event_date, event_year: sent[0].event_year, language: sent[0].language, placement: sent[0].placement }, { event_type: 'race_unsaved', event_id: 'r000173', event_name: 'Resolved title', event_date: '2026-05-10', event_year: '2026', language: 'sl', placement: 'my_races' });
    restoreBrowser();
  });

  it('does not emit race_unsaved for a missing saved race', async () => {
    const payloads = installAnalyticsBrowser();
    const storage = storageWith([saved('r000173')]);
    assert.equal(removeSavedRaceFromMyRaces(storage, { eventId: 'r999999', year: '2026' }, { language: 'sl' }), false);
    assert.equal((await Promise.all(payloads)).length, 0);
    restoreBrowser();
  });

  it('does not emit race_unsaved when storage write fails', async () => {
    const payloads = installAnalyticsBrowser();
    const storage = { getItem: () => JSON.stringify({ version: 2, races: [{ version: 2, ...saved('r000173') }] }), setItem: () => { throw new Error('blocked'); }, removeItem() {} };
    assert.equal(removeSavedRaceFromMyRaces(storage, { eventId: 'r000173', year: '2026' }, { language: 'sl' }), false);
    assert.equal((await Promise.all(payloads)).length, 0);
    restoreBrowser();
  });
});

describe('my races storage fallback', () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;

  it('returns null when window.localStorage access throws', () => {
    globalThis.window = Object.defineProperty({}, 'localStorage', { get() { throw new Error('blocked'); } });
    assert.equal(getStorage(), null);
    globalThis.window = originalWindow;
  });

  it('does not crash or render remove buttons when storage is blocked', async () => {
    globalThis.window = Object.defineProperty({}, 'localStorage', { get() { throw new Error('blocked'); } });
    globalThis.fetch = () => { throw new Error('fetch should not run without storage'); };
    const mount = { dataset: { language: 'en' }, innerHTML: '', querySelectorAll: () => [] };
    const root = { querySelector: () => mount };
    await assert.doesNotReject(() => initMyRacesPage(root));
    assert.match(mount.innerHTML, /The browser currently does not allow access to saved races\./);
    assert.doesNotMatch(mount.innerHTML, /data-remove-saved-race/);
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  });
});

describe('my races page source contract', () => {
  const sl = readFileSync(new URL('../src/pages/moji-teki.astro', import.meta.url), 'utf8');
  const en = readFileSync(new URL('../src/pages/en/my-races/index.astro', import.meta.url), 'utf8');
  const client = readFileSync(new URL('../src/my-races-client.ts', import.meta.url), 'utf8');

  it('adds Slovenian and English routes', () => {
    assert.match(sl, /Moji teki/);
    assert.match(en, /My races/);
  });

  it('uses the existing saved races storage key through utilities', () => assert.match(client, /readSavedRaces/));
  it('implements only upcoming local ICS export without changing storage', () => {
    assert.match(client, /data-download-upcoming-races-ics/);
    assert.match(client, /moji-teki\.ics/);
    assert.match(client, /my-races\.ics/);
    assert.match(client, /Blob\(\[ics\]/);
    assert.match(client, /URL\.createObjectURL/);
    assert.match(client, /URL\.revokeObjectURL/);
    assert.doesNotMatch(client, /allSaved|bulkIcs/i);
    assert.match(client, /my_races_bulk_ics_exported/);
    assert.match(client, /results_count: events.length/);
    assert.match(client, /addEventListener\('click', \(\) => downloadUpcomingRacesIcs\(exportableUpcoming/);
  });
  it('includes fallback copy for API outages and local-only storage', () => {
    assert.match(client, /API trenutno ni dosegljiv/);
    assert.match(client, /do not sync between devices/);
    assert.match(client, /Brskalnik trenutno ne dovoljuje dostopa do shranjenih tekov/);
  });
});
