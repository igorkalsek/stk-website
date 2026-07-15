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
    removeItem: (key) => { values.delete(key); },
    value: (key = SAVED_RACES_STORAGE_KEY) => values.get(key) ?? null
  };
};

const readStoredState = (storage) => JSON.parse(storage.value() || '{"version":2,"races":[]}');

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
  closest() { return null; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  click() { this.listeners.get('click')?.({ preventDefault() {}, stopPropagation() {} }); }
}

class FakeSelect {
  constructor({ language = 'sl', eventId = 'r000173', year = '2026' } = {}) {
    this.dataset = { raceStatusControl: '', eventId, eventYear: year, eventDate: `${year}-05-10`, eventTitle: 'Testni tek', language };
    this.value = '';
    this.options = [];
    this.listeners = new Map();
  }
  append(...options) { this.options.push(...options); }
  closest() { return null; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  change(value) { this.value = value; this.listeners.get('change')?.({}); }
}

const createFakeDocument = ({ buttons = [], controls = [] } = {}) => ({
  readyState: 'loading',
  addEventListener() {},
  querySelectorAll(selector) {
    if (selector === '[data-saved-race-button]') return buttons;
    if (selector === '[data-race-status-control]') return controls;
    const eventId = selector.match(/data-event-id="([^"]+)"/)?.[1];
    const year = selector.match(/data-event-year="([^"]+)"/)?.[1];
    if (selector.startsWith('[data-saved-race-button]')) return buttons.filter((button) => button.dataset.eventId === eventId && button.dataset.eventYear === year);
    if (selector.startsWith('[data-race-status-control]')) return controls.filter((control) => control.dataset.eventId === eventId && control.dataset.eventYear === year);
    return [];
  }
});

const setupSavedRaceUi = async ({ buttons = [], controls = [], storage = createMemoryStorage() } = {}) => {
  const payloads = [];
  globalThis.window = { localStorage: storage, location: { pathname: '/test/', search: '', href: 'https://tekaski-koledar.si/test/' }, setTimeout: (callback) => { callback(); return 0; } };
  globalThis.document = createFakeDocument({ buttons, controls });
  globalThis.CSS = { escape: (value) => String(value) };
  globalThis.Option = class { constructor(text, value) { this.text = text; this.textContent = text; this.value = value; } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'node-test', maxTouchPoints: 0, sendBeacon: (_url, blob) => { payloads.push(JSON.parse(blob.text ? '' : '{}')); return false; } } });
  globalThis.fetch = async (_url, init = {}) => { if (init.body) payloads.push(JSON.parse(String(init.body))); return { ok: true }; };
  const { initSavedRaceButtons } = await import(`../.cache/dist-test/saved-races-client.js?cache=${Date.now()}${Math.random()}`);
  initSavedRaceButtons(globalThis.document);
  return { storage, payloads, initSavedRaceButtons };
};

const analyticsEvents = (payloads, type) => payloads.filter((payload) => payload.event_type === type);
const assertNoStatusInAnalytics = (payloads) => assert.doesNotMatch(JSON.stringify(payloads), /following|planning|registered|completed|status/);

