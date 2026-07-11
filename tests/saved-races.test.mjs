import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  SAVED_RACES_STORAGE_KEY,
  MAX_SAVED_RACES,
  addSavedRace,
  dedupeSavedRaces,
  isRaceSaved,
  parseSavedRacesJson,
  readSavedRaces,
  removeSavedRace,
  toggleSavedRace,
  writeSavedRaces
} from '../.cache/dist-test/utils-saved-races.js';

const race = (eventId = 'r000173', year = '2026') => ({ eventId, year, date: `${year}-05-10`, title: 'Testni tek' });
const state = (races = []) => ({ version: 1, races: races.map((item) => ({ version: 1, ...item })) });
const memoryStorage = (initial = null) => {
  let value = initial;
  return { getItem: () => value, setItem: (_key, next) => { value = next; }, removeItem: () => { value = null; }, value: () => value };
};

describe('saved races storage model', () => {
  it('handles empty storage', () => assert.deepEqual(readSavedRaces(memoryStorage()).state.races, []));
  it('reads valid records', () => assert.equal(readSavedRaces(memoryStorage(JSON.stringify(state([race()])))).state.races[0].eventId, 'r000173'));
  it('ignores invalid JSON', () => assert.deepEqual(parseSavedRacesJson('{nope'), null));
  it('ignores wrong versions', () => assert.deepEqual(parseSavedRacesJson(JSON.stringify({ version: 2, races: [race()] })), null));
  it('keeps valid records when some records are invalid', () => assert.deepEqual(parseSavedRacesJson(JSON.stringify({ version: 1, races: [{ nope: true }, { version: 1, ...race() }] })).races.map((item) => item.eventId), ['r000173']));
  it('deduplicates by year and eventId', () => assert.equal(dedupeSavedRaces([{ version: 1, ...race() }, { version: 1, ...race(), title: 'Duplicate' }]).length, 1));
  it('treats same eventId in different years as distinct', () => {
    const saved = state([race('r000173', '2026'), race('r000173', '2027')]);
    assert.equal(isRaceSaved(saved, race('r000173', '2026')), true);
    assert.equal(isRaceSaved(saved, race('r000173', '2027')), true);
  });
  it('adds a race', () => assert.equal(addSavedRace(state(), race()).races.length, 1));
  it('removes a race', () => assert.equal(removeSavedRace(state([race()]), race()).races.length, 0));
  it('toggles a race on and off', () => {
    const on = toggleSavedRace(state(), race());
    assert.equal(on.saved, true);
    const off = toggleSavedRace(on.state, race());
    assert.equal(off.saved, false);
    assert.equal(off.state.races.length, 0);
  });
  it('handles storage getItem exceptions', () => assert.equal(readSavedRaces({ getItem: () => { throw new Error('blocked'); }, setItem() {}, removeItem() {} }).persistent, false));
  it('handles storage setItem exceptions', () => assert.equal(writeSavedRaces({ getItem: () => null, setItem: () => { throw new Error('full'); }, removeItem() {} }, state([race()])).persistent, false));
  it('caps the number of records', () => {
    const races = Array.from({ length: MAX_SAVED_RACES + 20 }, (_, index) => ({ version: 1, ...race(`r${String(index).padStart(6, '0')}`) }));
    assert.equal(dedupeSavedRaces(races).length, MAX_SAVED_RACES);
  });
  it('writes to the versioned localStorage key', () => {
    const storage = memoryStorage();
    writeSavedRaces(storage, state([race()]));
    assert.match(storage.value(), /"version":1/);
    assert.equal(SAVED_RACES_STORAGE_KEY, 'stkSavedRacesV1');
  });
});

describe('saved races UI source contract', () => {
  const files = ['src/pages/iskalnik-tekov.astro', 'src/pages/en/find-races.astro', 'src/pages/tek/[year]/[slug].astro', 'src/pages/en/races/[year]/[slug].astro'];
  const sources = Object.fromEntries(files.map((file) => [file, readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')]));
  it('contains Slovenian and English labels', () => {
    assert.match(sources['src/pages/iskalnik-tekov.astro'], /Shrani tek/);
    assert.match(sources['src/pages/en/find-races.astro'], /Save race/);
  });
  it('sets aria-pressed on saved race buttons', () => files.forEach((file) => assert.match(sources[file], /aria-pressed="false"/)));
  it('adds buttons to both search pages and both detail routes', () => files.forEach((file) => assert.match(sources[file], /data-saved-race-button/)));
  it('does not add analytics for saving races', () => files.forEach((file) => assert.doesNotMatch(sources[file], /saved-race-button[^`\n>]*(data-analytics|trackStkEvent)/)));
});
