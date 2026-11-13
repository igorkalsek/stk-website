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
export type NearbyEvent = { year: string; row: string; /** Required for distinct start lines. */ startRoles?: readonly string[] };
export type NearbyPrecision = 'start' | 'settlement-approximate' | 'place-approximate';

export type NearbyEditionLocation = NearbyPoint & {
  year: string;
  masterRow: number;
  precision: NearbyPrecision;
  /** Requires explicit review; merely being present in an API is not approval. */
  reviewStatus: 'approved' | 'review';
  /** Optional discipline/start role for multi-start editions. */
  startRole?: string;
  /** Research fixtures must never become runtime matches merely by being imported. */
  /** Must be explicitly true after human review before runtime use. */
  approved_for_runtime: boolean;
  sourceUrl: string;
  sourceCheckedOn: string;   // ISO date, date of verification
  sourceKind: 'official-edition-start' | 'official-settlement' | 'documented-place-reference';
  /** An organizer's 2026 start is not automatically valid for the 2027 edition. */
  sourceEditionYear?: number;
  /** For official SETTLEMENT data only; record DATUM_SYS is not a dataset snapshot. */
  sourceSnapshotOn?: string;
  /** Manually checked matching GURS settlement feature, when dataset snapshot date is not supplied. */
  sourceFeatureVerified?: boolean;
  /** Manual review only confirms a reference place, not a race start. */
  referenceLocationVerified?: boolean;
  /** Season/edition official organizer evidence for non-GURS reference places. */
  editionEvidenceUrl?: string;
};

