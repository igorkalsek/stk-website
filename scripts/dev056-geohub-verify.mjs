/**
 * STK DEV-056: read-only verification of official settlement features.
 *
 * Intentionally separate from the website runtime. It never geocodes races,
 * persists coordinates, or treats a settlement reference as a race start.
 * Usage: node scripts/dev056-geohub-verify.mjs
 *        node scripts/dev056-geohub-verify.mjs --help
 */
import { pathToFileURL } from 'node:url';

export const GEOHUB_LAYER =
  'https://geohub.gov.si/ags/rest/services/MDP_DGO_APPS/eUprava_GH_prostorske_enote/MapServer/20207';
export const ARCHIVE_SOURCE = {
  repository: 'https://github.com/stefanb/gurs-rpe/blob/master/data/NA.csv',
  file_commit: '13121726139406ac624a25fc8b96540629ebb35d',
  last_file_change: '2024-02-21',
};

// Each source ID is a settlement ID, NOT a STK event or start ID.
export const SAMPLES = Object.freeze([
  { race: '2027!51', settlement: 'Žalec', municipality: 'Žalec', naMid: 10147310, oldE: 512640, oldN: 123485 },
  { race: '2027!19', settlement: 'Križ', municipality: 'Sežana', naMid: 10131219, oldE: 411938, oldN: 67867 },
  { race: '2026!266', settlement: 'Štanjel', municipality: 'Komen', naMid: 10132002, oldE: 410178, oldN: 76587 },
]);
export const REJECTIONS = Object.freeze([
  { race: '2027!8', reason: 'REGION_NOT_SINGLE_SETTLEMENT', description: 'Vipavska dolina is a region; no automatic settlement point' },
  { race: '2027!12', reason: 'MULTIPLE_STARTS', description: 'Kras Trail has multiple race-distance start locations' },
]);

const REQUIRED_FIELDS = ['NA_MID', 'NAZIV', 'OBCINA_NAZIV'];
const normalize = (value) => String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('sl-SI');
const isInteger = (n) => typeof n === 'number' && Number.isInteger(n);

export function assertLayerMetadata(payload) {
  if (!payload || typeof payload !== 'object' || payload.error) throw new Error('Layer metadata missing or ArcGIS error');
  if (payload.id !== 20207 || payload.geometryType !== 'esriGeometryPolygon') {
    throw new Error('Unexpected layer id or geometry type');
  }
  const wkid = payload.extent?.spatialReference?.wkid ?? payload.spatialReference?.wkid;
  if (wkid !== 3794) throw new Error(`Unexpected layer CRS: ${wkid ?? 'missing'}`);
  const fields = new Set((payload.fields ?? []).map((f) => f.name));
  for (const field of REQUIRED_FIELDS) if (!fields.has(field)) throw new Error(`Missing expected field: ${field}`);
  if (!payload.capabilities?.includes('Query') && !payload.supportsAdvancedQueries) {
    throw new Error('Query is not advertised by layer metadata');
  }
  return { id: payload.id, name: payload.name, wkid, fields: REQUIRED_FIELDS, last_edit_date: payload.editingInfo?.lastEditDate ?? null };
}

export function featureRequestUrl(sample) {
  if (!SAMPLES.some((known) => known.naMid === sample.naMid)) throw new Error('Non-allowlisted settlement');
  const url = new URL(`${GEOHUB_LAYER}/query`);
  url.searchParams.set('where', `NA_MID=${sample.naMid}`);
  url.searchParams.set('outFields', 'NA_MID,NAZIV,OBCINA_NAZIV,EID_NASELJE');
  url.searchParams.set('returnGeometry', 'true');
  url.searchParams.set('outSR', '3794');
  url.searchParams.set('resultRecordCount', '2');
  url.searchParams.set('f', 'json');
  return url.toString();
}

export function inspectGeoHubSettlementIdentity(payload, sample) {
  if (!payload || typeof payload !== 'object' || payload.error || !Array.isArray(payload.features) || payload.exceededTransferLimit || payload.features.length !== 1) {
    throw new Error(`Expected one GeoHub settlement identity for ${sample.race}`);
  }
  const feature = payload.features[0];
  const attr = feature?.attributes;
  if (!isInteger(attr?.NA_MID) || attr.NA_MID !== sample.naMid ||
    normalize(attr.NAZIV) !== normalize(sample.settlement) ||
    normalize(attr.OBCINA_NAZIV) !== normalize(sample.municipality)) {
    throw new Error(`GeoHub identity mismatch for ${sample.race}`);
  }
  return {
    race: sample.race,
    settlement: sample.settlement,
    municipality: sample.municipality,
    na_mid: sample.naMid,
    status: 'LIVE_GEOHUB_IDENTITY_PASS_GEOMETRY_CHECKED_SEPARATELY',
    geometry_supplied_by_geohub: Boolean(feature.geometry?.rings?.length),
    published_start_coordinate: false
  };
}

