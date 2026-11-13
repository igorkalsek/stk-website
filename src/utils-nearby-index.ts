import { isApprovedLocation, type NearbyEditionLocation, type NearbyPoint, type NearbyPrecision } from './utils-nearby-races.js';

/** One CC0 reference per place; editions never duplicate its coordinates. */
export type NearbyPlace = NearbyPoint & {
  id: string;
  label: string;
  municipality: string;
  precision: Exclude<NearbyPrecision, 'start'>;
  sourceUrl: string;
  sourceRevision: number;
  sourceClaim: string;
  coordinatePrecisionDegrees: number;
  sourceCheckedOn: string;
  license: 'CC0-1.0';
};

export type NearbyEditionBinding = {
  year: string;
  masterRow: number;
  expectedDate: string;
  expectedTitle: string;
  expectedPlace: string;
  expectedRegion: string;
  placeId: string;
  referenceNote?: string;
  /** Optional edition-specific upgrade; never carried into another edition. */
  start?: NearbyPoint & { sourceUrl: string; sourceCheckedOn: string };
};

/** Fail closed on catalogue/edition collisions and invalid references. */
export function buildNearbyLocationIndex(
  places: readonly NearbyPlace[], bindings: readonly NearbyEditionBinding[]
): readonly NearbyEditionLocation[] {
  const catalog = new Map(places.map(place => [place.id, place]));
  if (catalog.size !== places.length) return [];
  const seen = new Set<string>();
  const result: NearbyEditionLocation[] = [];
  for (const binding of bindings) {
    const key = `${binding.year}!${binding.masterRow}`;
    const place = catalog.get(binding.placeId);
    if (!place || seen.has(key) || !binding.expectedPlace || !binding.expectedRegion) return [];
    seen.add(key);
    const common = {
      ...binding, reviewStatus: 'approved' as const, approved_for_runtime: true,
      sourceEditionYear: Number(binding.year)
    };
    const location: NearbyEditionLocation = binding.start ? {
      ...common, ...binding.start, precision: 'start', sourceKind: 'official-edition-start'
    } : {
      ...common, ...place, sourceKind: 'wikidata-place'
    };
    if (!isApprovedLocation(location)) return [];
    result.push(location);
  }
  return result;
}
