import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GEOHUB_LAYER,
  SAMPLES,
  REJECTIONS,
  assertLayerMetadata,
  featureRequestUrl,
  inspectFeature,
  inspectGeoHubSettlementIdentity,
  runVerification,
} from '../scripts/dev056-geohub-verify.mjs';

const layer = {
  id: 20207, name: 'naselja', geometryType: 'esriGeometryPolygon',
  extent: { spatialReference: { wkid: 3794 } },
  supportsAdvancedQueries: true,
  fields: ['NA_MID', 'NAZIV', 'OBCINA_NAZIV'].map((name) => ({ name })),
};
const polygon = (e, n) => ({ rings: [
  [[e-1000,n-1000],[e+1000,n-1000],[e+1000,n+1000],[e-1000,n+1000],[e-1000,n-1000]],
] });
const body = (s) => ({ features: [{ attributes: { NA_MID: s.naMid, NAZIV: s.settlement, OBCINA_NAZIV: s.municipality }, geometry: polygon(s.oldE, s.oldN) }] });
const ok = (payload) => ({ ok: true, json: async () => payload });

test('official layer schema validates id, fields and CRS', () => {
  assert.equal(assertLayerMetadata(layer).wkid, 3794);
  assert.throws(() => assertLayerMetadata({ ...layer, extent: { spatialReference: { wkid: 4326 } } }), /CRS/);
  assert.throws(() => assertLayerMetadata({ ...layer, fields: [{ name: 'NA_MID' }] }), /field/);
});

test('URLs are allowlisted bounded GET queries keyed by NA_MID, not by fuzzy name', () => {
  const url = new URL(featureRequestUrl(SAMPLES[1]));
  assert.equal(url.origin, new URL(GEOHUB_LAYER).origin);
  assert.equal(url.searchParams.get('where'), 'NA_MID=10131219');
  assert.equal(url.searchParams.get('resultRecordCount'), '2');
  assert.equal(url.searchParams.get('outSR'), '3794');
  assert.throws(() => featureRequestUrl({naMid: 55}), /Non-allowlisted/);
});

test('specific settlement + municipality + polygon must match', () => {
  const sample = SAMPLES[1];
  assert.equal(inspectFeature(body(sample), sample).status, 'LIVE_FEATURE_STRUCTURE_PASS_NOT_A_START_PIN');
  assert.throws(() => inspectFeature({ features: [] }, sample), /Expected one/);
  assert.throws(() => inspectFeature({ features: [body(sample).features[0], body(sample).features[0]] }, sample), /Expected one/);
  const bad = body(sample);
  bad.features[0].attributes.OBCINA_NAZIV = 'Sevnica';
  assert.throws(() => inspectFeature(bad, sample), /Municipality mismatch/);
});

test('identity-only GeoHub record succeeds without geometry but missing identity fails closed', () => {
  const sample = SAMPLES[1];
  const payload = body(sample);
  delete payload.features[0].geometry;
  const checked = inspectGeoHubSettlementIdentity(payload, sample);
  assert.equal(checked.na_mid, 10131219);
  assert.equal(checked.geometry_supplied_by_geohub, false);
  assert.equal(checked.published_start_coordinate, false);
  assert.throws(() => inspectGeoHubSettlementIdentity({ features: [] }, sample), /one GeoHub/);
  payload.features[0].attributes.OBCINA_NAZIV = 'Sevnica';
  assert.throws(() => inspectGeoHubSettlementIdentity(payload, sample), /identity mismatch/);
});

test('bad geometry fails closed rather than publishing location', () => {
  const s = SAMPLES[0];
  const bad = body(s);
  bad.features[0].geometry.rings[0][0] = [200, 45];
  assert.throws(() => inspectFeature(bad, s), /Invalid EPSG/);
  assert.throws(() => inspectFeature({error:{code:400}}, s), /ArcGIS error/);
});

test('mock three live matches and two intentional rejects; never label a start pin', async () => {
  const seen = [];
  const mock = async (url, options) => {
    seen.push([url, options.method]);
    if (!url.includes('/query')) return ok(layer);
    const id = Number(new URL(url).searchParams.get('where').split('=')[1]);
    const sample = SAMPLES.find((s) => s.naMid === id);
    return ok(body(sample));
  };
  const result = await runVerification({ fetchImpl: mock, now: () => '2026-11-12T21:30:00Z' });
  assert.equal(result.result, 'LIVE_GEOHUB_IDENTITY_PASS_FURS_GEOMETRY_REVIEW_REQUIRED');
  assert.equal(result.checks.length, 5);
  assert.equal(seen.length, 4);
  assert.ok(seen.every((x) => x[1] === 'GET'));
  assert.equal(result.checks.filter((x) => x.status === 'CORRECTLY_REJECTED_NO_QUERY').length, REJECTIONS.length);
  assert.ok(result.checks.slice(0,3).every((x) => x.published_start_coordinate === false));
});

test('HTTP/schema/identity errors cause fail-closed report', async () => {
  const result = await runVerification({ fetchImpl: async () => ({ok: false, status: 503}), now: () => '2026-11-12T21:30:00Z' });
  assert.equal(result.result, 'NOT_AVAILABLE_OR_MISMATCH_STOP');
  assert.equal(result.site_or_master_changed, false);
  assert.match(result.error, /503/);
});