describe('saved races UI interactions', () => {
  it('updates regular and icon-only icons, labels, and aria labels in Slovenian', async () => {
    const regular = new FakeButton({ language: 'sl' });
    const iconOnly = new FakeButton({ language: 'sl', iconOnly: true });
    await setupSavedRaceUi({ buttons: [regular, iconOnly] });

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
    await setupSavedRaceUi({ buttons: [regular, iconOnly] });

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

  it('unsaved button click saves following, syncs selector, and emits race_saved once', async () => {
    const button = new FakeButton();
    const select = new FakeSelect();
    const { storage, payloads } = await setupSavedRaceUi({ buttons: [button], controls: [select] });

    button.click();

    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(select.value, 'following');
    assert.equal(readStoredState(storage).races[0].status, 'following');
    assert.equal(analyticsEvents(payloads, 'race_saved').length, 1);
    assertNoStatusInAnalytics(payloads);
  });

  it('saved button click removes the race, clears selector, and emits race_unsaved once', async () => {
    const button = new FakeButton();
    const select = new FakeSelect();
    const storage = createMemoryStorage();
    storage.setItem(SAVED_RACES_STORAGE_KEY, JSON.stringify(state([race()])));
    const { payloads } = await setupSavedRaceUi({ buttons: [button], controls: [select], storage });

    assert.equal(select.value, 'following');
    button.click();

    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.equal(select.value, '');
    assert.equal(readStoredState(storage).races.length, 0);
    assert.equal(analyticsEvents(payloads, 'race_unsaved').length, 1);
    assertNoStatusInAnalytics(payloads);
  });

  it('blank selector to planning adds the race, syncs button, and emits race_saved once', async () => {
    const button = new FakeButton();
    const select = new FakeSelect();
    const { storage, payloads } = await setupSavedRaceUi({ buttons: [button], controls: [select] });

    select.change('planning');

    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(getSavedRaceStatus(readStoredState(storage), race()), 'planning');
    assert.equal(analyticsEvents(payloads, 'race_saved').length, 1);
    assertNoStatusInAnalytics(payloads);
  });

  it('planning to registered updates the existing record without save or unsave analytics', async () => {
    const button = new FakeButton();
    const select = new FakeSelect();
    const storage = createMemoryStorage();
    storage.setItem(SAVED_RACES_STORAGE_KEY, JSON.stringify(state([{ ...race(), status: 'planning' }])));
    const { payloads } = await setupSavedRaceUi({ buttons: [button], controls: [select], storage });

    select.change('registered');

    const stored = readStoredState(storage);
    assert.equal(stored.races.length, 1);
    assert.equal(stored.races[0].status, 'registered');
    assert.equal(analyticsEvents(payloads, 'race_saved').length, 0);
    assert.equal(analyticsEvents(payloads, 'race_unsaved').length, 0);
    assertNoStatusInAnalytics(payloads);
  });

  it('saved selector to blank removes the race, syncs button, and emits race_unsaved once', async () => {
    const button = new FakeButton();
    const select = new FakeSelect();
    const storage = createMemoryStorage();
    storage.setItem(SAVED_RACES_STORAGE_KEY, JSON.stringify(state([{ ...race(), status: 'registered' }])));
    const { payloads } = await setupSavedRaceUi({ buttons: [button], controls: [select], storage });

    select.change('');

    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.equal(readStoredState(storage).races.length, 0);
    assert.equal(analyticsEvents(payloads, 'race_unsaved').length, 1);
    assertNoStatusInAnalytics(payloads);
  });

  it('keeps all controls for the same event synchronized without changing other events', async () => {
    const first = new FakeButton({ eventId: 'same' });
    const second = new FakeButton({ eventId: 'same', iconOnly: true });
    const firstSelect = new FakeSelect({ eventId: 'same' });
    const secondSelect = new FakeSelect({ eventId: 'same' });
    const other = new FakeButton({ eventId: 'other' });
    const otherSelect = new FakeSelect({ eventId: 'other' });
    await setupSavedRaceUi({ buttons: [first, second, other], controls: [firstSelect, secondSelect, otherSelect] });

    firstSelect.change('planning');

    assert.equal(first.getAttribute('aria-pressed'), 'true');
    assert.equal(second.getAttribute('aria-pressed'), 'true');
    assert.equal(firstSelect.value, 'planning');
    assert.equal(secondSelect.value, 'planning');
    assert.equal(other.getAttribute('aria-pressed'), 'false');
    assert.equal(otherSelect.value, '');
  });

  it('initializer is idempotent for buttons and status controls', async () => {
    const button = new FakeButton();
    const select = new FakeSelect();
    const { storage, payloads, initSavedRaceButtons } = await setupSavedRaceUi({ buttons: [button], controls: [select] });
    initSavedRaceButtons(globalThis.document);

    select.change('planning');

    assert.equal(readStoredState(storage).races.length, 1);
    assert.equal(analyticsEvents(payloads, 'race_saved').length, 1);
  });

  it('creates localized SL and EN selector options', async () => {
    const sl = new FakeSelect({ language: 'sl' });
    const en = new FakeSelect({ language: 'en', eventId: 'r000174' });
    await setupSavedRaceUi({ controls: [sl, en] });

    assert.deepEqual(sl.options.map((option) => option.textContent), ['Ni v Mojih tekih', 'Spremljam', 'Planiram', 'Prijavljen', 'Opravljen']);
    assert.deepEqual(en.options.map((option) => option.textContent), ['Not in My races', 'Following', 'Planning', 'Registered', 'Completed']);
  });
});