export type NearbyMatch<T> = {
  event: T;
  distanceKm: number;
  approximate: boolean;
  /** Start role used to calculate the distance, when multiple starts exist. */
  matchedRole?: string;
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
  if (!key || !isValidWgs84(location) || location.reviewStatus !== 'approved' || location.approved_for_runtime !== true) return false;
  if (location.precision !== 'start' && location.precision !== 'settlement-approximate' && location.precision !== 'place-approximate') return false;
  if (!/^https:\/\//i.test(location.sourceUrl)) return false;
  if (!isRealIsoDate(location.sourceCheckedOn)) return false;
  if (location.precision === 'start') {
    // Direct race-edition organizer GPS: no GURS snapshot date is applicable.
    return location.sourceKind === 'official-edition-start' &&
      location.sourceEditionYear === Number(location.year) &&
      location.sourceSnapshotOn === undefined;
  }
  // A documented landmark/hiking-route reference is suitable ONLY for coarse
  // race discovery, never as a start pin or as a GURS settlement centroid.
  // Official organizer evidence for this edition remains mandatory.
  if (location.precision === 'place-approximate') {
    return location.sourceKind === 'documented-place-reference' &&
      location.referenceLocationVerified === true &&
      location.sourceEditionYear === Number(location.year) &&
      location.sourceSnapshotOn === undefined &&
      typeof location.editionEvidenceUrl === 'string' &&
      /^https:\/\//i.test(location.editionEvidenceUrl);
  }
  // Settlement approximation: prefer a dated dataset snapshot when known.
  // GURS serves individual official settlement features without a published
  // snapshot date here; a verified FEATURE ID is sufficient for a visibly
  // approximate location, but never for an exact race-start pin.
  const datedSnapshot = typeof location.sourceSnapshotOn === 'string' &&
    isRealIsoDate(location.sourceSnapshotOn) &&
    location.sourceSnapshotOn <= location.sourceCheckedOn;
  const verifiedFeatureWithoutSnapshot = location.sourceSnapshotOn === undefined &&
    location.sourceFeatureVerified === true &&
    /^https:\/\/ipi\.eprostor\.gov\.si\/wfs-si-gurs-rpe\/ogc\/features\/collections\/SI\.GURS\.RPE(?:%3A|:)NASELJA\/items\/[0-9]+\?f=json$/i.test(location.sourceUrl);
  return location.sourceKind === 'official-settlement' &&
    (datedSnapshot || verifiedFeatureWithoutSnapshot);
};

/**
 * Read-only coverage is measured against the FULL caller-supplied set of upcoming,
 * confirmed, publicly visible editions. This cannot establish how many races
 * without known coordinates are inside any particular search radius.
 *
 * Do not interpret a zero-match radius result as "no races nearby" when the
 * complete event population has partial coverage.
 */
export type NearbyCoverageSummary = {
  status: 'complete' | 'partial' | 'empty' | 'unavailable';
  totalEditions: number;
  locatedEditions: number;
  exactStartEditions: number;
  approximateSettlementEditions: number;
  approximatePlaceEditions: number;
  coveragePercent: number | null;
  unlocatedEditionKeys: string[];
  reason?: 'invalid-or-duplicate-index';
};

const startRolePattern = /^[a-z][a-z0-9_-]*$/;
const hasValidStartRoles = (event: NearbyEvent): boolean => {
  if (event.startRoles === undefined) return true;
  const roles = event.startRoles;
  return Array.isArray(roles) && roles.length >= 2 &&
    roles.every(role => typeof role === 'string' && startRolePattern.test(role)) &&
    new Set(roles).size === roles.length;
};

/** Legacy single-venue entries are unscoped; multi-venue entries need distinct roles. */
const indexByEdition = (index: readonly NearbyEditionLocation[]): Map<string, NearbyEditionLocation[]> | null => {
  const mapped = new Map<string, NearbyEditionLocation[]>();
  for (const record of index) {
    const key = editionKey({ year: record.year, row: String(record.masterRow) });
    if (!key) return null;
    const existing = mapped.get(key) || [];
    if (record.startRole !== undefined) {
      if (typeof record.startRole !== 'string' || !startRolePattern.test(record.startRole) ||
          existing.some(x => x.startRole === undefined || x.startRole === record.startRole)) return null;
    } else if (existing.length) {
      return null;
    }
    existing.push(record);
    mapped.set(key, existing);
  }
  return mapped;
};

/**
 * Multi-start editions may use ONE explicitly approximate, verified settlement
 * reference for race discovery, or all approved exact start roles. A settlement
 * point is NOT an individual adult/youth start and must be labeled approximate.
 * Partial role-specific coordinates cannot substitute for missing roles.
 */
const usableEditionStarts = (event: NearbyEvent, locations: NearbyEditionLocation[] | undefined): NearbyEditionLocation[] | null => {
  if (!locations || !locations.length) return null;
  if (event.startRoles === undefined) {
    return locations.length === 1 && locations[0].startRole === undefined &&
      isApprovedLocation(locations[0]) ? locations : null;
  }
  // Discovery fallback applies to the whole edition, not a specific course.
  // It remains approximate even if several disciplines have distinct starts.
  if (locations.length === 1 && locations[0].startRole === undefined &&
      (locations[0].precision === 'settlement-approximate' || locations[0].precision === 'place-approximate') &&
      isApprovedLocation(locations[0])) return locations;
  if (locations.length !== event.startRoles.length) return null;
  if (locations.some(x => !x.startRole || !event.startRoles!.includes(x.startRole) ||
      x.precision !== 'start' || !isApprovedLocation(x))) return null;
  return locations;
};

export function summarizeNearbyCoverage<T extends NearbyEvent>(
  events: readonly T[],
  index: readonly NearbyEditionLocation[]
): NearbyCoverageSummary {
  const unavailable = (): NearbyCoverageSummary => ({
    status: 'unavailable', totalEditions: 0, locatedEditions: 0,
    exactStartEditions: 0, approximateSettlementEditions: 0, approximatePlaceEditions: 0,
    coveragePercent: null, unlocatedEditionKeys: [],
    reason: 'invalid-or-duplicate-index'
  });
  const mapped = indexByEdition(index);
  if (!mapped) return unavailable();

  const seen = new Set<string>();
  const missing: string[] = [];
  let exact = 0;
  let approximate = 0;
  let approximatePlace = 0;
  for (const event of events) {
    const key = editionKey(event);
    if (!key || seen.has(key) || !hasValidStartRoles(event)) return unavailable();
    seen.add(key);
    const locations = usableEditionStarts(event, mapped.get(key));
    if (!locations) {
      missing.push(key);
    } else if (locations.every(x => x.precision === 'start')) {
      exact++;
    } else if (locations.some(x => x.precision === 'place-approximate')) {
      approximatePlace++;
    } else {
      approximate++;
    }
  }
  const total = events.length;
  const located = exact + approximate + approximatePlace;
  return {
    status: total === 0 ? 'empty' : missing.length ? 'partial' : 'complete',
    totalEditions: total,
    locatedEditions: located,
    exactStartEditions: exact,
    approximateSettlementEditions: approximate,
    approximatePlaceEditions: approximatePlace,
    coveragePercent: total === 0 ? null : Math.round(1000 * located / total) / 10,
    unlocatedEditionKeys: missing
  };
}

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
  const byEdition = indexByEdition(index);
  if (!byEdition) {
    return { status: 'unavailable', matches: [], unlocatedEditionKeys: [], reason: 'invalid-or-duplicate-index' };
  }

  const seen = new Set<string>();
  const matches: NearbyMatch<T>[] = [];
  const unlocatedEditionKeys: string[] = [];
  for (const event of events) {
    const key = editionKey(event);
    if (key === null || seen.has(key) || !hasValidStartRoles(event)) {
      return { status: 'unavailable', matches: [], unlocatedEditionKeys: [], reason: 'invalid-or-duplicate-index' };
    }
    seen.add(key);
    const locations = usableEditionStarts(event, byEdition.get(key));
    if (!locations) {
      unlocatedEditionKeys.push(key);
      continue;
    }
    const nearest = locations.map(location => ({location, distanceKm: airDistanceKm(origin, location)}))
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];
    if (nearest.distanceKm <= radiusKm) {
      matches.push({
        event, distanceKm: nearest.distanceKm,
        approximate: nearest.location.precision !== 'start',
        ...(nearest.location.startRole ? { matchedRole: nearest.location.startRole } : {})
      });
    }
  }
  matches.sort((a, b) => a.distanceKm - b.distanceKm);
  return {
    status: unlocatedEditionKeys.length ? 'partial' : 'ready',
    matches,
    unlocatedEditionKeys
  };
}

