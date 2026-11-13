import type { NearbyEditionLocation } from '../utils-nearby-races';
import type { NearbyOriginPlace } from './race-finder-nearby-ui';

/**
 * STK DEV-056 — small geographic discovery pilot. Verified on 2026-11-13 against
 * official event-year sources, current Master year+row+date+name, and CC0 Wikidata
 * settlement coordinates. Not a full-Slovenia index and not a map of race starts.
 *
 * DO NOT activate independently: public controller flag is still false. Every
 * index change requires a new source/identity/displacement review and tests.
 */
export const DEV056_PILOT_EDITION_LOCATIONS: readonly NearbyEditionLocation[] = [
  {
    // Master 2026!266: exact coordinates printed by 2026 race organiser.
    year: '2026', masterRow: 266, expectedDate: '2026-12-05', expectedTitle: '25. Štanjelski tek',
    latitude: 45.8183333333, longitude: 13.8251166667,
    precision: 'start', sourceKind: 'official-edition-start',
    reviewStatus: 'approved', approved_for_runtime: true,
    sourceUrl: 'https://skd-hrusevica.si/25-stanjelski-tek/',
    sourceEditionYear: 2026, sourceCheckedOn: '2026-11-13'
  },
  {
    // Master 2027!19: organiser specifies event venue Vaški dom, Križ 2.
    // Wikidata village point is ~0.5km away — NOT the start. All age classes
    // are represented only as a shared approximation, never exact start lines.
    year: '2027', masterRow: 19, expectedDate: '2027-03-07',
    expectedTitle: '4. Trail po kraških klancih 2027',
    latitude: 45.745, longitude: 13.86805556,
    precision: 'place-approximate', sourceKind: 'documented-place-reference',
    referenceLocationVerified: true,
    sourceEditionYear: 2027, sourceCheckedOn: '2026-11-13',
    sourceUrl: 'https://www.wikidata.org/wiki/Q554106',
    editionEvidenceUrl: 'https://www.srd-kras.si/trail-2027',
    reviewStatus: 'approved', approved_for_runtime: true
  },
  {
    // Master 2027!22: adult start is by the football stadium in Sežana.
    // Wikidata CITY reference is ~1.4 km away from stadium reference.
    // This may misclassify races near a 10km search boundary.
    year: '2027', masterRow: 22, expectedDate: '2027-03-21',
    expectedTitle: 'Mali kraški maraton 2027',
    latitude: 45.7, longitude: 13.85,
    precision: 'place-approximate', sourceKind: 'documented-place-reference',
    referenceLocationVerified: true,
    sourceEditionYear: 2027, sourceCheckedOn: '2026-11-13',
    sourceUrl: 'https://www.wikidata.org/wiki/Q15916',
    editionEvidenceUrl: 'https://www.kraskimaraton.si/pravila-tekmovanja/',
    reviewStatus: 'approved', approved_for_runtime: true
  }
];

/** Manually selected, reviewed CC0 town origins. Never require GPS permission. */
export const DEV056_PILOT_ORIGIN_PLACES: readonly NearbyOriginPlace[] = [
  {
    id: 'kriz-sezana', labelSl: 'Križ pri Sežani', labelEn: 'Križ (near Sežana)',
    latitude: 45.745, longitude: 13.86805556,
    sourceUrl: 'https://www.wikidata.org/wiki/Q554106', sourceCheckedOn: '2026-11-13',
    reviewStatus: 'approved', approved_for_runtime: true
  },
  {
    id: 'sezana', labelSl: 'Sežana', labelEn: 'Sežana',
    latitude: 45.7, longitude: 13.85,
    sourceUrl: 'https://www.wikidata.org/wiki/Q15916', sourceCheckedOn: '2026-11-13',
    reviewStatus: 'approved', approved_for_runtime: true
  },
  {
    id: 'stanjel', labelSl: 'Štanjel', labelEn: 'Štanjel',
    latitude: 45.82305556, longitude: 13.84611111,
    sourceUrl: 'https://www.wikidata.org/wiki/Q392333', sourceCheckedOn: '2026-11-13',
    reviewStatus: 'approved', approved_for_runtime: true
  }
];

export const DEV056_PILOT_AUDIT = {
  reviewedOn: '2026-11-13',
  populationWindowFrom: '2026-11-13',
  populationWindowToExclusive: '2027-05-12',
  populationCountAtReview: 59,
  // This deliberate limited release ONLY has three edition coordinates.
  approvedEditionCount: 3,
  referenceProvenance: 'Wikidata P625 structured geographic data CC0',
  limitations: 'Kras area only. 2027 location points are village/city references, not race starts. All distances are straight-line and coverage is partial.',
  license: 'https://www.wikidata.org/wiki/Wikidata:Licensing'
} as const;
