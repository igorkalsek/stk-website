import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  SAVED_RACES_STORAGE_KEY,
  LEGACY_SAVED_RACES_STORAGE_KEY,
  MAX_SAVED_RACES,
  SAVED_RACE_STATUSES,
  getSavedRaceStatus,
  isSavedRaceStatus,
  addSavedRace,
  dedupeSavedRaces,
  isRaceSaved,
  parseSavedRacesJson,
  readSavedRaces,
  removeSavedRace,
  setSavedRaceStatus,
  toggleSavedRace,
  writeSavedRaces
} from '../.cache/dist-test/utils-saved-races.js';

const race = (eventId = 'r000173', year = '2026') => ({ eventId, year, date: `${year}-05-10`, title: 'Testni tek' });
const state = (races = []) => ({ version: 2, races: races.map((item) => ({ version: 2, status: 'following', ...item })) });
const legacyState = (races = []) => ({ version: 1, races: races.map((item) => ({ version: 1, ...item })) });
const memoryStorage = (initial = null) => {
  const values = new Map();
  if (initial) values.set(SAVED_RACES_STORAGE_KEY, initial);
  return { getItem: (key) => values.has(key) ? values.get(key) : null, setItem: (key, next) => { values.set(key, next); }, removeItem: (key) => { values.delete(key); }, value: (key = SAVED_RACES_STORAGE_KEY) => values.get(key) ?? null, has: (key) => values.has(key) };
};

describe('saved races storage model', () => {
  it('handles empty storage', () => assert.deepEqual(readSavedRaces(memoryStorage()).state.races, []));
  it('reads valid records', () => assert.equal(readSavedRaces(memoryStorage(JSON.stringify(state([race()])))).state.races[0].eventId, 'r000173'));
  it('ignores invalid JSON', () => assert.deepEqual(parseSavedRacesJson('{nope'), null));
  it('ignores wrong versions', () => assert.deepEqual(parseSavedRacesJson(JSON.stringify({ version: 1, races: [race()] })), null));
  it('validates statuses', () => { assert.deepEqual(SAVED_RACE_STATUSES, ['following', 'planning', 'registered', 'completed']); assert.equal(isSavedRaceStatus('registered'), true); assert.equal(isSavedRaceStatus('bad'), false); });
  it('defaults missing or invalid V2 status to following', () => assert.equal(parseSavedRacesJson(JSON.stringify({ version: 2, races: [{ version: 2, ...race(), status: 'bad' }, { version: 2, ...race('r000174') }] })).races[0].status, 'following'));
  it('keeps valid records when some records are invalid', () => assert.deepEqual(parseSavedRacesJson(JSON.stringify({ version: 2, races: [{ nope: true }, { version: 2, ...race() }] })).races.map((item) => item.eventId), ['r000173']));
  it('deduplicates by year and eventId', () => assert.equal(dedupeSavedRaces([{ version: 2, ...race() }, { version: 2, ...race(), title: 'Duplicate' }]).length, 1));
  it('treats same eventId in different years as distinct', () => {
    const saved = state([race('r000173', '2026'), race('r000173', '2027')]);
    assert.equal(isRaceSaved(saved, race('r000173', '2026')), true);
    assert.equal(isRaceSaved(saved, race('r000173', '2027')), true);
  });
  it('adds a race with default following status', () => { const added = addSavedRace(state(), race()); assert.equal(added.races.length, 1); assert.equal(added.races[0].status, 'following'); });
  it('adds a race with explicit status', () => assert.equal(addSavedRace(state(), { ...race(), status: 'registered' }).races[0].status, 'registered'));
  it('gets and changes a race status without duplicating', () => { const changed = setSavedRaceStatus(state([race()]), race(), 'completed'); assert.equal(getSavedRaceStatus(changed, race()), 'completed'); assert.equal(changed.races.length, 1); });
  it('setting status on an unsaved race adds it', () => assert.equal(setSavedRaceStatus(state(), race(), 'planning').races[0].status, 'planning'));
  it('removes a race', () => assert.equal(removeSavedRace(state([race()]), race()).races.length, 0));
  it('toggles a race on and off', () => {
    const on = toggleSavedRace(state(), race());
    assert.equal(on.saved, true);
    assert.equal(on.state.races[0].status, 'following');
    const off = toggleSavedRace(on.state, race());
    assert.equal(off.saved, false);
    assert.equal(off.state.races.length, 0);
  });
  it('handles storage getItem exceptions', () => assert.equal(readSavedRaces({ getItem: () => { throw new Error('blocked'); }, setItem() {}, removeItem() {} }).persistent, false));
  it('handles storage setItem exceptions', () => assert.equal(writeSavedRaces({ getItem: () => null, setItem: () => { throw new Error('full'); }, removeItem() {} }, state([race()])).persistent, false));
  it('caps the number of records', () => {
    const races = Array.from({ length: MAX_SAVED_RACES + 20 }, (_, index) => ({ version: 2, ...race(`r${String(index).padStart(6, '0')}`) }));
    assert.equal(dedupeSavedRaces(races).length, MAX_SAVED_RACES);
  });
  it('migrates V1 to V2, defaults following, deduplicates, and removes legacy after write', () => {
    const storage = memoryStorage();
    storage.setItem(LEGACY_SAVED_RACES_STORAGE_KEY, JSON.stringify(legacyState([race(), race()])));
    const result = readSavedRaces(storage);
    assert.equal(result.state.version, 2);
    assert.equal(result.state.races.length, 1);
    assert.equal(result.state.races[0].status, 'following');
    assert.equal(storage.has(LEGACY_SAVED_RACES_STORAGE_KEY), false);
  });
  it('keeps V1 when V2 persistence fails during migration', () => {
    let removed = false;
    const storage = { getItem: (key) => key === LEGACY_SAVED_RACES_STORAGE_KEY ? JSON.stringify(legacyState([race()])) : null, setItem: () => { throw new Error('full'); }, removeItem: () => { removed = true; } };
    const result = readSavedRaces(storage);
    assert.equal(result.persistent, false);
    assert.equal(result.state.races[0].status, 'following');
    assert.equal(removed, false);
  });
  it('valid V2 takes precedence over legacy V1', () => { const storage = memoryStorage(JSON.stringify(state([{ ...race('v2'), status: 'planning' }]))); storage.setItem(LEGACY_SAVED_RACES_STORAGE_KEY, JSON.stringify(legacyState([race('v1')]))); assert.equal(readSavedRaces(storage).state.races[0].eventId, 'v2'); });
  it('corrupted V2 recovers from valid legacy V1', () => { const storage = memoryStorage('{bad'); storage.setItem(LEGACY_SAVED_RACES_STORAGE_KEY, JSON.stringify(legacyState([race('legacy')]))); assert.equal(readSavedRaces(storage).state.races[0].eventId, 'legacy'); });
  it('writes to the versioned localStorage key', () => {
    const storage = memoryStorage();
    writeSavedRaces(storage, state([race()]));
    assert.match(storage.value(), /"version":2/);
    assert.equal(SAVED_RACES_STORAGE_KEY, 'stkSavedRacesV2');
  });
});

