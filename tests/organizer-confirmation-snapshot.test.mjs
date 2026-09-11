import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORGANIZER_ADDITIONAL_FIELDS,
  ORGANIZER_MASTER_FIELDS,
  buildOrganizerSnapshotV2,
  hashOrganizerSnapshotV2,
  resolveOrganizerSnapshotInput
} from '../.cache/dist-test/organizer-confirmation-snapshot.js';

const BACKEND_GOLDEN_EXPECTED = 'e0dab2cef34692809f287ab5cca52cb2dc1b003688373b232f0a5eff0ba14542';
const fixture = {
  year: '2026',
  master_row: 2,
  event_id: 'R000002',
  master: {
    datum: '2026-10-10', naziv_prireditve: 'Testni tek', kraj: 'Kranj', regija: 'Gorenjska',
    tip_podlage: 'cesta', razdalje_km: '10', cas_zacetka: '10:00',
    povezava_razpis: 'https://example.com/info', povezava_prijava: 'https://example.com/register',
    pokal_serija: '', opombe_javne: ''
  },
  additional: {
    prijavnina_min_eur: '10', prijavnina_max_eur: '20', prijavnina_opis: 'Predprijava',
    rok_prijave: '2026-09-30', rok_cenejse_prijave: '2026-09-20', prijave_na_dan_dogodka: 'DA',
    visinski_m_plus: '250', trasa_url: 'https://example.com/route', organizator_naziv: 'ŠD Test',
    organizator_url: 'https://example.com/organizer'
  }
};
const expectedKeys = ['snapshot_version', 'year', 'master_row', 'event_id', ...ORGANIZER_MASTER_FIELDS, ...ORGANIZER_ADDITIONAL_FIELDS];

test('snapshot v2 is flat, exact-order, and byte-compatible with backend golden', async () => {
  const snapshot = buildOrganizerSnapshotV2(fixture);
  assert.deepEqual(Object.keys(snapshot), expectedKeys);
  assert.equal(snapshot.master_row, 2);
  assert.equal('master' in snapshot, false);
  assert.equal('additional' in snapshot, false);
  assert.equal(await hashOrganizerSnapshotV2(fixture), BACKEND_GOLDEN_EXPECTED);
});

test('canonicalization mirrors backend clean text, URL, date, time and DA/NE semantics', () => {
  const snapshot = buildOrganizerSnapshotV2({
    ...fixture,
    master: { ...fixture.master, naziv_prireditve: '  Testni\n tek  ', povezava_razpis: 'HTTPS://example.com/info' },
    additional: { ...fixture.additional, prijavnina_min_eur: '10.00' }
  });
  assert.equal(snapshot.naziv_prireditve, 'Testni tek');
  assert.equal(snapshot.povezava_razpis, 'https://example.com/info');
  assert.equal(snapshot.prijavnina_min_eur, '10.00', 'ordinary numeric text is not coerced');
  assert.equal(snapshot.cas_zacetka, '10:00');
  assert.equal(snapshot.prijave_na_dan_dogodka, 'DA');
});

test('real content and edition identity changes alter the backend golden hash', async () => {
  for (const [scope, key, value] of [
    ['master', 'datum', '2026-10-11'], ['master', 'cas_zacetka', '11:00'], ['master', 'razdalje_km', '21'],
    ['master', 'povezava_prijava', 'https://example.com/register-new'], ['master', 'povezava_razpis', 'https://example.com/info-new'],
    ['additional', 'prijavnina_min_eur', '11'], ['additional', 'trasa_url', 'https://example.com/route-new'],
    ['additional', 'organizator_url', 'https://example.com/organizer-new']
  ]) {
    const changed = structuredClone(fixture); changed[scope][key] = value;
    assert.notEqual(await hashOrganizerSnapshotV2(changed), BACKEND_GOLDEN_EXPECTED, key);
  }
  assert.notEqual(await hashOrganizerSnapshotV2({ ...fixture, year: '2027' }), BACKEND_GOLDEN_EXPECTED);
});

const master = { row: '2', datum: '2026-10-10', naziv_prireditve: 'Testni tek', kraj: 'Kranj' };
const compositeEventKey = '2026|2026-10-10|testni tek|kranj';
const additional = { leto: '2026', master_sheet: '2026', master_row: '2', event_key: compositeEventKey, datum: '2026-10-10', naziv_prireditve: 'Testni tek', kraj: 'Kranj', zanesljivost: 'visoka', prijavnina_min_eur: '10' };

test('resolver accepts current row with correct canonical identity', () => {
  assert.equal(resolveOrganizerSnapshotInput('2026', 'R000002', [master], [additional])?.additional, additional);
  const withoutEventKey = { ...additional }; delete withoutEventKey.event_key;
  assert.equal(resolveOrganizerSnapshotInput('2026', 'R000002', [master], [withoutEventKey])?.additional, withoutEventKey);
});

test('title and place case differences use the backend canonical composite identity', () => {
  const caseVariant = { ...additional, naziv_prireditve: 'TESTNI TEK', kraj: 'KRANJ' };
  assert.equal(resolveOrganizerSnapshotInput('2026', 'R000002', [master], [caseVariant])?.additional, caseVariant);
});

test('wrong composite event key is ignored and leaves Additional fields empty', () => {
  const resolved = resolveOrganizerSnapshotInput('2026', 'R000002', [master], [{ ...additional, event_key: '2026|2026-10-10|drug tek|kranj' }]);
  assert.ok(resolved);
  assert.equal(resolved.additional, null);
  assert.equal(buildOrganizerSnapshotV2(resolved).prijavnina_min_eur, '');
});

test('2026 legacy requires the correct composite event key', () => {
  const legacy = { ...additional, master_row: '' }; delete legacy.master_sheet;
  assert.equal(resolveOrganizerSnapshotInput('2026', 'R000002', [master], [legacy])?.additional, legacy);
  const emptyLegacyKey = { ...legacy, event_key: '' };
  const resolved = resolveOrganizerSnapshotInput('2026', 'R000002', [master], [emptyLegacyKey]);
  assert.ok(resolved);
  assert.equal(resolved.additional, null);
  const wrongLegacyKey = { ...legacy, event_key: '2026|2026-10-10|drug tek|kranj' };
  assert.equal(resolveOrganizerSnapshotInput('2026', 'R000002', [master], [wrongLegacyKey])?.additional, null);
});

test('no Additional row produces a valid empty-Additional snapshot', () => {
  const resolved = resolveOrganizerSnapshotInput('2026', 'R000002', [master], []);
  assert.ok(resolved);
  assert.equal(resolved.additional, null);
  for (const field of ORGANIZER_ADDITIONAL_FIELDS) assert.equal(buildOrganizerSnapshotV2(resolved)[field], '');
});

test('duplicate valid Additional rows fail closed', () => {
  assert.equal(resolveOrganizerSnapshotInput('2026', 'R000002', [master], [additional, { ...additional }]), null);
});

test('resolver rejects wrong edition identity and wrong requested year', () => {
  const wrongPlace = resolveOrganizerSnapshotInput('2026', 'R000002', [master], [{ ...additional, kraj: 'Maribor' }]);
  assert.ok(wrongPlace); assert.equal(wrongPlace.additional, null);
  const wrongTitle = resolveOrganizerSnapshotInput('2026', 'R000002', [master], [{ ...additional, naziv_prireditve: 'Drug tek' }]);
  assert.ok(wrongTitle); assert.equal(wrongTitle.additional, null);
  assert.equal(resolveOrganizerSnapshotInput('2027', 'R000002', [master], [additional]), null);
});
