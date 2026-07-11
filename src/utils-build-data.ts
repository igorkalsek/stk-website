import { attachAdditionalDataByMasterRow, fetchAdditionalEventData, type AdditionalEventData } from './utils-additional.js';
import { buildEventDetailSlug, mapPublicRaceEvent, toApiRecords, type PublicRaceEvent } from './utils-event-detail.js';
import { buildMasterApiPath, SUPPORTED_PUBLIC_YEARS, type PublicYear } from './utils-public-year.js';
import { getTodayIsoInLjubljana } from './utils-date.js';
import { buildRelatedRaceCards, buildRelatedRaces, type RelatedRaceCard } from './utils-related-races.js';
import { enrichEventsWithVoteUrls } from './utils-vote.js';

type Language = 'sl' | 'en';
type FetchLike = typeof fetch;

type YearData = {
  year: PublicYear;
  events: PublicRaceEvent[];
  slPaths: DetailPath[];
  enPaths: DetailPath[];
  relatedPrepMs: number;
};

type DetailPath = {
  params: { year: PublicYear; slug: string };
  props: { event: PublicRaceEvent; year: PublicYear; relatedRaces: RelatedRaceCard[] };
};

type TimedFetchJsonOptions = {
  label: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
};

type BuildStats = {
  masterRequests: number;
  masterDurations: Partial<Record<PublicYear, number>>;
  topRequests: number;
  topDurationMs: number;
  additionalRequests: number;
  additionalDurationMs: number;
  processedEvents: Partial<Record<PublicYear, number>>;
  detailPaths: Record<Language, Partial<Record<PublicYear, number>>>;
  relatedPrepMs: Partial<Record<PublicYear, number>>;
  keyPrepMs: number;
};

const API_BASE = 'https://stk-master-api.igor-kalsek.workers.dev';
const TOP_API_URL = `${API_BASE}/top?scope=upcoming&limit=1000`;
const DEFAULT_TIMEOUT_MS = 15_000;
const timingEnabled = () => process.env.STK_BUILD_TIMING === '1';
const now = () => performance.now();

const stats: BuildStats = { masterRequests: 0, masterDurations: {}, topRequests: 0, topDurationMs: 0, additionalRequests: 0, additionalDurationMs: 0, processedEvents: {}, detailPaths: { sl: {}, en: {} }, relatedPrepMs: {}, keyPrepMs: 0 };
const masterPayloadCache = new Map<PublicYear, Promise<unknown>>();
const yearDataCache = new Map<PublicYear, Promise<YearData>>();
let additionalDataPromise: Promise<AdditionalEventData[]> | null = null;
let topRowsPromise: Promise<Record<string, unknown>[]> | null = null;
let timingPrinted = false;

export const timedFetchJson = async <T = unknown>(url: string, { label, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch }: TimedFetchJsonOptions): Promise<T> => {
  const started = now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    const duration = now() - started;
    if (!response.ok) throw new Error(`${label} status ${response.status} after ${Math.round(duration)}ms`);
    return await response.json() as T;
  } catch (error) {
    const duration = now() - started;
    console.warn(`[build-data] ${label} failed after ${Math.round(duration)}ms: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchMasterYearPayload = (year: PublicYear, fetchImpl: FetchLike = fetch) => {
  const cached = masterPayloadCache.get(year);
  if (cached) return cached;
  const request = (async () => {
    stats.masterRequests += 1;
    const started = now();
    try {
      return await timedFetchJson(`${API_BASE}${buildMasterApiPath(year)}`, { label: `master ${year}`, fetchImpl });
    } finally {
      stats.masterDurations[year] = now() - started;
    }
  })();
  masterPayloadCache.set(year, request);
  request.catch(() => masterPayloadCache.delete(year));
  return request;
};

const buildYearData = async (year: PublicYear): Promise<YearData> => {
  const started = now();
  const todayIso = getTodayIsoInLjubljana();
  const today = new Date(`${todayIso}T00:00:00`).getTime();
  const events = toApiRecords(await fetchMasterYearPayload(year))
    .map((item) => mapPublicRaceEvent(item, year, today))
    .filter((event): event is PublicRaceEvent => Boolean(event))
    .sort((a, b) => a.dateValue - b.dateValue || a.title.localeCompare(b.title, 'sl-SI'));

  const relatedStarted = now();
  const relatedBySlug = new Map<string, ReturnType<typeof buildRelatedRaces>>();
  for (const event of events) relatedBySlug.set(buildEventDetailSlug(event), buildRelatedRaces({ currentEvent: event, candidates: events, todayIso, limit: 3 }));
  const relatedPrepMs = now() - relatedStarted;

  const toPath = (event: PublicRaceEvent, language: Language): DetailPath => ({
    params: { year, slug: buildEventDetailSlug(event) },
    props: { event, year, relatedRaces: buildRelatedRaceCards(relatedBySlug.get(buildEventDetailSlug(event)) ?? [], language) }
  });
  const slPaths = events.map((event) => toPath(event, 'sl'));
  const enPaths = events.map((event) => toPath(event, 'en'));

  stats.processedEvents[year] = events.length;
  stats.detailPaths.sl[year] = slPaths.length;
  stats.detailPaths.en[year] = enPaths.length;
  stats.relatedPrepMs[year] = relatedPrepMs;
  stats.keyPrepMs += now() - started;
  return { year, events, slPaths, enPaths, relatedPrepMs };
};

export const getPublicYearData = (year: PublicYear) => {
  const cached = yearDataCache.get(year);
  if (cached) return cached;
  const request = buildYearData(year);
  yearDataCache.set(year, request);
  request.catch(() => yearDataCache.delete(year));
  return request;
};

export const getDetailStaticPaths = async (language: Language) => {
  const data = await Promise.all(SUPPORTED_PUBLIC_YEARS.map((year) => getPublicYearData(year).catch((error) => {
    console.warn(`[build-data] detail paths skipped ${year}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  })));
  if (data.every((item) => !item)) maybePrintBuildTiming();
  return data.flatMap((item) => item ? (language === 'en' ? item.enPaths : item.slPaths) : []);
};

