import { NEARBY_PLACES, NEARBY_EDITION_BINDINGS } from '../data/nearby-geography.js';
import { buildNearbyLocationIndex } from '../utils-nearby-index.js';
import type { NearbyOriginPlace } from './race-finder-nearby-ui.js';

export const NEARBY_EDITION_LOCATIONS = buildNearbyLocationIndex(NEARBY_PLACES, NEARBY_EDITION_BINDINGS);
export const NEARBY_ORIGINS: readonly NearbyOriginPlace[] = NEARBY_EDITION_LOCATIONS.length
  ? NEARBY_PLACES.map(place => ({
    ...place, labelSl: place.label, labelEn: place.label,
    reviewStatus: 'approved', approved_for_runtime: true
  })) : [];