export function inspectFeature(payload, sample) {
  if (!payload || typeof payload !== 'object' || payload.error || !Array.isArray(payload.features)) {
    throw new Error(`Missing features or ArcGIS error for ${sample.race}`);
  }
  if (payload.exceededTransferLimit || payload.features.length !== 1) {
    throw new Error(`Expected one unambiguous settlement for ${sample.race}, got ${payload.features.length}`);
  }
  const feature = payload.features[0];
  const attr = feature?.attributes;
  if (!isInteger(attr?.NA_MID) || attr.NA_MID !== sample.naMid) throw new Error(`NA_MID mismatch for ${sample.race}`);
  if (normalize(attr.NAZIV) !== normalize(sample.settlement)) throw new Error(`Settlement name mismatch for ${sample.race}`);
  if (normalize(attr.OBCINA_NAZIV) !== normalize(sample.municipality)) throw new Error(`Municipality mismatch for ${sample.race}`);
  const rings = feature.geometry?.rings;
  if (!Array.isArray(rings) || !rings.length || rings.length > 5000) {
    const geometryKeys = feature.geometry && typeof feature.geometry === 'object'
      ? Object.keys(feature.geometry).sort().join(',') || 'none'
      : 'none';
    const featureKeys = feature && typeof feature === 'object'
      ? Object.keys(feature).sort().join(',') || 'none'
      : 'none';
    throw new Error(`Missing/bad polygon for ${sample.race}; geometry_keys=${geometryKeys}; feature_keys=${featureKeys}; ring_count=${Array.isArray(rings) ? rings.length : 'absent'}`);
  }
  let vertices = 0;
  const bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 4) throw new Error(`Invalid ring for ${sample.race}`);
    vertices += ring.length;
    if (vertices > 250000) throw new Error('Excessively large polygon');
    for (const point of ring) {
      if (!Array.isArray(point) || point.length < 2) throw new Error('Invalid vertex');
      const [e, n] = point;
      if (!Number.isFinite(e) || !Number.isFinite(n) || e < 370000 || e > 630000 || n < 25000 || n > 200000) {
        throw new Error(`Invalid EPSG:3794 coordinates for ${sample.race}`);
      }
      bb[0] = Math.min(bb[0], e);
      bb[1] = Math.min(bb[1], n);
      bb[2] = Math.max(bb[2], e);
      bb[3] = Math.max(bb[3], n);
    }
    const a = ring[0], z = ring.at(-1);
    if (Math.abs(a[0] - z[0]) > 1e-7 || Math.abs(a[1] - z[1]) > 1e-7) {
      throw new Error(`Unclosed polygon ring for ${sample.race}`);
    }
  }
  return {
    race: sample.race,
    settlement: sample.settlement,
    municipality: sample.municipality,
    na_mid: sample.naMid,
    status: 'LIVE_FEATURE_STRUCTURE_PASS_NOT_A_START_PIN',
    geometry: 'polygon',
    crs: 'EPSG:3794',
    ring_count: rings.length,
    vertex_count: vertices,
    bbox_d96tm_m: bb,
    archival_centroid_2024_within_bbox: sample.oldE >= bb[0] && sample.oldE <= bb[2] && sample.oldN >= bb[1] && sample.oldN <= bb[3],
    published_start_coordinate: false,
  };
}

export async function fetchJson(url, fetchImpl = fetch, timeoutMs = 10000) {
  const response = await fetchImpl(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!response?.ok) throw new Error(`GeoHub HTTP ${response?.status ?? 'no response'}`);
  return response.json();
}

export async function runVerification({ fetchImpl = fetch, now = () => new Date().toISOString() } = {}) {
  const report = {
    purpose: 'READ_ONLY_DEV056_OFFLINE_P1_DATA_GATE',
    verified_at: now(),
    source_layer: GEOHUB_LAYER,
    archival_baseline: ARCHIVE_SOURCE,
    writes: false,
    site_or_master_changed: false,
    source_version_warning: 'A live HTTP response alone does not prove data snapshot currency; verify authoritative update date separately.',
    checks: [],
    result: 'NOT_VERIFIED',
  };
  try {
    const meta = await fetchJson(`${GEOHUB_LAYER}?f=json`, fetchImpl);
    report.layer = assertLayerMetadata(meta);
    for (const sample of SAMPLES) {
      const started = performance.now();
      const payload = await fetchJson(featureRequestUrl(sample), fetchImpl);
      report.checks.push({ ...inspectGeoHubSettlementIdentity(payload, sample), elapsed_ms: Math.round(performance.now() - started), source_url: featureRequestUrl(sample) });
    }
    report.checks.push(...REJECTIONS.map((item) => ({ ...item, status: 'CORRECTLY_REJECTED_NO_QUERY' })));
    report.result = 'LIVE_GEOHUB_IDENTITY_PASS_FURS_GEOMETRY_REVIEW_REQUIRED';
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    report.result = 'NOT_AVAILABLE_OR_MISMATCH_STOP';
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.slice(2).includes('--help')) {
    process.stdout.write('Read-only GeoHub test: node scripts/dev056-geohub-verify.mjs > dev056-geohub-results.json\n');
  } else {
    const output = await runVerification();
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    if (!output.result.startsWith('LIVE_GEOHUB_IDENTITY_PASS')) process.exitCode = 1;
  }
}
