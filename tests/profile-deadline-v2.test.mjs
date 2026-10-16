import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getProfileDeadlineEdition, getVerifiedProfileDeadline } from '../.cache/dist-test/profile-deadline-v2.js';

// Public production GET on 2026-10-16. Synthetic mutations below test rejection,
// not additional verified production semantics.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/profile-deadlines-v2.json', import.meta.url)));
const go = fixture.items[0];
const read = (payload = fixture, today = '2026-10-16') => getVerifiedProfileDeadline(payload, go.edition_id, go.deadline_date, today, 'sl');
const mutate = fn => { const p = structuredClone(fixture); fn(p, p.items[0]); return p; };

test('reviewed identity bridge never derives canonical IDs from website rows', () => {
  const profile = { date: '2026-11-07', naziv_prireditve: '4. Lahinja Trail', place: 'Dragatuš', registrationUrl: 'https://protime.si/dogodek/lahinja-trail-2026/' };
  assert.equal(getProfileDeadlineEdition({ ...profile, row: '254' }), 'R000217|2026-11-07');
  assert.equal(getProfileDeadlineEdition({ ...profile, row: '999' }), 'R000217|2026-11-07');
  for (const field of Object.keys(profile)) assert.equal(getProfileDeadlineEdition({ ...profile, [field]: 'wrong' }), undefined);
  assert.equal(getProfileDeadlineEdition({ ...profile, date: '2027-11-07' }), undefined);
});

test('three live editions retain exact canonical IDs, dates and official sources in SL/EN', () => {
  const sl = ['Rok predprijav in rok cenejše prijave', 'Rok spletnih prijav', 'Končni rok prijave'];
  const en = ['Advance registration deadline and cheaper registration deadline', 'Online registration deadline', 'Final registration deadline'];
  for (const [index, item] of fixture.items.entries()) {
    for (const lang of ['sl', 'en']) {
      const result = getVerifiedProfileDeadline(fixture, item.edition_id, item.deadline_date, '2026-10-16', lang);
      assert.equal(result.label, (lang === 'sl' ? sl : en)[index]);
      assert.equal(result.deadlineId, item.deadline_id);
      assert.equal(result.source, item.deadline_components[0].official_source);
    }
  }
});

test('validity is inclusive on October 22 and expires October 23 in every edition', () => {
  for (const item of fixture.items) {
    assert.ok(getVerifiedProfileDeadline(fixture, item.edition_id, item.deadline_date, '2026-10-22', 'sl'));
    assert.equal(getVerifiedProfileDeadline(fixture, item.edition_id, item.deadline_date, '2026-10-23', 'sl'), null);
    assert.equal(getVerifiedProfileDeadline(fixture, item.edition_id, item.deadline_date, '2026-11-21', 'sl'), null);
  }
});

for (const [name, change] of Object.entries({
  'missing v2 marker': p => { delete p.contract_version; },
  'v1 marker': p => { p.contract_version = 1; },
  'string marker': p => { p.contract_version = '2'; },
  'failed envelope': p => { p.ok = false; },
  'wrong endpoint type': p => { p.type = 'stats'; },
  'wrong items': p => { p.items = {}; },
  'wrong race': (_, i) => { i.race_id = 'R000256'; },
  'wrong edition': (_, i) => { i.edition_id = 'R000211|2027-11-07'; },
  'wrong deadline identity': (_, i) => { i.deadline_id += '|final'; },
  'wrong event date': (_, i) => { i.datum = '2026-11-08'; },
  'wrong deadline date': (_, i) => { i.deadline_date = '2026-11-03'; },
  'invented final': (_, i) => { i.deadline_type = 'final'; },
  'missing components': (_, i) => { delete i.deadline_components; },
  'empty components': (_, i) => { i.deadline_components = []; },
  'duplicate component': (_, i) => { i.deadline_components.push(i.deadline_components[0]); },
  'unknown component': (_, i) => { i.deadline_components[0].type = 'registration'; },
  'expired component': (_, i) => { i.deadline_components[1].valid_until = '2026-10-15'; },
  'future verification': (_, i) => { i.deadline_components[0].verified_at = '2026-10-17'; },
  'old verification': (_, i) => { i.deadline_components[0].verified_at = '2026-08-01'; },
  'missing verification': (_, i) => { delete i.deadline_components[0].verified_at; },
  'invalid date': (_, i) => { i.deadline_components[0].valid_until = '2026-02-30'; },
  'nonofficial source': (_, i) => { i.deadline_components[0].official_source = 'https://example.com/'; },
  'unsafe source': (_, i) => { i.deadline_components[0].official_source = 'javascript:alert(1)'; },
  'duplicate matching deadline': (p, i) => { p.items.push(structuredClone(i)); }
})) test(`fail closed: ${name}`, () => assert.equal(read(mutate(change)), null));

test('malformed/unavailable responses and unknown identities stay neutral', () => {
  for (const p of [null, undefined, [], 'html', {}, { ...fixture, items: [null] }]) assert.equal(getVerifiedProfileDeadline(p, go.edition_id, go.deadline_date, '2026-10-16', 'sl'), null);
  assert.equal(getVerifiedProfileDeadline(fixture, 'R000256|2026-11-07', go.deadline_date, '2026-10-16', 'sl'), null);
  assert.equal(read(fixture, 'invalid'), null);
});

test('all four component types and combined use explicit semantics, including day boundaries', () => {
  for (const type of ['final', 'online', 'advance', 'cheaper']) {
    const p = mutate((_, i) => {
      i.deadline_type = type;
      i.deadline_components = [{ ...i.deadline_components[0], type, verified_at: '2026-11-01', valid_until: '2026-11-07' }];
    });
    for (const lang of ['sl', 'en']) {
      assert.match(getVerifiedProfileDeadline(p, go.edition_id, go.deadline_date, '2026-11-01', lang).relative, /jutri|tomorrow/);
      assert.match(getVerifiedProfileDeadline(p, go.edition_id, go.deadline_date, '2026-11-02', lang).relative, /danes|today/);
      assert.equal(getVerifiedProfileDeadline(p, go.edition_id, go.deadline_date, '2026-11-03', lang), null);
    }
  }
});

test('policy age tightens to 14/7 days as the cutoff approaches', () => {
  const p = mutate((_, i) => { for (const c of i.deadline_components) { c.verified_at = '2026-10-15'; c.valid_until = '2026-11-07'; } });
  assert.ok(read(p, '2026-10-25'));
  assert.equal(read(p, '2026-10-26'), null); // 7 days to cutoff, verification 11 days old.
});