/** Non-UI SL/EN copy for future Nearby Finder integration. */
export function nearbyDiscoveryCopy(
  locale: 'sl' | 'en',
  coverage: NearbyCoverageSummary,
  radiusKm: number
): {
  distanceBasis: string;
  approximateNotice: string | null;
  coverageNotice: string | null;
  radiusNotice: string | null;
} {
  const en = locale === 'en';
  const approximate = coverage.approximateSettlementEditions + coverage.approximatePlaceEditions > 0;
  const incomplete = coverage.status === 'partial';
  return {
    distanceBasis: en ? 'Straight-line distance' : 'Zračna razdalja',
    approximateNotice: approximate ? (
      en ? 'Approximate settlement or venue location, not a verified race start.'
        : 'Približna lokacija naselja ali prizorišča, ne potrjenega štarta.'
    ) : null,
    coverageNotice: incomplete ? (
      en ? `Locations are missing for ${coverage.unlocatedEditionKeys.length} of ${coverage.totalEditions} races. Results may be incomplete.`
        : `Za ${coverage.unlocatedEditionKeys.length} od ${coverage.totalEditions} tekov lokacija ni preverjena. Rezultati so lahko nepopolni.`
    ) : null,
    radiusNotice: approximate && radiusKm === 10 ? (
      en ? 'With a 10 km radius, an approximate point may fall on the wrong side of the boundary.'
        : 'Pri radiju 10 km je lahko približna točka na napačni strani meje.'
    ) : null
  };
}

/**
 * Future Finder integration bridge. Keep this pure and inert until an
 * explicitly approved edition-level index and an origin selector exist.
 *
 * The full set must contain confirmed, publicly visible editions in scope
 * (for example, the selected public year and its upcoming races). The subset
 * is the result of the existing month/region/surface/fee/family filters.
 * Count missing locations AGAINST THE FULL set, not just the selected subset.
 * Join only by year + Master row, never by name, city or mutable race_key.
 */
export type NearbyFinderView<T> = {
  status: 'ready' | 'partial' | 'unavailable';
  matches: NearbyMatch<T>[];
  coverage: NearbyCoverageSummary;
  copy: ReturnType<typeof nearbyDiscoveryCopy>;
  reason?: 'invalid-origin-or-radius' | 'invalid-or-duplicate-index' | 'invalid-subset';
};

export function prepareNearbyFinderView<T extends NearbyEvent>(
  fullPublicEvents: readonly T[],
  filteredEvents: readonly T[],
  approvedLocations: readonly NearbyEditionLocation[],
  origin: NearbyPoint,
  radiusKm: number,
  locale: 'sl' | 'en'
): NearbyFinderView<T> {
  const coverage = summarizeNearbyCoverage(fullPublicEvents, approvedLocations);
  const copy = nearbyDiscoveryCopy(locale, coverage, radiusKm);

  const unavailable = (reason: NonNullable<NearbyFinderView<T>['reason']>): NearbyFinderView<T> => ({
    status: 'unavailable', matches: [], coverage, copy, reason
  });
  if (coverage.status === 'unavailable') return unavailable('invalid-or-duplicate-index');

  const fullKeys = new Set(fullPublicEvents.map(editionKey));
  const selected = new Map<string, T>();
  for (const race of filteredEvents) {
    const key = editionKey(race);
    if (!key || !fullKeys.has(key) || selected.has(key)) {
      return unavailable('invalid-subset');
    }
    selected.set(key, race);
  }

  // The original matcher performs the Haversine calculation, role validation,
  // explicit runtime-approval check and source verification, once for all
  // public editions. A zero-hit radius cannot claim complete coverage when
  // another public edition still has an unreviewed location.
  const result = filterNearbyRaces(fullPublicEvents, approvedLocations, origin, radiusKm);
  if (result.status === 'unavailable') {
    return unavailable(result.reason ?? 'invalid-or-duplicate-index');
  }

  const matches = result.matches.flatMap((match) => {
    const key = editionKey(match.event);
    const event = key ? selected.get(key) : undefined;
    return event ? [{ ...match, event }] : [];
  });
  return { status: result.status, matches, coverage, copy };
}
