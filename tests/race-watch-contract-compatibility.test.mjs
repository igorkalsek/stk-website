// Existing V2 operations plus synthetic contract examples; no migration/adapter shipped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateSavedRacesState, getSavedRaceKey, setSavedRaceStatus, removeSavedRace } from '../.cache/dist-test/utils-saved-races.js';
import { validateContract } from './contracts/race-watch/validate.mjs';
const read = file => JSON.parse(readFileSync(new URL(`./fixtures/race-watch-contract/positive/${file}.json`, import.meta.url)));
// Reference contract rule, not an application resolver: exact V2 tuple and global unique proof.
function match(snapshot, saved) {
  if (validateContract(snapshot).errors.length) return null;
  const candidates = snapshot.editions.flatMap(e => e.aliases.filter(a => a.namespace === 'website_event_id' && a.year === saved.year && a.key === saved.eventId && a.saved_date === saved.date).map(a => ({ e, a })));
  if (!candidates.length || candidates.some(({ e, a }) => e.identity_status !== 'verified' || a.resolution !== 'unique') || new Set(candidates.map(({ e }) => e.edition_id)).size !== 1) return null;
  return candidates[0].e;
}
for (const status of ['following', 'planning', 'registered', 'completed']) test(`B0 V2 compatibility: ${status}, moved/cancelled/unresolved retain original keys`, () => {
  const saved = { version: 2, year: '2026', eventId: 'r000800', date: '2026-11-07', title: 'SINTETIČNI tek', status };
  const state = { version: 2, races: [saved] }, original = structuredClone(state);
  assert.deepEqual(validateSavedRacesState(state), original);
  const moved = match(read('02-new-row-reschedule'), saved);
  assert.equal(moved.current_master.locator.row, 801);
  assert.equal(match(read('03-cancelled-removed'), saved).canonical_status, 'cancelled');
  assert.equal(match(read('05-reused-row-ambiguous-v2'), saved), null);
  assert.equal(match(read('06-alias-conflict-held'), saved), null);
  assert.equal(match(read('04-same-family-two-editions'), saved).edition_id.endsWith('000001'), true);
  assert.equal(match(read('08-expired-proof-return-after-60-days'), saved).edition_id, moved.edition_id);
  assert.equal(getSavedRaceKey(saved), '2026:r000800');
  assert.deepEqual(state, original);
  const changed = setSavedRaceStatus(state, saved, 'registered');
  assert.equal(changed.races[0].eventId, saved.eventId);
  assert.equal(changed.races[0].date, saved.date);
  assert.deepEqual(removeSavedRace(changed, saved).races, []);
});
