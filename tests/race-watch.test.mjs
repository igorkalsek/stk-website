import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildRaceWatch, resolveRaceWatchIdentity, mergeMyRaceDeadlines } from '../.cache/dist-test/utils-race-watch.js';
import { renderRaceWatch, getExportableUpcomingRaceEvents } from '../.cache/dist-test/my-races-client.js';
import { resolveSavedRaces, getUpcomingSavedRaceDeadlines } from '../.cache/dist-test/utils-my-races.js';
import { readSavedRaces, SAVED_RACES_STORAGE_KEY } from '../.cache/dist-test/utils-saved-races.js';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/race-watch.json', import.meta.url)));
const clone = () => structuredClone(fixture);
const saved = (row, year = '2026', status = 'following') => {
  const record = fixture.masters[year].data.find(item => Number(item.row) === row);
  return { version: 2, eventId: `r${String(row).padStart(6, '0')}`, year, date: record.datum, title: record.naziv_prireditve, status };
};
const run = (f = fixture, races = [saved(265)], todayIso = '2026-10-19', language = 'sl') => buildRaceWatch({ saved: races, masters: f.masters, recent: f.recent, deadlines: f.deadlines, todayIso, language });

test('canonical public updates match exact current year and row, without a family ID requirement', () => {
  const result = run();
  assert.equal(result.updates.length, 1);
  assert.equal(result.updates[0].type, 'UPDATED');
  assert.equal(result.updates[0].key, '2026:r000265');
  assert.equal(result.recentAvailable, true);
  assert.equal(result.recentComplete, true);
});

test('same master row in different years cannot cross-match', () => {
  const f = clone();
  const event = { ...f.masters[2026].data[2], datum: '2027-12-05' };
  f.masters[2027].data.push(event); f.masters[2027].row_count++;
  const r = { ...saved(265), year: '2027', date: event.datum };
  assert.equal(run(f, [r]).updates.length, 0);
  assert.equal(run(f, [saved(265), r]).updates.length, 1);
});

test('website row IDs never become canonical family IDs', () => {
  const lah = saved(254);
  const identity = resolveRaceWatchIdentity(lah, fixture.masters[2026]);
  assert.equal(identity.deadlineEdition, 'R000217|2026-11-07');
  assert.equal(identity.raceId, undefined);
  for (const eventId of ['', 'R000254', 'r000217', 'r254', 'unknown']) assert.equal(resolveRaceWatchIdentity({ ...lah, eventId }, fixture.masters[2026]), null);
  for (const race_id of ['', null, 'r000217', 'R000254']) {
    const f = clone(); f.masters[2026].data[0].race_id = race_id;
    assert.equal(resolveRaceWatchIdentity(lah, f.masters[2026]), null);
  }
});

for (const [name, mutate] of Object.entries({
  'missing master row': f => { delete f.masters[2026].data[2].row; },
  'duplicate master row': f => { f.masters[2026].data.push(f.masters[2026].data[2]); f.masters[2026].row_count++; },
  'wrong master year': f => { f.masters[2026].sheet = '2027'; },
  'missing master count': f => { delete f.masters[2026].row_count; },
  'incomplete master': f => { f.masters[2026].row_count++; },
  'missing update row': f => { delete f.recent.recent_updates_last_days.events[0].master_row; },
  'wrong update row alias': f => { f.recent.recent_updates_last_days.events[0].row = '266'; },
  'wrong update year alias': f => { f.recent.recent_updates_last_days.events[0].master_sheet = '2027'; },
  'wrong update event ID': f => { f.recent.recent_updates_last_days.events[0].eventId = 'r000266'; },
  'empty update event ID': f => { f.recent.recent_updates_last_days.events[0].eventId = ''; },
  'wrong update family': f => { f.recent.recent_updates_last_days.events[0].race_id = 'R000265'; },
  'missing update date': f => { delete f.recent.recent_updates_last_days.events[0].recent_update_date; },
  'unknown update type': f => { f.recent.recent_updates_last_days.events[0].update_type = 'CANCELLED'; },
  'old event basis': f => { f.recent.recent_updates_last_days.events[0].datum = '2026-12-06'; }
})) test(`identity fails closed: ${name}`, () => {
  const f = clone(); mutate(f); assert.equal(run(f).updates.length, 0);
});

