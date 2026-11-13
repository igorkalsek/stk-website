import base from '../astro.config.mjs';

// Deliberately an ALTERNATE CI-only Astro config. Normal astro.config.mjs and
// the production Finder source keep NEARBY_PUBLIC_ENABLED=false and index=[].
// Never use this build variant for production or publish its generated dist/.
if (process.env.DEV056_PRIVATE_BROWSER_TEST !== '1' || process.env.CF_PAGES) {
  throw new Error('DEV-056 private browser fixture is forbidden outside isolated test builds.');
}

// A distinct explicit test mode reuses the staged, snapshot-bound release data.
// Both modes are blocked in Cloudflare/production environments.
const LIVE_PILOT_TEST = process.env.DEV056_RELEASE_PILOT_BROWSER_TEST === '1';
const PLACEHOLDER = 'const NEARBY_PUBLIC_ENABLED = false;';
const INDEX = 'const APPROVED_NEARBY_LOCATIONS: readonly NearbyEditionLocation[] = DEV056_PILOT_EDITION_LOCATIONS;';
const ORIGINS = 'const NEARBY_ORIGIN_PLACES: readonly NearbyOriginPlace[] = DEV056_PILOT_ORIGIN_PLACES; // inert until public flag enabled';
const PRIVATE_ORIGINS = `const NEARBY_ORIGIN_PLACES: readonly NearbyOriginPlace[] = [{
  id: 'synthetic-test-origin', labelSl: 'Testno izhodišče', labelEn: 'Synthetic test origin',
  latitude: 46.34, longitude: 15.164716,
  sourceUrl: 'https://example.org/dev056-synthetic-origin',
  sourceCheckedOn: '2026-11-13', reviewStatus: 'approved', approved_for_runtime: true
}];`;
const PRIVATE_INDEX = `const APPROVED_NEARBY_LOCATIONS: readonly NearbyEditionLocation[] = [{
  year: '2027', masterRow: 51,
  latitude: 46.2490358, longitude: 15.164716,
  precision: 'settlement-approximate', sourceKind: 'official-settlement',
  reviewStatus: 'approved', approved_for_runtime: true,
  sourceCheckedOn: '2026-11-12', sourceFeatureVerified: true,
  sourceUrl: 'https://ipi.eprostor.gov.si/wfs-si-gurs-rpe/ogc/features/collections/SI.GURS.RPE%3ANASELJA/items/110300000101473100?f=json'
}];`;

export default {
  ...base,
  vite: {
    ...base.vite,
    plugins: [
      ...(base.vite?.plugins ?? []),
      {
        name: 'dev056-private-test-only-finder-instrumentation',
        enforce: 'pre',
        transform(code, id) {
          if (id.split('?')[0].replaceAll('\\', '/').endsWith('/src/finder/race-finder-controller.ts')) {
            if (code.split(PLACEHOLDER).length !== 2 || code.split(INDEX).length !== 2 || code.split(ORIGINS).length !== 2) {
              throw new Error('DEV-056 private test instrumentation anchors changed; refusing build.');
            }
            if (LIVE_PILOT_TEST) {
              // Crucially: only flip the flag in a CI-private build. Retain
              // edition snapshots/origins from the reviewed pilot index.
              return code.replace(PLACEHOLDER, 'const NEARBY_PUBLIC_ENABLED = true;');
            }
            return code.replace(PLACEHOLDER, 'const NEARBY_PUBLIC_ENABLED = true;')
              .replace(INDEX, PRIVATE_INDEX).replace(ORIGINS, PRIVATE_ORIGINS);
          }
        }
      }
    ]
  }
};
