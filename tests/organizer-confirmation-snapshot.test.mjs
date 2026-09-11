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
const additional = { leto: '2026', master_sheet: '2026', master_row: '2', event_key: 'R000002', datum: '2026-10-10', naziv_prireditve: 'Testni tek', kraj: 'Kranj', zanesljivost: 'visoka' };
test('resolver accepts normal current identity and supported 2026 legacy row', () => {
  assert.ok(resolveOrganizerSnapshotInput('2026', 'R000002', [master], [additional]));
  const legacy = { ...additional }; delete legacy.master_sheet; delete legacy.event_key;
  assert.ok(resolveOrganizerSnapshotInput('2026', 'R000002', [master], [legacy]));
});
test('resolver rejects wrong place/event key, duplicates, and wrong year', () => {
  assert.equal(resolveOrganizerSnapshotInput('2026', 'R000002', [master], [{ ...additional, kraj: 'Maribor' }]), null);
  assert.equal(resolveOrganizerSnapshotInput('2026', 'R000002', [master], [{ ...additional, event_key: 'R000003' }]), null);
  assert.equal(resolveOrganizerSnapshotInput('2026', 'R000002', [master], [additional, { ...additional }]), null);
  assert.equal(resolveOrganizerSnapshotInput('2027', 'R000002', [master], [additional]), null);
});