test('changed saved dates and moved Master rows need a future stable identity contract', () => {
  assert.equal(run(fixture, [{ ...saved(265), date: '2026-12-04' }]).updates.length, 0);
  const f = clone(); f.masters[2026].data[2].row = 999;
  assert.equal(run(f).updates.length, 0);
});

test('identical CHANGE_LOG projections deduplicate deterministically, conflicts are suppressed', () => {
  const f = clone(); const b = f.recent.recent_updates_last_days;
  b.events.push({ ...b.events[0], rank: 'other' });
  assert.equal(run(f).updates.length, 1);
  assert.equal(run(f).updates[0].signalId, run().updates[0].signalId);
  b.events.at(-1).update_type = 'new';
  assert.equal(run(f).updates.length, 0);
  assert.equal(run(f).unresolved, true);
});

test('UPDATED stays neutral even if source free text claims dates or prices changed', () => {
  const f = clone(); f.recent.recent_updates_last_days.events[0].public_summary = 'Price increased and race postponed';
  for (const lang of ['sl', 'en']) {
    const html = renderRaceWatch(run(f), 1, lang);
    assert.match(html, lang === 'sl' ? /Podatki teka so bili posodobljeni/ : /Race details have been updated/);
    assert.doesNotMatch(html, /Price increased|postponed/);
    assert.match(html, lang === 'sl' ? /href="\/tek\/2026\/r000265-/ : /href="\/en\/races\/2026\/r000265-/);
  }
});

test('NEW and CONFIRMED retain the real classification without unread/new-to-you claims', () => {
  assert.equal(run(fixture, [saved(37, '2027')]).updates[0].type, 'NEW');
  const f = clone(); f.recent.recent_updates_last_days.events[0].update_type = 'confirmed';
  assert.equal(run(f).updates[0].type, 'CONFIRMED');
  assert.match(renderRaceWatch(run(f), 1, 'en'), /Race confirmed in the calendar/);
});

test('v2 alone supplies verified online, advance and cheaper deadlines, with no /additional', () => {
  const result = run(fixture, [saved(254), saved(256)]);
  assert.equal(result.deadlines.length, 2);
  assert.equal(result.deadlines[0].label, 'Rok predprijav in rok cenejše prijave');
  assert.equal(result.deadlines[1].label, 'Rok spletnih prijav');
  assert.equal(result.deadlines[0].deadline.daysRemaining, 14);
  assert.equal(run(fixture, [saved(256)], '2026-10-23').deadlines.length, 0);
  assert.equal(run(fixture, [saved(256)], '2026-10-22').deadlines.length, 1);
  assert.equal(run(fixture, [saved(256, '2026', 'completed')]).deadlines.length, 0);
});

test('final semantics work inside the 30-day window while evidence remains valid', () => {
  const f = clone(); f.deadlines.items[2].deadline_date = '2026-11-18';
  f.deadlines.items[2].deadline_id = 'dl2|R000218|2026-12-05|2026-11-18';
  assert.equal(run(f).deadlines[0].label, 'Končni rok prijave'); // synthetic boundary, not a production claim
});

for (const [name, change] of Object.entries({
  'wrong race ID': i => { i.race_id = 'R000254'; },
  'missing race ID': i => { delete i.race_id; },
  'wrong row': i => { i.master_row = '256'; },
  'missing row': i => { delete i.master_row; },
  'wrong year': i => { i.master_sheet = '2027'; },
  'unknown semantics': i => { i.deadline_type = 'registration'; i.deadline_components[0].type = 'registration'; },
  'expired evidence': i => { i.deadline_components[0].valid_until = '2026-10-18'; },
  'old source': i => { i.deadline_components[0].verified_at = '2026-08-01'; },
  'wrong source': i => { i.deadline_components[0].official_source = 'https://example.com'; }
})) test(`v2 rejection: ${name}`, () => {
  const f = clone(); change(f.deadlines.items[1]); assert.equal(run(f, [saved(254)]).deadlines.length, 0);
});

