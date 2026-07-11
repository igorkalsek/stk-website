import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { resolveSavedRaces, sortResolvedSavedRaces } from '../.cache/dist-test/utils-my-races.js';
import { getExportableUpcomingRaceEvents, getStorage, initMyRacesPage, renderPrimaryActionLinks } from '../.cache/dist-test/my-races-client.js';

const saved = (eventId, year = '2026', date = `${year}-05-10`, title = 'Saved') => ({ version: 1, eventId, year, date, title });
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

  it('deduplicates by year:eventId and supports 2026 plus 2027 in one export list', () => {
    const items = resolveSavedRaces([saved('r000173', '2026'), saved('r000173', '2026'), saved('r000173', '2027')], { 2026: [apiEvent({ year: '2026', date: '2026-06-01' })], 2027: [apiEvent({ year: '2027', date: '2027-06-01' })] }, '2026-01-01');
    const exportable = getExportableUpcomingRaceEvents(items, 'sl');
    assert.deepEqual(exportable.map((event) => event.uid), ['2026-r000173-20260601@slovenski-tekaski-koledar', '2027-r000173-20270601@slovenski-tekaski-koledar']);
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
  it('implements only upcoming local ICS export without changing storage or adding analytics', () => {
    assert.match(client, /data-download-upcoming-races-ics/);
    assert.match(client, /moji-teki\.ics/);
    assert.match(client, /my-races\.ics/);
    assert.match(client, /Blob\(\[ics\]/);
    assert.match(client, /URL\.createObjectURL/);
    assert.match(client, /URL\.revokeObjectURL/);
    assert.doesNotMatch(client, /allSaved|bulkIcs|analytics/i);
    assert.match(client, /addEventListener\('click', \(\) => downloadUpcomingRacesIcs\(exportableUpcoming/);
  });
  it('includes fallback copy for API outages and local-only storage', () => {
    assert.match(client, /API trenutno ni dosegljiv/);
    assert.match(client, /does not sync between devices/);
    assert.match(client, /Brskalnik trenutno ne dovoljuje dostopa do shranjenih tekov/);
  });
});