describe('saved races UI source contract', () => {
  const files = ['src/finder/race-finder-controller.ts', 'src/pages/tek/[year]/[slug].astro', 'src/pages/en/races/[year]/[slug].astro'];
  const sources = Object.fromEntries(files.map((file) => [file, readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')]));
  it('contains Slovenian and English labels', () => {
    assert.match(readFileSync(new URL('../src/finder/race-finder-locales.ts', import.meta.url), 'utf8'), /Shrani tek/);
    assert.match(readFileSync(new URL('../src/finder/race-finder-locales.ts', import.meta.url), 'utf8'), /Save race/);
  });
  it('sets aria-pressed on saved race buttons', () => files.forEach((file) => assert.match(sources[file], /aria-pressed="false"/)));
  it('adds buttons to both search pages and both detail routes', () => files.forEach((file) => assert.match(sources[file], /data-saved-race-button/)));
  it('adds analytics for saving races without inline analytics attributes on buttons', () => {
    assert.match(readFileSync(new URL('../src/saved-races-client.ts', import.meta.url), 'utf8'), /race_saved/);
    assert.match(readFileSync(new URL('../src/saved-races-client.ts', import.meta.url), 'utf8'), /race_unsaved/);
    files.forEach((file) => assert.doesNotMatch(sources[file], /saved-race-button[^`\n>]*data-analytics-event-type/));
  });
  it('updates icon-only buttons without replacing them with text', () => {
    const client = readFileSync(new URL('../src/saved-races-client.ts', import.meta.url), 'utf8');
    assert.match(client, /savedRaceIconOnly/);
    assert.match(client, /saved \? '★' : '☆'/);
    assert.match(client, /else if \(!iconOnly\) button\.textContent/);
  });
});

const createMemoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); }
  };
};

class FakeButton {
  constructor({ language = 'sl', iconOnly = false, eventId = 'r000173', year = '2026' } = {}) {
    this.dataset = { savedRaceButton: '', eventId, eventYear: year, eventDate: `${year}-05-10`, eventTitle: 'Testni tek', language };
    if (iconOnly) this.dataset.savedRaceIconOnly = 'true';
    this.attributes = new Map([['aria-pressed', 'false'], ['aria-label', language === 'en' ? 'Save race' : 'Shrani tek']]);
    this.icon = { textContent: '☆' };
    this.label = iconOnly ? null : { textContent: language === 'en' ? 'Save race' : 'Shrani tek' };
    this.listeners = new Map();
    this.classNames = new Set();
    this.classList = { toggle: (name, force) => force ? this.classNames.add(name) : this.classNames.delete(name) };
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  querySelector(selector) {
    if (selector === '.action-icon') return this.icon;
    if (selector === '[data-saved-race-label]') return this.label;
    return null;
  }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  click() { this.listeners.get('click')?.({ preventDefault() {}, stopPropagation() {} }); }
}

const createFakeDocument = (buttons) => ({
  readyState: 'loading',
  addEventListener() {},
  querySelectorAll(selector) {
    if (selector === '[data-saved-race-button]') return buttons;
    const eventId = selector.match(/data-event-id="([^"]+)"/)?.[1];
    const year = selector.match(/data-event-year="([^"]+)"/)?.[1];
    return buttons.filter((button) => button.dataset.eventId === eventId && button.dataset.eventYear === year);
  }
});

const setupSavedRaceUi = async (buttons) => {
  globalThis.window = { localStorage: createMemoryStorage() };
  globalThis.document = createFakeDocument(buttons);
  globalThis.CSS = { escape: (value) => String(value) };
  const { initSavedRaceButtons } = await import('../.cache/dist-test/saved-races-client.js');
  initSavedRaceButtons(globalThis.document);
};

describe('saved races UI interactions', () => {
  it('updates regular and icon-only icons, labels, and aria labels in Slovenian', async () => {
    const regular = new FakeButton({ language: 'sl' });
    const iconOnly = new FakeButton({ language: 'sl', iconOnly: true });
    await setupSavedRaceUi([regular, iconOnly]);

    assert.equal(regular.icon.textContent, '☆');
    assert.equal(regular.label.textContent, 'Shrani tek');
    assert.equal(regular.getAttribute('aria-label'), 'Shrani tek');
    iconOnly.click();

    assert.equal(regular.icon.textContent, '★');
    assert.equal(iconOnly.icon.textContent, '★');
    assert.equal(regular.label.textContent, 'Shranjeno');
    assert.equal(regular.getAttribute('aria-label'), 'Odstrani iz Mojih tekov');
    assert.equal(iconOnly.getAttribute('aria-label'), 'Odstrani iz Mojih tekov');
  });

  it('updates regular and icon-only icons, labels, and aria labels in English', async () => {
    const regular = new FakeButton({ language: 'en' });
    const iconOnly = new FakeButton({ language: 'en', iconOnly: true });
    await setupSavedRaceUi([regular, iconOnly]);

    assert.equal(regular.icon.textContent, '☆');
    assert.equal(regular.label.textContent, 'Save race');
    assert.equal(regular.getAttribute('aria-label'), 'Save race');
    regular.click();

    assert.equal(regular.icon.textContent, '★');
    assert.equal(iconOnly.icon.textContent, '★');
    assert.equal(regular.label.textContent, 'Saved');
    assert.equal(regular.getAttribute('aria-label'), 'Remove from My races');
    assert.equal(iconOnly.getAttribute('aria-label'), 'Remove from My races');
  });

  it('keeps all buttons for the same event synchronized without changing other events', async () => {
    const first = new FakeButton({ eventId: 'same' });
    const second = new FakeButton({ eventId: 'same', iconOnly: true });
    const other = new FakeButton({ eventId: 'other' });
    await setupSavedRaceUi([first, second, other]);

    first.click();

    assert.equal(first.icon.textContent, '★');
    assert.equal(second.icon.textContent, '★');
    assert.equal(first.getAttribute('aria-pressed'), 'true');
    assert.equal(second.getAttribute('aria-pressed'), 'true');
    assert.equal(other.icon.textContent, '☆');
    assert.equal(other.getAttribute('aria-pressed'), 'false');
  });
});