export const getAdditionalEventDataCached = () => {
  if (additionalDataPromise) return additionalDataPromise;
  stats.additionalRequests += 1;
  const started = now();
  additionalDataPromise = fetchAdditionalEventData().finally(() => {
    stats.additionalDurationMs = now() - started;
  });
  additionalDataPromise.catch(() => { additionalDataPromise = null; });
  return additionalDataPromise;
};

export const getTopVoteRowsCached = () => {
  if (topRowsPromise) return topRowsPromise;
  stats.topRequests += 1;
  const started = now();
  topRowsPromise = timedFetchJson(TOP_API_URL, { label: 'top votes' })
    .then(toApiRecords)
    .finally(() => {
      stats.topDurationMs = now() - started;
    });
  topRowsPromise.catch(() => { topRowsPromise = null; });
  return topRowsPromise;
};

export const attachAdditionalDataCached = async <T extends Parameters<typeof attachAdditionalDataByMasterRow>[0][number]>(events: T[]) =>
  attachAdditionalDataByMasterRow(events, await getAdditionalEventDataCached());

export const enrichEventsWithVoteUrlsCached = async <T extends Parameters<typeof enrichEventsWithVoteUrls>[0][number]>(events: T[]) =>
  enrichEventsWithVoteUrls(events, await getTopVoteRowsCached());

export const maybePrintBuildTiming = () => {
  if (!timingEnabled() || timingPrinted) return;
  timingPrinted = true;
  console.info(`[build-timing] master_requests=${stats.masterRequests}`);
  console.info(`[build-timing] master_durations_ms=${JSON.stringify(Object.fromEntries(Object.entries(stats.masterDurations).map(([year, ms]) => [year, Math.round(ms ?? 0)])))}`);
  console.info(`[build-timing] top_requests=${stats.topRequests}`);
  console.info(`[build-timing] top_duration_ms=${Math.round(stats.topDurationMs)}`);
  console.info(`[build-timing] additional_requests=${stats.additionalRequests}`);
  console.info(`[build-timing] additional_duration_ms=${Math.round(stats.additionalDurationMs)}`);
  console.info(`[build-timing] processed_events=${JSON.stringify(stats.processedEvents)}`);
  console.info(`[build-timing] detail_paths=${JSON.stringify(stats.detailPaths)}`);
  console.info(`[build-timing] related_prep_ms=${JSON.stringify(Object.fromEntries(Object.entries(stats.relatedPrepMs).map(([year, ms]) => [year, Math.round(ms ?? 0)])))}`);
  console.info(`[build-timing] key_prep_ms=${Math.round(stats.keyPrepMs)}`);
};

export const __resetBuildDataCachesForTests = () => {
  masterPayloadCache.clear();
  yearDataCache.clear();
  additionalDataPromise = null;
  topRowsPromise = null;
  timingPrinted = false;
  stats.masterRequests = 0;
  stats.masterDurations = {};
  stats.topRequests = 0;
  stats.topDurationMs = 0;
  stats.additionalRequests = 0;
  stats.additionalDurationMs = 0;
  stats.processedEvents = {};
  stats.detailPaths = { sl: {}, en: {} };
  stats.relatedPrepMs = {};
  stats.keyPrepMs = 0;
};
