import { formatSeasonRegionLabel, normalizeRegionKey, type SeasonRegionProgress } from './utils-my-season.js';

/**
 * Geometry: Eurostat GISCO NUTS 2024, NUTS level 3 and national boundary,
 * 1:20 million, EPSG:4326. Coordinates are projected to this SVG viewBox;
 * no boundaries were drawn by hand.
 *
 * Data files:
 * https://github.com/eurostat/Nuts2json/blob/master/pub/v2/2024/4326/20M/nutsrg_3.json
 * https://github.com/eurostat/Nuts2json/blob/master/pub/v2/2024/4326/20M/nutsrg_0.json
 * Dataset copyright: Eurostat. Reuse is subject to Eurostat/GISCO reuse
 * provisions; source acknowledgement is required. Nuts2json is EUPL-1.2.
 * https://github.com/eurostat/Nuts2json#copyright
 * https://github.com/eurostat/Nuts2json/blob/master/LICENSE
 */
export const SLOVENIA_STATISTICAL_REGIONS = [
  { nuts: 'SI031', key: 'pomurska', sl: 'Pomurska', path: 'M409.0 38.3 L408.5 41.8 L412.0 50.2 L411.6 54.7 L426.6 68.6 L431.7 81.5 L439.3 86.1 L405.5 73.3 L401.5 76.8 L392.9 81.5 L391.8 83.6 L375.2 83.6 L360.6 79.5 L361.1 78.9 L359.5 76.8 L356.5 72.3 L355.5 65.0 L351.4 64.0 L349.0 63.0 L343.9 53.3 L344.4 49.6 L332.9 43.0 L330.3 41.5 L340.9 38.7 L353.4 45.0 L363.5 50.6 L364.1 51.2 L364.6 44.4 L357.5 28.1 L358.6 16.2 L367.2 15.6 L374.2 10.0 L377.3 12.5 L382.8 12.1 L398.9 10.6 L405.9 16.6 L404.4 22.4 L401.5 23.8 L400.9 27.5 L409.0 38.3 Z', check: [379.4, 49.3] },
  { nuts: 'SI032', key: 'podravska', sl: 'Podravska', path: 'M391.8 83.6 L395.4 94.5 L399.9 105.1 L387.3 104.2 L367.2 102.0 L366.6 102.6 L368.1 110.4 L363.5 113.5 L355.5 119.1 L347.4 122.2 L341.9 124.2 L341.3 125.3 L330.8 128.3 L325.7 126.7 L323.2 126.3 L315.1 125.3 L310.1 123.8 L300.0 125.7 L298.0 124.2 L296.9 113.9 L291.4 108.8 L281.3 106.7 L279.3 102.0 L280.8 95.8 L269.2 86.1 L266.7 85.5 L266.3 83.0 L268.3 78.9 L274.3 68.1 L284.4 65.5 L278.8 51.7 L294.5 57.8 L297.5 56.2 L300.6 47.5 L308.6 46.5 L325.7 43.0 L330.3 41.5 L332.9 43.0 L344.4 49.6 L343.9 53.3 L349.0 63.0 L351.4 64.0 L355.5 65.0 L356.5 72.3 L359.5 76.8 L361.1 78.9 L360.6 79.5 L375.2 83.6 L391.8 83.6 Z', check: [328.7, 88.5] },
  { nuts: 'SI033', key: 'koroška', sl: 'Koroška', path: 'M278.8 51.7 L284.4 65.5 L274.3 68.1 L268.3 78.9 L266.3 83.0 L266.7 85.5 L267.8 91.4 L261.2 93.3 L255.1 102.6 L249.6 103.6 L241.0 97.4 L236.4 96.4 L218.2 90.2 L208.7 97.0 L197.7 96.4 L191.6 97.0 L181.0 91.4 L200.1 79.5 L200.1 77.4 L201.2 75.8 L200.6 74.9 L201.7 73.9 L200.6 72.7 L201.2 72.3 L209.2 59.9 L214.2 60.5 L233.4 51.7 L235.5 53.3 L246.1 51.2 L269.8 51.7 L278.8 51.7 Z', check: [233.5, 77.3] },
  { nuts: 'SI034', key: 'savinjska', sl: 'Savinjska', path: 'M330.8 128.3 L328.3 135.0 L315.1 134.5 L310.1 142.2 L309.1 161.8 L305.0 165.3 L312.1 172.5 L298.0 174.7 L288.9 165.0 L279.3 165.9 L272.7 164.4 L249.1 163.4 L245.6 160.3 L239.5 143.2 L239.0 142.8 L239.0 142.2 L230.4 140.1 L225.4 140.7 L220.3 140.7 L212.2 138.2 L209.2 132.5 L205.2 129.8 L188.0 128.3 L185.0 123.2 L175.9 107.7 L166.3 107.3 L165.8 106.1 L181.0 91.4 L191.6 97.0 L197.7 96.4 L208.7 97.0 L218.2 90.2 L236.4 96.4 L241.0 97.4 L249.6 103.6 L255.1 102.6 L261.2 93.3 L267.8 91.4 L266.7 85.5 L269.2 86.1 L280.8 95.8 L279.3 102.0 L281.3 106.7 L291.4 108.8 L296.9 113.9 L298.0 124.2 L300.0 125.7 L310.1 123.8 L315.1 125.3 L323.2 126.3 L325.7 126.7 L330.8 128.3 Z', check: [258.1, 124.8] },
  { nuts: 'SI035', key: 'zasavska', sl: 'Zasavska', path: 'M245.6 160.3 L238.4 160.3 L236.0 163.4 L233.4 165.9 L236.4 170.6 L238.0 174.7 L228.9 182.8 L224.3 185.9 L217.8 182.8 L212.7 171.6 L190.5 165.3 L186.0 163.4 L191.1 159.7 L202.1 152.5 L201.2 147.9 L210.7 138.5 L212.2 138.2 L220.3 140.7 L225.4 140.7 L230.4 140.1 L239.0 142.2 L239.0 142.8 L239.5 143.2 L245.6 160.3 Z', check: [222.7, 158.1] },
  { nuts: 'SI036', key: 'posavska', sl: 'Posavska', path: 'M309.1 161.8 L321.2 167.9 L319.7 183.4 L313.6 208.6 L296.9 209.2 L288.9 212.1 L278.8 218.9 L275.8 200.9 L271.3 200.3 L271.8 190.6 L264.3 187.1 L255.1 192.7 L244.5 182.8 L238.0 174.7 L236.4 170.6 L233.4 165.9 L236.0 163.4 L238.4 160.3 L245.6 160.3 L249.1 163.4 L272.7 164.4 L279.3 165.9 L288.9 165.0 L298.0 174.7 L312.1 172.5 L305.0 165.3 L309.1 161.8 Z', check: [276.0, 179.4] },
  { nuts: 'SI037', key: 'jugovzhodna slovenija', sl: 'Jugovzhodna Slovenija', path: 'M278.8 218.9 L269.2 224.6 L267.2 225.1 L259.7 231.7 L268.7 243.0 L266.3 250.4 L264.7 259.1 L272.7 279.7 L255.1 290.0 L232.4 277.0 L219.3 273.5 L203.7 281.7 L196.0 275.4 L183.0 260.1 L170.9 250.4 L166.9 242.0 L162.3 229.2 L167.8 229.8 L165.8 218.9 L168.9 218.3 L182.5 213.7 L200.1 231.2 L201.2 226.1 L198.1 218.0 L207.8 204.0 L214.2 185.5 L217.8 182.8 L224.3 185.9 L228.9 182.8 L238.0 174.7 L244.5 182.8 L255.1 192.7 L264.3 187.1 L271.8 190.6 L271.3 200.3 L275.8 200.9 L278.8 218.9 Z', check: [227.4, 225.9] },
  { nuts: 'SI038', key: 'primorsko-notranjska', sl: 'Primorsko-notranjska', path: 'M165.8 218.9 L167.8 229.8 L162.3 229.2 L166.9 242.0 L157.7 260.1 L138.1 278.5 L105.8 279.1 L103.2 252.9 L101.7 250.4 L103.2 233.9 L95.7 225.1 L96.8 210.2 L107.3 204.0 L127.4 208.1 L130.5 200.3 L140.1 202.4 L146.7 203.4 L156.2 201.5 L158.2 209.2 L165.8 218.9 Z', check: [134.9, 227.9] },
  { nuts: 'SI041', key: 'osrednjeslovenska', sl: 'Osrednjeslovenska', path: 'M217.8 182.8 L214.2 185.5 L207.8 204.0 L198.1 218.0 L201.2 226.1 L200.1 231.2 L182.5 213.7 L168.9 218.3 L165.8 218.9 L158.2 209.2 L156.2 201.5 L146.7 203.4 L140.1 202.4 L130.5 200.3 L127.4 208.1 L107.3 204.0 L106.9 201.8 L108.9 177.8 L114.9 171.6 L115.3 171.0 L120.4 159.7 L134.0 159.7 L143.2 147.9 L144.7 141.7 L151.7 141.3 L152.7 138.5 L157.3 139.7 L164.8 131.4 L163.4 118.5 L162.3 109.2 L166.3 107.3 L175.9 107.7 L185.0 123.2 L188.0 128.3 L205.2 129.8 L209.2 132.5 L212.2 138.2 L210.7 138.5 L201.2 147.9 L202.1 152.5 L191.1 159.7 L186.0 163.4 L190.5 165.3 L212.7 171.6 L217.8 182.8 Z', check: [169.3, 168.6] },
  { nuts: 'SI042', key: 'gorenjska', sl: 'Gorenjska', path: 'M148.7 92.3 L149.6 96.4 L160.3 98.0 L165.8 106.1 L166.3 107.3 L162.3 109.2 L163.4 118.5 L164.8 131.4 L157.3 139.7 L152.7 138.5 L151.7 141.3 L144.7 141.7 L143.2 147.9 L134.0 159.7 L120.4 159.7 L115.3 171.0 L114.9 171.6 L108.9 177.8 L104.3 175.2 L97.2 166.5 L94.2 164.4 L99.7 148.4 L88.7 141.3 L89.1 132.5 L70.0 133.5 L54.4 123.8 L52.8 121.1 L68.0 105.1 L47.8 93.3 L51.8 76.8 L91.1 85.1 L103.2 85.5 L110.9 93.9 L121.9 94.5 L148.7 92.3 Z', check: [117.7, 126.9] },
  { nuts: 'SI043', key: 'goriška', sl: 'Goriška', path: 'M108.9 177.8 L106.9 201.8 L107.3 204.0 L96.8 210.2 L95.7 225.1 L89.6 224.0 L77.5 215.2 L75.5 211.7 L68.5 210.6 L51.8 205.0 L46.3 213.3 L35.7 213.7 L37.7 197.4 L41.2 190.6 L39.2 181.3 L25.1 182.8 L22.5 168.4 L27.1 165.3 L44.7 145.3 L40.7 141.3 L17.5 135.0 L10.0 120.1 L47.8 93.3 L68.0 105.1 L52.8 121.1 L54.4 123.8 L70.0 133.5 L89.1 132.5 L88.7 141.3 L99.7 148.4 L94.2 164.4 L97.2 166.5 L104.3 175.2 L108.9 177.8 Z', check: [65.9, 171.3] },
  { nuts: 'SI044', key: 'obalno-kraška', sl: 'Obalno-kraška', path: 'M104.8 279.1 L90.2 271.9 L79.6 287.9 L50.4 284.2 L34.2 279.7 L38.3 267.9 L48.7 266.3 L54.8 261.7 L52.8 257.6 L52.8 257.0 L54.4 257.0 L66.9 259.1 L72.6 254.5 L76.6 247.7 L50.8 222.0 L35.7 215.8 L35.7 213.7 L46.3 213.3 L51.8 205.0 L68.5 210.6 L75.5 211.7 L77.5 215.2 L89.6 224.0 L95.7 225.1 L103.2 233.9 L101.7 250.4 L103.2 252.9 L105.8 279.1 L104.8 279.1 Z', check: [69.8, 247.7] },
] as const;

