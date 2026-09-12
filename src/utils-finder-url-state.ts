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
export const FINDER_RETURN_PARAM = 'from';
const QUICK = new Set<string>(FINDER_QUICK_ORDER);
const PARAM_ORDER = ['year', 'q', 'month', 'region', 'surface', 'distance', 'fee', 'deadline', 'sort', 'family', 'raceDay', 'route', 'elevation', 'quick'] as const;
const FINDER_PATHS = { sl: '/iskalnik-tekov/', en: '/en/find-races/' } as const;

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

export const buildFinderReturnUrl = (
  pathname: string,
  state: Partial<FinderUrlState>
): string => buildFinderUrl(pathname, state);

export const buildDetailUrlWithFinderReturn = (
  detailPath: string,
  finderPath: string,
  state: Partial<FinderUrlState>,
  origin = 'https://tekaski-koledar.si'
): string => {
  const detailUrl = new URL(detailPath, origin);
  detailUrl.searchParams.set(FINDER_RETURN_PARAM, buildFinderReturnUrl(finderPath, state));
  return `${detailUrl.pathname}${detailUrl.search}${detailUrl.hash}`;
};

export type ResolvedFinderReturn = {
  href: string;
  hasContext: boolean;
  state: FinderUrlState;
};

export const resolveFinderReturnUrl = (
  params: URLSearchParams,
  language: 'sl' | 'en',
  detailYear: PublicFinderYear,
  origin = 'https://tekaski-koledar.si'
): ResolvedFinderReturn => {
  const pathname = FINDER_PATHS[language];
  const fallbackState = sanitizeFinderUrlState({ year: detailYear });
  const fallback: ResolvedFinderReturn = {
    href: buildFinderUrl(pathname, fallbackState),
    hasContext: false,
    state: fallbackState
  };
  const rawReturn = params.get(FINDER_RETURN_PARAM);
  if (!rawReturn || !rawReturn.startsWith('/') || rawReturn.startsWith('//')) return fallback;

  try {
    const candidate = new URL(rawReturn, origin);
    if (candidate.origin !== origin || candidate.pathname !== pathname) return fallback;
    const state = parseFinderUrlState(candidate.searchParams);
    if (state.year !== detailYear) return fallback;
    return {
      href: buildFinderUrl(pathname, state),
      hasContext: true,
      state
    };
  } catch {
    return fallback;
  }
};

export const initializeFinderReturnLinks = () => {
  const root = document.querySelector<HTMLElement>('[data-finder-return-root]');
  const language = root?.dataset.finderReturnLanguage === 'en' ? 'en' : 'sl';
  const detailYear = root?.dataset.finderReturnYear === '2027' ? '2027' : '2026';
  const resolved = resolveFinderReturnUrl(new URLSearchParams(window.location.search), language, detailYear, window.location.origin);

  document.querySelectorAll<HTMLAnchorElement>('[data-finder-return-link]').forEach((link) => {
    link.href = resolved.href;
    if (resolved.hasContext && link.dataset.finderReturnContextLabel) {
      link.textContent = link.dataset.finderReturnContextLabel;
    }
  });

  if (!resolved.hasContext) return;
  const targetLanguage = language === 'en' ? 'sl' : 'en';
  const targetDetailPath = root?.dataset.finderLanguageDetailPath;
  if (!targetDetailPath) return;
  const targetFinderPath = FINDER_PATHS[targetLanguage];
  const targetFinderReturn = buildFinderUrl(targetFinderPath, resolved.state);
  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
    const target = new URL(link.href, window.location.origin);
    if (target.origin !== window.location.origin || target.pathname !== targetDetailPath) return;
    target.searchParams.set(FINDER_RETURN_PARAM, targetFinderReturn);
    link.href = `${target.pathname}${target.search}${target.hash}`;
  });
};
