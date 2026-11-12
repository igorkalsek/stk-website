/**
 * STK DEV-056 P1 prototype: pure, non-networked distance matching.
 *
 * This module is deliberately not wired to the public Finder. In particular,
 * it does not geocode names, request browser geolocation, persist coordinates,
 * or convert a settlement reference point into an exact race start.
 *
 * Public integration needs an approved edition-specific index, origin selector,
 * honest partial-coverage UI, provenance/attribution and SL/EN regressions.
 */
export const NEARBY_RADII_KM = [10, 25, 50, 100] as const;
export type NearbyRadiusKm = typeof NEARBY_RADII_KM[number];
export type NearbyPoint = { latitude: number; longitude: number };
export type NearbyEvent = { year: string; row: string };
export type NearbyPrecision = 'start' | 'settlement-approximate';

export type NearbyEditionLocation = NearbyPoint & {
  year: string;
  masterRow: number;
  precision: NearbyPrecision;
  /** Requires explicit review; merely being present in an API is not approval. */
  reviewStatus: 'approved' | 'review';
  sourceUrl: string;
  sourceCheckedOn: string;   // ISO date, date of verification
  sourceKind: 'official-edition-start' | 'official-settlement';
  /** An organizer's 2026 start is not automatically valid for the 2027 edition. */
  sourceEditionYear?: number;
  /** For official SETTLEMENT data only; record DATUM_SYS is not a dataset snapshot. */
  sourceSnapshotOn?: string;
};

export type NearbyMatch<T> = {
  event: T;
  distanceKm: number;
  approximate: boolean;
};

export type NearbyFilterResult<T> = {
  /** A partial result must never be described as a complete list of nearby races. */
  status: 'ready' | 'partial' | 'unavailable';
  matches: NearbyMatch<T>[];
  unlocatedEditionKeys: string[];
  reason?: 'invalid-origin-or-radius' | 'invalid-or-duplicate-index';
};

const EARTH_RADIUS_KM = 6371.0088;
const toRadians = (angle: number) => angle * Math.PI / 180;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const isRealIsoDate = (value: string) => {
  if (!datePattern.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === value;
};

export const isValidWgs84 = (value: unknown): value is NearbyPoint => {
  if (value === null || typeof value !== 'object') return false;
  const point = value as Partial<NearbyPoint>;
  return typeof point.latitude === 'number' && Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90 &&
    typeof point.longitude === 'number' && Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180;
};

/** Haversine straight-line distance, NOT a driving distance or trail length. */
export const airDistanceKm = (a: NearbyPoint, b: NearbyPoint): number => {
  if (!isValidWgs84(a) || !isValidWgs84(b)) return Number.NaN;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);
  const h = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
};

/** Stable master-row edition identity; no name-only joins and no race_id reuse. */
export const editionKey = (event: NearbyEvent): string | null => {
  const year = String(event.year ?? '');
  const row = String(event.row ?? '').trim();
  if (!/^\d{4}$/.test(year) || Number(year) < 2026 || !/^\d+$/.test(row)) return null;
  const n = Number(row);
  return Number.isSafeInteger(n) && n > 1 ? `${year}!${n}` : null;
};

const isApprovedLocation = (location: NearbyEditionLocation): boolean => {
  const key = editionKey({ year: location.year, row: String(location.masterRow) });
  if (!key || !isValidWgs84(location) || location.reviewStatus !== 'approved') return false;
  if (location.precision !== 'start' && location.precision !== 'settlement-approximate') return false;
  if (!/^https:\/\//i.test(location.sourceUrl)) return false;
  if (!isRealIsoDate(location.sourceCheckedOn)) return false;
  if (location.precision === 'start') {
    // Direct race-edition organizer GPS: no GURS snapshot date is applicable.
    return location.sourceKind === 'official-edition-start' &&
      location.sourceEditionYear === Number(location.year) &&
      location.sourceSnapshotOn === undefined;
  }
  // Settlement reference: require a separately verified source SNAPSHOT date.
  return location.sourceKind === 'official-settlement' &&
    typeof location.sourceSnapshotOn === 'string' &&
    isRealIsoDate(location.sourceSnapshotOn) &&
    location.sourceSnapshotOn <= location.sourceCheckedOn;
};

/**
 * No implicit activation: caller must give an explicitly reviewed index.
 * When any confirmed race lacks a usable location, result.status='partial' and
 * the caller MUST show coverage limitations instead of claiming completeness.
 */
export function filterNearbyRaces<T extends NearbyEvent>(
  events: readonly T[],
  index: readonly NearbyEditionLocation[],
  origin: NearbyPoint,
  radiusKm: number
): NearbyFilterResult<T> {
  if (!isValidWgs84(origin) || !NEARBY_RADII_KM.includes(radiusKm as NearbyRadiusKm)) {
    return { status: 'unavailable', matches: [], unlocatedEditionKeys: [], reason: 'invalid-origin-or-radius' };
  }
  const byEdition = new Map<string, NearbyEditionLocation>();
  for (const record of index) {
    const key = editionKey({ year: record.year, row: String(record.masterRow) });
    if (!key || byEdition.has(key)) {
      return { status: 'unavailable', matches: [], unlocatedEditionKeys: [], reason: 'invalid-or-duplicate-index' };
    }
    byEdition.set(key, record);
  }

  const seen = new Set<string>();
  const matches: NearbyMatch<T>[] = [];
  const unlocatedEditionKeys: string[] = [];
  for (const event of events) {
    const key = editionKey(event);
    if (key === null || seen.has(key)) {
      return { status: 'unavailable', matches: [], unlocatedEditionKeys: [], reason: 'invalid-or-duplicate-index' };
    }
    seen.add(key);
    const location = byEdition.get(key);
    if (!location || !isApprovedLocation(location)) {
      unlocatedEditionKeys.push(key);
      continue;
    }
    const distanceKm = airDistanceKm(origin, location);
    if (distanceKm <= radiusKm) {
      matches.push({ event, distanceKm, approximate: location.precision !== 'start' });
    }
  }
  matches.sort((a, b) => a.distanceKm - b.distanceKm);
  return {
    status: unlocatedEditionKeys.length ? 'partial' : 'ready',
    matches,
    unlocatedEditionKeys
  };
}
