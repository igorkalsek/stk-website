import { formatSeasonRegionLabel, normalizeRegionKey, type SeasonRegionProgress } from './utils-my-season.js';

/**
 * Simplified regional geometry adapted from the Statistical Office of the Republic
 * of Slovenia's statistical-regions map (CC BY 4.0).
 * Source: https://www.stat.si/obcine/en/Theme/Index/Regions
 * Licence: https://creativecommons.org/licenses/by/4.0/
 * Paths are deliberately simplified for a small, accessible progress visual and
 * must not be used as precise administrative boundaries.
 */
export const SLOVENIA_STATISTICAL_REGIONS = [
  { key: 'gorenjska', sl: 'Gorenjska', path: 'M118 63 154 46 190 54 207 83 194 111 161 123 128 104 105 82Z', check: [157, 83] },
  { key: 'goriska', sl: 'Goriška', path: 'M70 99 105 82 128 104 121 143 96 169 63 154 48 126Z', check: [91, 126] },
  { key: 'obalno-kraska', sl: 'Obalno-kraška', path: 'M63 154 96 169 126 190 104 211 74 207 48 224 25 211 51 184Z', check: [73, 189] },
  { key: 'primorsko-notranjska', sl: 'Primorsko-notranjska', path: 'M96 169 121 143 159 146 177 175 160 203 126 190Z', check: [137, 171] },
  { key: 'osrednjeslovenska', sl: 'Osrednjeslovenska', path: 'M128 104 161 123 198 114 222 137 213 174 177 175 159 146 121 143Z', check: [174, 142] },
  { key: 'jugovzhodna slovenija', sl: 'Jugovzhodna Slovenija', path: 'M177 175 213 174 242 157 273 176 291 207 266 231 228 221 198 235 160 203Z', check: [224, 197] },
  { key: 'zasavska', sl: 'Zasavska', path: 'M198 114 228 105 249 121 242 157 213 174 222 137Z', check: [228, 137] },
  { key: 'posavska', sl: 'Posavska', path: 'M242 157 278 141 313 154 330 183 291 207 273 176Z', check: [287, 170] },
  { key: 'savinjska', sl: 'Savinjska', path: 'M194 111 207 83 246 73 282 91 290 120 278 141 242 157 249 121 228 105Z', check: [257, 107] },
  { key: 'koroska', sl: 'Koroška', path: 'M190 54 222 35 257 42 274 65 246 73 207 83Z', check: [232, 58] },
  { key: 'podravska', sl: 'Podravska', path: 'M257 42 296 34 333 49 354 76 343 106 315 118 290 120 282 91 274 65Z', check: [315, 74] },
  { key: 'pomurska', sl: 'Pomurska', path: 'M333 49 361 31 397 36 421 57 405 80 372 88 354 76Z', check: [379, 57] }
] as const;

export type SloveniaMapLanguage = 'sl' | 'en';
export type SloveniaMapVariant = 'full' | 'compact';

const escapeHtml = (value: string | number) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
const regionKey = (value: string) => normalizeRegionKey(value).replace(/ška$/u, 'ska').replace(/ška /gu, 'ska ').replace(/ško-/gu, 'sko-');

export const getSloveniaMapRegions = (progress: SeasonRegionProgress[], language: SloveniaMapLanguage) => {
  const byKey = new Map(progress.map((region) => [regionKey(region.key || region.label), region]));
  return SLOVENIA_STATISTICAL_REGIONS.map((geometry) => {
    const region = byKey.get(geometry.key) ?? { key: geometry.key, label: geometry.sl, visited: false, completedEventCount: 0 };
    return { ...geometry, ...region, label: formatSeasonRegionLabel(geometry.sl, language) };
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
    return `<g class="slovenia-map-region${region.visited ? ' is-visited' : ''}" role="listitem" tabindex="0" aria-label="${escapeHtml(aria)}" data-region-key="${escapeHtml(region.key)}" data-visited="${region.visited}"><path d="${region.path}" vector-effect="non-scaling-stroke"></path>${region.visited ? `<g class="slovenia-map-check" aria-hidden="true" transform="translate(${region.check[0]} ${region.check[1]})"><circle r="9"></circle><path d="M-4 0 -1 4 5 -4"></path></g>` : ''}</g>`;
  }).join('');
  return `<figure class="slovenia-map slovenia-map--${variant}" data-slovenia-map><svg viewBox="14 20 418 225" role="img" aria-labelledby="slovenia-map-title-${variant} slovenia-map-description-${variant}" xmlns="http://www.w3.org/2000/svg"><title id="slovenia-map-title-${variant}">${title}</title><desc id="slovenia-map-description-${variant}">${description}</desc><g role="list">${regionMarkup}</g></svg>${variant === 'full' ? `<figcaption class="sr-only">${description}</figcaption>` : ''}</figure>`;
};