export const SLOVENIA_OUTLINE_PATH = 'M409.0 38.3 L408.5 41.8 L412.0 50.2 L411.6 54.7 L426.6 68.6 L431.7 81.5 L439.3 86.1 L405.5 73.3 L401.5 76.8 L392.9 81.5 L391.8 83.6 L395.4 94.5 L399.9 105.1 L387.3 104.2 L367.2 102.0 L366.6 102.6 L368.1 110.4 L363.5 113.5 L355.5 119.1 L347.4 122.2 L341.9 124.2 L341.3 125.3 L330.8 128.3 L328.3 135.0 L315.1 134.5 L310.1 142.2 L309.1 161.8 L321.2 167.9 L319.7 183.4 L313.6 208.6 L296.9 209.2 L288.9 212.1 L278.8 218.9 L269.2 224.6 L267.2 225.1 L259.7 231.7 L268.7 243.0 L266.3 250.4 L264.7 259.1 L272.7 279.7 L255.1 290.0 L232.4 277.0 L219.3 273.5 L203.7 281.7 L196.0 275.4 L183.0 260.1 L170.9 250.4 L166.9 242.0 L157.7 260.1 L138.1 278.5 L105.8 279.1 L104.8 279.1 L90.2 271.9 L79.6 287.9 L50.4 284.2 L34.2 279.7 L38.3 267.9 L48.7 266.3 L54.8 261.7 L52.8 257.6 L52.8 257.0 L54.4 257.0 L66.9 259.1 L72.6 254.5 L76.6 247.7 L50.8 222.0 L35.7 215.8 L35.7 213.7 L37.7 197.4 L41.2 190.6 L39.2 181.3 L25.1 182.8 L22.5 168.4 L27.1 165.3 L44.7 145.3 L40.7 141.3 L17.5 135.0 L10.0 120.1 L47.8 93.3 L51.8 76.8 L91.1 85.1 L103.2 85.5 L110.9 93.9 L121.9 94.5 L148.7 92.3 L149.6 96.4 L160.3 98.0 L165.8 106.1 L181.0 91.4 L200.1 79.5 L200.1 77.4 L201.2 75.8 L200.6 74.9 L201.7 73.9 L200.6 72.7 L201.2 72.3 L209.2 59.9 L214.2 60.5 L233.4 51.7 L235.5 53.3 L246.1 51.2 L269.8 51.7 L278.8 51.7 L294.5 57.8 L297.5 56.2 L300.6 47.5 L308.6 46.5 L325.7 43.0 L330.3 41.5 L340.9 38.7 L353.4 45.0 L363.5 50.6 L364.1 51.2 L364.6 44.4 L357.5 28.1 L358.6 16.2 L367.2 15.6 L374.2 10.0 L377.3 12.5 L382.8 12.1 L398.9 10.6 L405.9 16.6 L404.4 22.4 L401.5 23.8 L400.9 27.5 L409.0 38.3 Z';

