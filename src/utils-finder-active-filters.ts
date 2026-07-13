import { FINDER_QUICK_ORDER, sanitizeFinderUrlState, type FinderUrlState } from './utils-finder-url-state.js';

export type FinderLanguage = 'sl' | 'en';
export const ACTIVE_FILTER_KINDS = ['q', 'month', 'region', 'surface', 'distance', 'fee', 'deadline', 'family', 'raceDay', 'route', 'elevation', 'sort', 'quick'] as const;
export type ActiveFilterKind = typeof ACTIVE_FILTER_KINDS[number];
export const isActiveFilterKind = (value: string): value is ActiveFilterKind => (ACTIVE_FILTER_KINDS as readonly string[]).includes(value);

export interface ActiveFilterChip {
  kind: ActiveFilterKind;
  value: string;
  label: string;
  ariaLabel: string;
}

export type ActiveFilterLabelLookup = Partial<Record<Exclude<ActiveFilterKind, 'q' | 'family' | 'raceDay' | 'route' | 'quick'>, Record<string, string>>>;

const SEARCH_LABELS = { sl: 'Iskanje', en: 'Search' } as const;
const REMOVE_LABELS = { sl: 'Odstranite filter', en: 'Remove filter' } as const;
const BOOLEAN_LABELS = {
  sl: { family: 'Družinam prijazno', raceDay: 'Prijava na dan dogodka', route: 'Ima traso / zemljevid' },
  en: { family: 'Family-friendly', raceDay: 'Race-day registration', route: 'Has route / map' }
} as const;
const KIND_LABELS = {
  sl: { q: 'Iskanje', month: 'Mesec', region: 'Regija', surface: 'Podlaga', distance: 'Razdalja', fee: 'Startnina', deadline: 'Rok prijave', family: 'Družinam prijazno', raceDay: 'Prijava na dan dogodka', route: 'Trasa', elevation: 'Višinski metri', sort: 'Razvrščanje', quick: 'Hitri izbor' },
  en: { q: 'Search', month: 'Month', region: 'Region', surface: 'Surface', distance: 'Distance', fee: 'Entry fee', deadline: 'Registration deadline', family: 'Family-friendly', raceDay: 'Race-day registration', route: 'Route', elevation: 'Elevation gain', sort: 'Sort', quick: 'Quick pick' }
} as const;
const QUICK_LABELS = {
  sl: { 'deadlines-soon': 'Roki se iztekajo', budget: 'Poceni teki', 'first-race': 'Za prvi tek', trail: 'Trail izzivi', kids: 'Z otroki', route: 'S traso' },
  en: { 'deadlines-soon': 'Deadlines soon', budget: 'Budget-friendly', 'first-race': 'First race', trail: 'Trail challenges', kids: 'With kids', route: 'With route' }
} as const;
const MONTH_LABELS = {
  sl: ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
} as const;

const fallbackLabel = (language: FinderLanguage, kind: ActiveFilterKind, value: string, lookup: ActiveFilterLabelLookup) => {
  if (lookup[kind as keyof ActiveFilterLabelLookup]?.[value]) return lookup[kind as keyof ActiveFilterLabelLookup]?.[value] ?? value;
  if (kind === 'month') return MONTH_LABELS[language][Number(value) - 1] ?? value;
  if (kind === 'quick') return QUICK_LABELS[language][value as keyof typeof QUICK_LABELS.sl] ?? value;
  return value;
};

const chip = (language: FinderLanguage, kind: ActiveFilterKind, value: string, label: string): ActiveFilterChip => ({
  kind,
  value,
  label,
  ariaLabel: `${REMOVE_LABELS[language]} ${KIND_LABELS[language][kind]}: ${label}`
});

export const getActiveFinderFilters = (input: Partial<FinderUrlState>, language: FinderLanguage, lookup: ActiveFilterLabelLookup = {}): ActiveFilterChip[] => {
  const state = sanitizeFinderUrlState(input);
  const chips: ActiveFilterChip[] = [];
  if (state.q) chips.push(chip(language, 'q', state.q, `${SEARCH_LABELS[language]}: ${state.q}`));
  for (const kind of ['month', 'region', 'surface', 'distance', 'fee', 'deadline'] as const) {
    const value = state[kind];
    if (value && !(kind === 'distance' && value === 'all')) chips.push(chip(language, kind, value, fallbackLabel(language, kind, value, lookup)));
  }
  if (state.family) chips.push(chip(language, 'family', '1', BOOLEAN_LABELS[language].family));
  if (state.raceDay) chips.push(chip(language, 'raceDay', '1', BOOLEAN_LABELS[language].raceDay));
  if (state.route) chips.push(chip(language, 'route', '1', BOOLEAN_LABELS[language].route));
  if (state.elevation) chips.push(chip(language, 'elevation', state.elevation, fallbackLabel(language, 'elevation', state.elevation, lookup)));
  if (state.sort && state.sort !== 'date') chips.push(chip(language, 'sort', state.sort, fallbackLabel(language, 'sort', state.sort, lookup)));
  for (const quick of FINDER_QUICK_ORDER) if (state.quick.includes(quick)) chips.push(chip(language, 'quick', quick, fallbackLabel(language, 'quick', quick, lookup)));
  return chips;
};

export const removeActiveFinderFilter = (input: Partial<FinderUrlState>, kind: ActiveFilterKind, value = ''): FinderUrlState => {
  const state = sanitizeFinderUrlState(input);
  if (kind === 'q') state.q = '';
  else if (kind === 'distance') state.distance = 'all';
  else if (kind === 'family' || kind === 'raceDay' || kind === 'route') state[kind] = false;
  else if (kind === 'sort') state.sort = 'date';
  else if (kind === 'quick') state.quick = state.quick.filter((quick) => quick !== value);
  else state[kind] = '';
  return sanitizeFinderUrlState(state);
};

export const formatActiveFinderFilterCount = (count: number, language: FinderLanguage) => {
  if (language === 'en') return `${count} ${count === 1 ? 'filter' : 'filters'}`;
  if (count === 1) return '1 filter';
  if (count === 2) return '2 filtra';
  if (count === 3 || count === 4) return `${count} filtri`;
  return `${count} filtrov`;
};
