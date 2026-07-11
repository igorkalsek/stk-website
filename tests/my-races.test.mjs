import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { resolveSavedRaces, sortResolvedSavedRaces } from '../.cache/dist-test/utils-my-races.js';

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

describe('my races page source contract', () => {
  const sl = readFileSync(new URL('../src/pages/moji-teki.astro', import.meta.url), 'utf8');
  const en = readFileSync(new URL('../src/pages/en/my-races/index.astro', import.meta.url), 'utf8');
  const client = readFileSync(new URL('../src/my-races-client.ts', import.meta.url), 'utf8');

  it('adds Slovenian and English routes', () => {
    assert.match(sl, /Moji teki/);
    assert.match(en, /My races/);
  });

  it('uses the existing saved races storage key through utilities', () => assert.match(client, /readSavedRaces/));
  it('does not implement all-saved-races ICS export', () => assert.doesNotMatch(client, /allSaved|exportAll|bulkIcs/i));
  it('includes fallback copy for API outages and local-only storage', () => {
    assert.match(client, /API trenutno ni dosegljiv/);
    assert.match(client, /does not sync between devices/);
  });
});