export type SloveniaMapLanguage = 'sl' | 'en';
export type SloveniaMapVariant = 'full' | 'compact';

const escapeHtml = (value: string | number) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
const REGION_KEY_ALIASES: Record<string, string> = { jugovzhodna: 'jugovzhodna slovenija' };
const regionKey = (value: string) => {
  const normalized = normalizeRegionKey(value);
  return REGION_KEY_ALIASES[normalized] ?? normalized;
};

export const getSloveniaMapRegions = (progress: SeasonRegionProgress[], language: SloveniaMapLanguage) => {
  const byKey = new Map(progress.map((region) => [regionKey(region.key || region.label), region]));
  return SLOVENIA_STATISTICAL_REGIONS.map((geometry) => {
    const region = byKey.get(geometry.key) ?? { key: geometry.key, label: geometry.sl, visited: false, completedEventCount: 0 };
    const canonicalLabel = geometry.key === 'jugovzhodna slovenija' ? 'Jugovzhodna' : geometry.sl;
    return { ...geometry, ...region, label: language === 'en' ? formatSeasonRegionLabel(canonicalLabel, language) : geometry.sl };
  });
};

export const renderSloveniaRegionsMap = (progress: SeasonRegionProgress[], language: SloveniaMapLanguage, variant: SloveniaMapVariant = 'full') => {
  const regions = getSloveniaMapRegions(progress, language);
  const visited = regions.filter((region) => region.visited).length;
  const title = language === 'en' ? 'My running Slovenia' : 'Moja tekaška Slovenija';
  const description = language === 'en'
    ? `${visited} of 12 statistical regions visited. Visited regions are highlighted and marked with a check.`
    : `Obiskanih je ${visited} od 12 statističnih regij. Obiskane regije so poudarjene in označene s kljukico.`;
  const regionMarkup = regions.map((region) => {
    const state = language === 'en' ? (region.visited ? 'visited' : 'not visited') : (region.visited ? 'obiskana' : 'še ni obiskana');
    const races = region.completedEventCount > 0
      ? (language === 'en' ? `${region.completedEventCount} completed ${region.completedEventCount === 1 ? 'race' : 'races'}` : `${region.completedEventCount} ${region.completedEventCount === 1 ? 'opravljen tek' : region.completedEventCount === 2 ? 'opravljena teka' : region.completedEventCount < 5 ? 'opravljeni teki' : 'opravljenih tekov'}`)
      : (language === 'en' ? 'no completed races' : 'brez opravljenih tekov');
    const aria = `${region.label}: ${state}, ${races}.`;
    return `<g class="slovenia-map-region${region.visited ? ' is-visited' : ''}" aria-label="${escapeHtml(aria)}" data-region-key="${escapeHtml(region.key)}" data-visited="${region.visited}"><path d="${region.path}" vector-effect="non-scaling-stroke"></path>${region.visited ? `<g class="slovenia-map-check" aria-hidden="true" transform="translate(${region.check[0]} ${region.check[1]})"><circle r="9"></circle><path d="M-4 0 -1 4 5 -4"></path></g>` : ''}</g>`;
  }).join('');
  return `<figure class="slovenia-map slovenia-map--${variant}" data-slovenia-map><svg viewBox="0 0 450 300" role="img" aria-labelledby="slovenia-map-title-${variant} slovenia-map-description-${variant}" xmlns="http://www.w3.org/2000/svg"><title id="slovenia-map-title-${variant}">${title}</title><desc id="slovenia-map-description-${variant}">${description}</desc><path class="slovenia-map-outline" d="${SLOVENIA_OUTLINE_PATH}" vector-effect="non-scaling-stroke" aria-hidden="true"></path><g>${regionMarkup}</g></svg>${variant === 'full' ? `<figcaption class="sr-only">${description}</figcaption>` : ''}</figure>`;
};