test('duplicate deadline records are suppressed', () => {
  const f = clone(); f.deadlines.items.push(structuredClone(f.deadlines.items[1]));
  assert.equal(run(f, [saved(254)]).deadlines.length, 0);
});

test('outage, partial envelope, stale periods and global limits never mean no changes', () => {
  for (const recent of [undefined, null, {}, { ok: true }, { ...fixture.recent, ok: false }]) {
    const result = run({ ...fixture, recent, deadlines: null });
    assert.equal(result.updates.length, 0); assert.equal(result.recentAvailable, false);
    const html = renderRaceWatch(result, 1, 'en');
    assert.match(html, /cannot currently be verified/); assert.doesNotMatch(html, /No matching updates|No changes/);
  }
  for (const change of [b => { b.stats.updated_events_total = 50; }, b => { b.events.push(null); }]) {
    const f = clone(); change(f.recent.recent_updates_last_days);
    const result = run(f); assert.equal(result.recentComplete, false);
    assert.match(renderRaceWatch(result, 1, 'sl'), /trenutno ni mogoče preveriti/);
  }
  assert.equal(run(fixture, [saved(265)], '2026-10-20').recentAvailable, false);
  assert.equal(renderRaceWatch(run(), 0, 'sl'), '');
});

test('legacy dates remain neutral, verified same-day components render and export only once', () => {
  const [verified] = run(fixture, [saved(256)]).deadlines;
  const event = { ...verified.event, verifiedDeadlines: [verified], additionalData: { registrationDeadline: '2026-11-02', earlyRegistrationDeadline: '2026-11-02' } };
  assert.equal(mergeMyRaceDeadlines(event, '2026-10-19').length, 1);
  const resolutions = [{ savedRace: saved(256), event, key: verified.key, status: 'upcoming' }];
  assert.equal(getUpcomingSavedRaceDeadlines({ items: resolutions, todayIso: '2026-10-19' }).length, 1);
  assert.deepEqual(getExportableUpcomingRaceEvents(resolutions, 'sl'), getExportableUpcomingRaceEvents([{ ...resolutions[0], event: verified.event }], 'sl'));
});

test('an API outage does not alter stkSavedRacesV2 or any existing status', () => {
  const races = ['following', 'planning', 'registered', 'completed'].map((status, index) => saved([254, 256, 265, 266][index], '2026', status));
  const serialized = JSON.stringify({ version: 2, races }); const writes = [];
  const storage = { getItem: key => key === SAVED_RACES_STORAGE_KEY ? serialized : null, setItem: (...args) => writes.push(args) };
  const before = readSavedRaces(storage).state;
  const result = buildRaceWatch({ saved: before.races, masters: {}, recent: null, deadlines: null, todayIso: '2026-10-19', language: 'sl' });
  assert.equal(result.unresolved, true); assert.equal(result.updates.length, 0);
  assert.deepEqual(readSavedRaces(storage).state, before); assert.deepEqual(writes, []);
});


test('incomplete deadline metadata reports limited availability even for independently valid items', () => {
  const f = clone(); delete f.deadlines.stats;
  const result = run(f, [saved(254)]);
  assert.equal(result.deadlinesAvailable, false);
  assert.equal(result.deadlines.length, 1);
  assert.match(renderRaceWatch(result, 1, 'en'), /cannot currently be verified/);
});


test('a standalone cheaper component keeps the existing early-entry calendar kind', () => {
  const f = clone(); const item = f.deadlines.items[0];
  item.deadline_type = 'cheaper'; item.deadline_components = [item.deadline_components[1]];
  const result = run(f, [saved(256)]);
  assert.equal(result.deadlines[0].label, 'Rok cenejše prijave');
  assert.equal(result.deadlines[0].deadline.kind, 'early');
});


test('a conflicting canonical edition on the same public locator suppresses both deadline candidates', () => {
  const f = clone(); const conflict = structuredClone(f.deadlines.items[1]);
  conflict.race_id = 'R000254'; conflict.edition_id = 'R000254|2026-11-07';
  f.deadlines.items.push(conflict);
  assert.equal(run(f, [saved(254)]).deadlines.length, 0);
});
