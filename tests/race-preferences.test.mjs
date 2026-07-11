import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RACE_PREFERENCES_STORAGE_KEY,
  getRacePreferenceReasonLabels,
  parseRacePreferencesJson,
  rankRacesForPreferences,
  readRacePreferences,
  resetRacePreferences,
  validateRacePreferences,
  writeRacePreferences
} from '../.cache/dist-test/utils-race-preferences.js';

const pref = (overrides = {}) => validateRacePreferences({ version: 1, distanceBuckets: [], surfaceCategories: [], regions: [], familyFriendly: false, active: true, ...overrides });
const event = (overrides = {}) => ({ id: overrides.id ?? overrides.row ?? overrides.title ?? '1', row: overrides.row ?? '', year: overrides.year ?? '2026', date: overrides.date ?? '2026-05-01', dateValue: Date.parse(`${overrides.date ?? '2026-05-01'}T00:00:00`), title: overrides.title ?? 'Tek', displayTitle: overrides.title ?? 'Tek', naziv_prireditve: overrides.title ?? 'Tek', place: overrides.place ?? 'Kraj', region: overrides.region ?? '', surface: overrides.surface ?? '', distances: overrides.distances ?? '', startTime: '', noticeUrl: '', registrationUrl: '', voteUrl: '', publicNotes: '', cup: '', familyFriendly: overrides.familyFriendly ?? false, kidsRaces: false });

test('storage validation accepts valid V1 and sanitizes malformed values', () => {
  assert.deepEqual(parseRacePreferencesJson('{bad'), null);
  assert.equal(validateRacePreferences({ version: 2 }), null);
  const got = validateRacePreferences({ version: 1, distanceBuckets: ['up-to-5', 'bad', 'up-to-5'], surfaceCategories: ['road', 'ice', 'road'], regions: [' Gorenjska ', 'gorenjska', '', ...Array.from({length:25},(_,i)=>`R${i}`)], familyFriendly: true, active: true, unknown: 'ignored' });
  assert.deepEqual(got.distanceBuckets, ['up-to-5']);
  assert.deepEqual(got.surfaceCategories, ['road']);
  assert.deepEqual(got.regions.slice(0, 2), ['Gorenjska', 'R0']);
  assert.equal(got.regions.length, 20);
  assert.equal(got.active, true);
});

test('empty preferences do not activate personalized mode', () => {
  assert.equal(validateRacePreferences({ version: 1, distanceBuckets: [], surfaceCategories: [], regions: [], familyFriendly: false, active: true }).active, false);
});

test('storage failures keep in-memory preferences and reset removes the key', () => {
  const memory = new Map();
  const storage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) };
  const preferences = pref({ distanceBuckets: ['up-to-5'], active: true });
  assert.equal(writeRacePreferences(storage, preferences).persistent, true);
  assert.equal(readRacePreferences(storage).preferences.active, true);
  assert.equal(resetRacePreferences(storage), true);
  assert.equal(memory.has(RACE_PREFERENCES_STORAGE_KEY), false);
  const broken = { getItem(){ throw new Error('no'); }, setItem(){ throw new Error('no'); }, removeItem(){ throw new Error('no'); } };
  const failed = writeRacePreferences(broken, preferences);
  assert.equal(failed.persistent, false);
  assert.deepEqual(failed.preferences.distanceBuckets, ['up-to-5']);
});

test('ranking scores categories once, omits zero scores, caps at 14 and handles children distances', () => {
  const preferences = pref({ distanceBuckets: ['up-to-5'], surfaceCategories: ['road'], regions: ['Podravska'], familyFriendly: true });
  const [full] = rankRacesForPreferences({ events: [event({ distances: '0.5;5;10', surface: 'cesta/asfalt', region: 'podravska', familyFriendly: true })], preferences });
  assert.equal(full.score, 14);
  assert.deepEqual(full.reasonKeys, ['preferred-distance', 'preferred-surface', 'preferred-region', 'family-friendly']);
  assert.equal(rankRacesForPreferences({ events: [event({ title: 'Road Race', surface: 'makadam', distances: '10' })], preferences }).length, 0);
  assert.equal(rankRacesForPreferences({ events: [event({ distances: '0.5;10' })], preferences }).length, 0);
  assert.equal(rankRacesForPreferences({ events: [event({ distances: '0.5;1' })], preferences }).at(0).score, 5);
});

test('surface, region, family, stable tie-breaks, labels and sparse 2027 work', () => {
  const preferences = pref({ distanceBuckets: ['over-10-to-half'], surfaceCategories: ['trail'], regions: ['Goriška','Gorenjska'], familyFriendly: true });
  const matches = rankRacesForPreferences({ events: [
    event({ id:'b', title:'B tek', date:'2027-06-02', year:'2027', distances:'12', surface:'cesta/trail', region:'Goriška', familyFriendly:false }),
    event({ id:'a', title:'A tek', date:'2027-06-01', year:'2027', distances:'12', surface:'trail', region:'Gorenjska', familyFriendly:true }),
    event({ id:'x', title:'Mountain trail by name', date:'2027-05-01', year:'2027', distances:'50', surface:'neznano', region:'X', familyFriendly:false })
  ], preferences });
  assert.equal(matches[0].event.id, 'a');
  assert.equal(matches[0].score, 14);
  assert.deepEqual(getRacePreferenceReasonLabels(matches[0].reasonKeys, 'en'), ['Preferred distance','Preferred surface','Preferred region']);
  assert.deepEqual(getRacePreferenceReasonLabels(matches[0].reasonKeys, 'sl'), ['Želena razdalja','Izbrana podlaga','Izbrana regija']);
  assert.equal(matches.some((m) => m.event.id === 'x'), false);
});
