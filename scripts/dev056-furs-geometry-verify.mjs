/** STK DEV-056: read-only cross-check of GURS settlement identities against FURS geometry.
 * Not a live STK feature, coordinate source approval, or a race-start database.
 * Usage: node scripts/dev056-furs-geometry-verify.mjs
 */
import { pathToFileURL } from 'node:url';
import { GEOHUB_LAYER, SAMPLES, REJECTIONS, fetchJson, featureRequestUrl, inspectFeature, assertLayerMetadata } from './dev056-geohub-verify.mjs';

export const FURS_LAYER = 'https://gisportal.furs.gov.si/arcgis/rest/services/KRSITVE/prijava_krsitev_gis_sloji/MapServer/4';
const norm = x => String(x ?? '').trim().normalize('NFC').toLocaleLowerCase('sl-SI');

export function assertFursMetadata(value) {
  if (!value || value.error || value.id !== 4 || value.geometryType !== 'esriGeometryPolygon') throw new Error('FURS metadata mismatch');
  const wkid = value.extent?.spatialReference?.wkid ?? value.spatialReference?.wkid;
  if (wkid !== 3794) throw new Error('FURS CRS mismatch: ' + wkid);
  const fields = new Set((value.fields ?? []).map(x => x.name));
  for (const key of ['na_mid', 'na', 'ob']) if (!fields.has(key)) throw new Error('FURS missing field ' + key);
  return { layer_id: 4, wkid, fields: ['na_mid', 'na', 'ob'], last_edit_date: value.editingInfo?.lastEditDate ?? null };
}

export function fursUrl(sample) {
  if (!SAMPLES.some(s => s.naMid === sample?.naMid)) throw new Error('Unknown NA_MID');
  const url = new URL(FURS_LAYER + '/query');
  for (const [k,v] of Object.entries({ where: 'na_mid=' + sample.naMid, outFields: 'na_mid,na,ob,d_od,e,n', returnGeometry: 'true', outSR: '3794', resultRecordCount: '2', f: 'json' })) url.searchParams.set(k,v);
  return url.toString();
}

export function inspectGeoHubIdentity(value, sample) {
  if (!value || value.error || !Array.isArray(value.features) || value.features.length !== 1 || value.exceededTransferLimit) throw new Error('GeoHub identity record count mismatch');
  const a = value.features[0]?.attributes;
  if (a?.NA_MID !== sample.naMid || norm(a?.NAZIV) !== norm(sample.settlement) || norm(a?.OBCINA_NAZIV) !== norm(sample.municipality)) throw new Error('GeoHub identity mismatch ' + sample.race);
  return true;
}

/**
 * Even/odd point-in-polygon for ArcGIS rings, including polygon holes.
 * Boundary points are accepted as inside. Only used for QA of a source point,
 * never to calculate or invent a race start.
 */
export function pointInsideSettlementRings(e, n, rings) {
  if (!Number.isFinite(e) || !Number.isFinite(n) || !Array.isArray(rings)) return false;
  let inside = false;
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 4) return false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (![xi, yi, xj, yj].every(Number.isFinite)) return false;
      const cross = (e - xi) * (yj - yi) - (n - yi) * (xj - xi);
      if (Math.abs(cross) < 1e-6 &&
        e >= Math.min(xi, xj) - 1e-9 && e <= Math.max(xi, xj) + 1e-9 &&
        n >= Math.min(yi, yj) - 1e-9 && n <= Math.max(yi, yj) + 1e-9) return true;
      if ((yi > n) !== (yj > n) && e < (xj - xi) * (n - yi) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

export function inspectFursRecord(value, sample) {
  if (!value || value.error || !Array.isArray(value.features) || value.features.length !== 1 || value.exceededTransferLimit) throw new Error('FURS identity record count mismatch ' + sample.race);
  const f = value.features[0], a = f?.attributes;
  if (a?.na_mid !== sample.naMid || norm(a?.na) !== norm(sample.settlement) || norm(a?.ob) !== norm(sample.municipality)) throw new Error('FURS identity mismatch ' + sample.race);
  const normalized = { features: [{attributes: { NA_MID: a.na_mid, NAZIV: a.na, OBCINA_NAZIV: a.ob }, geometry: f.geometry}] };
  const checked = inspectFeature(normalized, sample);
  const pointE = a.e;
  const pointN = a.n;
  if (!Number.isFinite(pointE) || !Number.isFinite(pointN) ||
    pointE < 370000 || pointE > 630000 || pointN < 25000 || pointN > 200000) {
    throw new Error('Missing/invalid FURS reference point for ' + sample.race);
  }
  const [minE, minN, maxE, maxN] = checked.bbox_d96tm_m;
  const pointWithinBbox = pointE >= minE && pointE <= maxE && pointN >= minN && pointN <= maxN;
  if (!pointWithinBbox || !pointInsideSettlementRings(pointE, pointN, f.geometry.rings)) {
    throw new Error('FURS reference point lies outside settlement polygon for ' + sample.race);
  }
  return {
    ...checked, status: 'LIVE_FURS_GEOMETRY_CROSSCHECKED_NOT_A_START', source: FURS_LAYER,
    reference_point_epsg3794: { e: pointE, n: pointN },
    reference_point_within_bbox: pointWithinBbox,
    reference_point_within_polygon: true,
    archive_2024_reference_point_offset_m: Math.round(Math.hypot(pointE - sample.oldE, pointN - sample.oldN)),
    effective_from_raw: a.d_od ?? null, snapshot_date_verified: false
  };
}

export async function runFursCrosscheck({ fetchImpl = fetch, now = () => new Date().toISOString() } = {}) {
  const report = { purpose: 'READ_ONLY_DEV056_OFFICIAL_FURS_GEOMETRY_CROSSCHECK', verified_at: now(), geohub: GEOHUB_LAYER, furs_gurs_derived: FURS_LAYER, writes: false, master_or_website_changed: false, license_and_data_recency_need_review: true, checks: [], result: 'NOT_VERIFIED' };
  try {
    report.geohub_metadata = assertLayerMetadata(await fetchJson(GEOHUB_LAYER + '?f=json', fetchImpl));
    report.furs_metadata = assertFursMetadata(await fetchJson(FURS_LAYER + '?f=json', fetchImpl));
    for (const sample of SAMPLES) {
      const begin = performance.now();
      inspectGeoHubIdentity(await fetchJson(featureRequestUrl(sample), fetchImpl), sample);
      const feature = inspectFursRecord(await fetchJson(fursUrl(sample), fetchImpl, 30000), sample);
      report.checks.push({ ...feature, geohub_identity_ok: true, elapsed_ms: Math.round(performance.now()-begin), geohub_url: featureRequestUrl(sample), furs_url: fursUrl(sample) });
    }
    report.checks.push(...REJECTIONS.map(x => ({ ...x, status: 'CORRECTLY_REJECTED_NO_QUERY' })));
    report.result = 'LIVE_CROSS_SOURCE_POLYGON_PASS_NOT_APPROVED_FOR_PUBLIC_PINS';
  } catch(error) {
    report.error = String(error instanceof Error ? error.message : error);
    report.result = 'NOT_AVAILABLE_OR_MISMATCH_STOP';
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runFursCrosscheck();
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.result !== 'LIVE_CROSS_SOURCE_POLYGON_PASS_NOT_APPROVED_FOR_PUBLIC_PINS') process.exitCode=1;
}
