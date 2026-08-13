export type PublicFinderYear = '2026' | '2027';
export type FinderSort = 'date' | 'registration-deadline' | 'registration-min' | 'registration-max';

export interface FinderUrlState {
  year: PublicFinderYear;
  q: string;
  month: string;
  region: string;
  surface: string;
  distance: string;
  fee: string;
  deadline: string;
  sort: FinderSort | 'date';
  family: boolean;
  raceDay: boolean;
  route: boolean;
  elevation: string;
  quick: string[];
}

export const DEFAULT_FINDER_YEAR: PublicFinderYear = '2026';
const MONTHS = new Set(Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')));
const DISTANCES = new Set(['all', 'up-to-5', 'over-5-to-10', 'over-10-to-half', 'over-half-to-marathon', 'ultra']);
const FEES = new Set(['free-option', '10', '20', '30', '50']);
const DEADLINES = new Set(['within-7', 'within-14', 'within-30', 'early-ending', 'race-day']);
const SORTS = new Set(['date', 'registration-deadline', 'registration-min', 'registration-max']);
const ELEVATIONS = new Set(['max-300', 'max-800', 'max-1500', 'over-1500']);
export const FINDER_QUICK_ORDER = ['deadlines-soon', 'budget', 'first-race', 'trail', 'kids', 'route'] as const;
const QUICK = new Set<string>(FINDER_QUICK_ORDER);
const PARAM_ORDER = ['year', 'q', 'month', 'region', 'surface', 'distance', 'fee', 'deadline', 'sort', 'family', 'raceDay', 'route', 'elevation', 'quick'] as const;

export const defaultFinderUrlState = (): FinderUrlState => ({
  year: DEFAULT_FINDER_YEAR,
  q: '',
  month: '',
  region: '',
  surface: '',
  distance: 'all',
  fee: '',
  deadline: '',
  sort: 'date',
  family: false,
  raceDay: false,
  route: false,
  elevation: '',
  quick: []
});

const first = (params: URLSearchParams, key: string) => params.get(key) ?? '';
const cleanText = (value: string) => value.trim().slice(0, 120);
const oneOf = (value: string, values: Set<string>, fallback = '') => values.has(value) ? value : fallback;
const boolParam = (params: URLSearchParams, key: string) => params.get(key) === '1';

export const normalizeQuickPicks = (values: readonly string[] | string): string[] => {
  const parts = typeof values === 'string' ? values.split(',') : values;
  const selected = new Set(parts.map((value) => value.trim()).filter((value) => QUICK.has(value)));
  return FINDER_QUICK_ORDER.filter((value) => selected.has(value));
};

export const parseFinderUrlState = (params: URLSearchParams): FinderUrlState => ({
  year: first(params, 'year') === '2027' ? '2027' : '2026',
  q: cleanText(first(params, 'q')),
  month: oneOf(first(params, 'month'), MONTHS),
  region: cleanText(first(params, 'region')),
  surface: cleanText(first(params, 'surface')),
  distance: oneOf(first(params, 'distance'), DISTANCES, 'all'),
  fee: oneOf(first(params, 'fee'), FEES),
  deadline: oneOf(first(params, 'deadline'), DEADLINES),
  sort: oneOf(first(params, 'sort'), SORTS, 'date') as FinderSort,
  family: boolParam(params, 'family'),
  raceDay: boolParam(params, 'raceDay'),
  route: boolParam(params, 'route'),
  elevation: oneOf(first(params, 'elevation'), ELEVATIONS),
  quick: normalizeQuickPicks(first(params, 'quick'))
});

export const sanitizeFinderUrlState = (state: Partial<FinderUrlState>): FinderUrlState => {
  const base = { ...defaultFinderUrlState(), ...state };
  return {
    year: base.year === '2027' ? '2027' : '2026',
    q: cleanText(base.q ?? ''),
    month: oneOf(base.month ?? '', MONTHS),
    region: cleanText(base.region ?? ''),
    surface: cleanText(base.surface ?? ''),
    distance: oneOf(base.distance ?? 'all', DISTANCES, 'all'),
    fee: oneOf(base.fee ?? '', FEES),
    deadline: oneOf(base.deadline ?? '', DEADLINES),
    sort: oneOf(base.sort ?? 'date', SORTS, 'date') as FinderSort,
    family: Boolean(base.family),
    raceDay: Boolean(base.raceDay),
    route: Boolean(base.route),
    elevation: oneOf(base.elevation ?? '', ELEVATIONS),
    quick: normalizeQuickPicks(base.quick ?? [])
  };
};

export const stateForYear = (state: Partial<FinderUrlState>, year: PublicFinderYear): FinderUrlState => {
  return sanitizeFinderUrlState({ ...state, year });
};

export const clearFinderUrlState = (year: PublicFinderYear = DEFAULT_FINDER_YEAR): FinderUrlState => ({ ...defaultFinderUrlState(), year });

export const serializeFinderUrlState = (input: Partial<FinderUrlState>): URLSearchParams => {
  const state = sanitizeFinderUrlState(input);
  const values: Record<string, string> = {};
  if (state.year !== '2026') values.year = state.year;
  if (state.q) values.q = state.q;
  if (state.month) values.month = state.month;
  if (state.region) values.region = state.region;
  if (state.surface) values.surface = state.surface;
  if (state.distance && state.distance !== 'all') values.distance = state.distance;
  if (state.fee) values.fee = state.fee;
  if (state.deadline) values.deadline = state.deadline;
  if (state.sort && state.sort !== 'date') values.sort = state.sort;
  if (state.family) values.family = '1';
  if (state.raceDay) values.raceDay = '1';
  if (state.route) values.route = '1';
  if (state.elevation) values.elevation = state.elevation;
  if (state.quick.length) values.quick = state.quick.join(',');
  const params = new URLSearchParams();
  for (const key of PARAM_ORDER) if (values[key]) params.set(key, values[key]);
  return params;
};

export const buildFinderUrl = (pathname: string, state: Partial<FinderUrlState>, origin = 'https://tekaski-koledar.si') => {
  const url = new URL(pathname, origin);
  url.search = serializeFinderUrlState(state).toString();
  return `${url.pathname}${url.search}`;
};

export const buildFinderUrlForYear = (pathname: string, state: Partial<FinderUrlState>, year: PublicFinderYear) =>
  buildFinderUrl(pathname, stateForYear(state, year));

export const buildFinderUrlForLanguage = (state: Partial<FinderUrlState>, language: 'sl' | 'en') =>
  buildFinderUrl(language === 'en' ? '/en/find-races/' : '/iskalnik-tekov/', sanitizeFinderUrlState(state));
