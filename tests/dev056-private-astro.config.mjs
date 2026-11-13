import base from '../astro.config.mjs';

// Deliberately an ALTERNATE CI-only Astro config. Normal astro.config.mjs and
// normal builds keep the feature off unless PUBLIC_STK_NEARBY_ENABLED=1.
// Never use this build variant for production or publish its generated dist/.
if (process.env.DEV056_PRIVATE_BROWSER_TEST !== '1' || process.env.CF_PAGES) {
  throw new Error('DEV-056 private browser fixture is forbidden outside isolated test builds.');
}

const PLACEHOLDER = 'const NEARBY_PUBLIC_ENABLED = __STK_NEARBY_ENABLED__;';
const INDEX = 'const APPROVED_NEARBY_LOCATIONS: readonly NearbyEditionLocation[] = NEARBY_EDITION_LOCATIONS;';
const ORIGINS = 'const NEARBY_ORIGIN_PLACES: readonly NearbyOriginPlace[] = NEARBY_ORIGINS;';
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
            return code.replace(PLACEHOLDER, 'const NEARBY_PUBLIC_ENABLED = true;')
              .replace(INDEX, PRIVATE_INDEX).replace(ORIGINS, PRIVATE_ORIGINS);
          }
        }
      }
    ]
  }
};
