import { asRecord, mapPublicRaceEvent, pickString, toApiRecords, type PublicRaceEvent } from './utils-event-detail.js';
import { selectHomepageSpotlightRace, selectUpcomingHomepageEvents } from './utils-home-events.js';
import { getTodayIsoInLjubljana } from './utils-date.js';

export type SpotlightSelection = { race: PublicRaceEvent; mode: 'automatic' | 'editorial' | 'partner' };
export type SpotlightSource = { year: string; payload: unknown };
export const SPOTLIGHT_API_URL = 'https://stk-master-api.igor-kalsek.workers.dev/?spotlight=1';

const isoDay = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
};

/** Fresh raw Master rows are authoritative; a control response alone cannot promote a race. */
export const resolveHomepageSpotlight = (
  sources: SpotlightSource[], control: unknown, todayIso: string
): SpotlightSelection | null => {
  if (!isoDay(todayIso)) return null;
  const available = sources.filter(({ payload }) => {
    const root = asRecord(payload);
    return root && root.ok !== false && Array.isArray(root.data);
  });
  const todayValue = new Date(todayIso + 'T00:00:00').getTime();
  const mapped = available.map(({ year, payload }) => ({ year, events: toApiRecords(payload)
    .map(row => mapPublicRaceEvent(row, year, todayValue)).filter((race): race is PublicRaceEvent => Boolean(race)) }));
  const root = asRecord(control);
  const config = asRecord(root?.selection);
  if (root?.ok === true && root.type === 'homepage_spotlight' && root.version === 1 && config &&
      (config.year === '2026' || config.year === '2027') && typeof config.master_row === 'string' &&
      /^[1-9]\d*$/.test(config.master_row) && Number(config.master_row) >= 2 &&
      isoDay(config.expected_event_date) && config.expected_event_date.startsWith(config.year + '-') &&
      typeof config.expected_event_name === 'string' && config.expected_event_name.trim() !== '' &&
      isoDay(config.start_date) && isoDay(config.end_date) && config.start_date <= config.end_date &&
      todayIso >= config.start_date && todayIso <= config.end_date && todayIso <= config.expected_event_date &&
      (config.selection_type === 'editorial' || config.selection_type === 'partner')) {
    const matches = available.filter(source => source.year === config.year)
      .flatMap(source => toApiRecords(source.payload)).filter(row => pickString(row, 'row') === config.master_row);
    if (matches.length === 1 && pickString(matches[0], 'datum') === config.expected_event_date &&
        pickString(matches[0], 'naziv_prireditve') === config.expected_event_name) {
      const race = mapPublicRaceEvent(matches[0], config.year, todayValue);
      if (race) return { race, mode: config.selection_type };
    }
  }
  // Original weekly selector and nearest-four scope are deliberately unchanged.
  const nearest = selectUpcomingHomepageEvents(mapped.find(source => source.year === '2026')?.events ?? []);
  const race = selectHomepageSpotlightRace(mapped.flatMap(source => source.events), nearest, todayIso);
  return race ? { race, mode: 'automatic' } : null;
};

export const spotlightLabel = (mode: SpotlightSelection['mode'], en: boolean) => mode === 'partner'
  ? (en ? 'PARTNER PROMOTION' : 'PARTNERSKA PROMOCIJA')
  : (en ? 'STK EDITORIAL PICK' : 'UREDNIŠKI IZBOR STK');

/** Bound pending shared reads without retaining their eventual response for promotion. */
export const spotlightRead = async <T>(request: Promise<T>, timeoutMs = 10_000): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([request, new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Spotlight read timed out')), timeoutMs);
    })]);
  } finally { clearTimeout(timeout); }
};

export const fetchSpotlightControl = async (): Promise<unknown> => {
  const response = await fetch(SPOTLIGHT_API_URL, {
    cache: 'no-store', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error('Spotlight control unavailable');
  return response.json();
};

/** Find the next local day boundary, including DST, independently of the visitor's timezone. */
export const millisecondsToNextLjubljanaDay = (now = new Date()) => {
  const today = getTodayIsoInLjubljana(now);
  let low = now.getTime();
  let high = low + 36 * 60 * 60 * 1000;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (getTodayIsoInLjubljana(new Date(mid)) === today) low = mid;
    else high = mid;
  }
  return high - now.getTime();
};
