import { buildEnglishEventDetailPath, buildEventDetailPath } from './utils-event-detail.js';
import type { PublicRaceEvent } from './utils-event-detail.js';

export const selectUpcomingHomepageEvents = (events: PublicRaceEvent[], limit = 4) => [...events]
  .sort((a, b) =>
    a.dateValue - b.dateValue ||
    a.place.localeCompare(b.place, 'sl-SI') ||
    a.title.localeCompare(b.title, 'sl-SI')
  )
  .slice(0, limit);

type FeaturedSelectionOptions<T> = {
  todayValue: number;
  cutoffValue: number;
  limit?: number;
  getDateValue: (event: T) => number | null;
  getIdentity: (event: T) => string;
  compareFallback: (a: T, b: T) => number;
};

export const selectFeaturedUpcomingEvents = <T>(
  interestEvents: T[],
  fallbackCandidates: T[],
  options: FeaturedSelectionOptions<T>
) => {
  const limit = Math.max(0, options.limit ?? 3);
  const selectedIdentities = new Set<string>();
  const selected: T[] = [];

  const add = (event: T) => {
    const identity = options.getIdentity(event);
    if (!identity || selectedIdentities.has(identity) || selected.length >= limit) return;
    selectedIdentities.add(identity);
    selected.push(event);
  };

  for (const event of interestEvents) {
    const dateValue = options.getDateValue(event);
    if (dateValue === null || dateValue < options.todayValue || dateValue > options.cutoffValue) continue;
    add(event);
    if (selected.length >= limit) return selected;
  }

  for (const event of [...fallbackCandidates].sort(options.compareFallback)) {
    const dateValue = options.getDateValue(event);
    if (dateValue === null || dateValue < options.todayValue) continue;
    add(event);
    if (selected.length >= limit) break;
  }

  return selected;
};

export const buildHomepageCalendarEventInput = (event: PublicRaceEvent, language: 'sl' | 'en') => ({
  title: event.displayTitle,
  date: event.date,
  location: event.place,
  noticeUrl: event.noticeUrl,
  registrationUrl: event.registrationUrl,
  language
});

export type HomepageApiRecord = Record<string, unknown>;

export const homepageAsRecord = (value: unknown): HomepageApiRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as HomepageApiRecord : null;

export const homepagePickString = (item: HomepageApiRecord, key: string): string => {
  const value = item[key];
  return value === undefined || value === null ? '' : String(value).trim();
};

export const getHomepageEventField = (event: HomepageApiRecord, primary: string, fallbacks: string[] = []) => {
  for (const key of [primary, ...fallbacks]) {
    const value = homepagePickString(event, key);
    if (value) return value;
  }
  return '';
};

export const getHomepageEventYear = (event: HomepageApiRecord) => {
  const explicitYear = getHomepageEventField(event, 'year', ['leto']);
  if (/^202[67]$/.test(explicitYear)) return explicitYear;

  const date = getHomepageEventField(event, 'datum', ['date', 'event_date', 'Datum']);
  return date.match(/^(202[67])-/)?.[1] ?? '';
};

export const getCanonicalHomepageEvent = (event: HomepageApiRecord) =>
  homepageAsRecord(event.__canonical_master_event) ?? homepageAsRecord(event.__master_event) ?? event;


export type RecentUpdateMatch = {
  event: HomepageApiRecord | null;
  reason: string;
};

const rowKeys = ['row', 'master_row', 'masterRow', 'event.row', 'event.master_row', 'event.masterRow'];
const eventIdKeys = ['event_id', 'eventId', 'id', 'event.event_id', 'event.eventId', 'event.id'];

const pickPathValue = (item: HomepageApiRecord, path: string): unknown => {
  let current: unknown = item;
  for (const key of path.split('.')) {
    const record = homepageAsRecord(current);
    if (!record) return undefined;
    current = record[key];
  }
  return current;
};

const pickPathString = (item: HomepageApiRecord, paths: string[]) => {
  for (const path of paths) {
    const value = pickPathValue(item, path);
    const text = value === undefined || value === null ? '' : String(value).trim();
    if (text) return text;
  }
  return '';
};

export type HomepageRecentUpdateGroups = {
  updatedEvents: HomepageApiRecord[];
  newEvents: HomepageApiRecord[];
  confirmedEvents: HomepageApiRecord[];
};

export type HomepageRecentUpdateSelection = {
  canOrderGlobally: boolean;
  items: HomepageApiRecord[];
};

const parseRecentUpdateDateValue = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const dateValue = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(dateValue);
  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
    ? dateValue
    : null;
};

// A row-derived R identifier is scoped to a year; it is not an edition-independent id.
const recentUpdateYear = (item: HomepageApiRecord) => {
  const explicit = pickPathString(item, ['year', 'master_sheet', 'leto', 'event.year', 'event.master_sheet', 'event.leto']);
  const date = pickPathString(item, ['datum', 'event.datum', 'date', 'event_date', 'Datum']);
  const dateYear = date.match(/^(202[67])-/)?.[1] ?? '';
  if (explicit && (!/^202[67]$/.test(explicit) || dateYear && dateYear !== explicit)) return '';
  return explicit || dateYear;
};

const recentUpdateIdentity = (item: HomepageApiRecord) => {
  const year = recentUpdateYear(item);
  const row = pickPathString(item, rowKeys);
  if (year && row) return `row:${year}:${row}`;
  const eventId = normalizeHomepageEventId(pickPathString(item, eventIdKeys));
  if (year && eventId) return `id:${year}:${eventId}`;
  const date = pickPathString(item, ['datum', 'event.datum', 'date', 'event_date', 'Datum']);
  const title = pickPathString(item, ['naziv_prireditve', 'naziv', 'event.naziv_prireditve', 'event.naziv', 'title', 'name']);
  const place = pickPathString(item, ['kraj', 'event.kraj', 'place', 'city', 'location']);
  return naturalKey(date, title, place) ? `natural:${naturalKey(date, title, place)}` : '';
};

export const selectHomepageRecentUpdates = (
  groups: HomepageRecentUpdateGroups,
  limit = 4
): HomepageRecentUpdateSelection => {
  if (limit <= 0) return { canOrderGlobally: true, items: [] };
  const tagged = [
    ...groups.updatedEvents,
    ...groups.newEvents,
    ...groups.confirmedEvents
  ].map((item, sourceIndex) => ({
    item: { ...item, update_type: item.update_type !== undefined ? item.update_type : pickPathValue(item, 'event.update_type') },
    sourceIndex,
    dateValue: parseRecentUpdateDateValue(pickPathString(item, ['recent_update_date', 'event.recent_update_date']))
  }));

  if (tagged.some(({ dateValue }) => dateValue === null)) {
    return { canOrderGlobally: false, items: [] };
  }

  tagged.sort((a, b) =>
    (b.dateValue as number) - (a.dateValue as number) ||
    pickPathString(a.item, ['naziv_prireditve', 'naziv', 'title', 'name'])
      .localeCompare(pickPathString(b.item, ['naziv_prireditve', 'naziv', 'title', 'name']), 'sl-SI') ||
    recentUpdateIdentity(a.item).localeCompare(recentUpdateIdentity(b.item)) ||
    a.sourceIndex - b.sourceIndex
  );

  const identities = new Set<string>();
  const items: HomepageApiRecord[] = [];
  for (const { item, sourceIndex } of tagged) {
    const identity = recentUpdateIdentity(item) || `unidentified:${sourceIndex}`;
    if (identities.has(identity)) continue;
    identities.add(identity);
    items.push(item);
    if (items.length >= Math.max(0, limit)) break;
  }

  return { canOrderGlobally: true, items };
};

export const formatHomepageRecentUpdateMeta = (
  updateType: unknown,
  recentUpdateDate: string,
  eventDate: string,
  language: 'sl' | 'en'
): string => {
  const labels: Record<string, string> = language === 'sl'
    ? { new: 'Dodano', confirmed: 'Potrjeno', updated: 'Posodobljeno' }
    : { new: 'Added', confirmed: 'Confirmed', updated: 'Updated' };
  const type = String(updateType ?? '').trim().toLowerCase();
  const label = Object.hasOwn(labels, type) ? labels[type] : '';
  if (!recentUpdateDate || !label) return eventDate;
  return [
    `${label} ${recentUpdateDate}`,
    eventDate ? `${language === 'sl' ? 'dogodek' : 'event'} ${eventDate}` : ''
  ].filter(Boolean).join(' · ');
};

export const getHomepageRowCandidates = (item: HomepageApiRecord) => {
  const rows = new Set<string>();
  for (const key of rowKeys) {
    const value = pickPathString(item, [key]);
    if (value) rows.add(value);
  }
  return [...rows];
};

export const normalizeHomepageEventId = (value: unknown) => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return '';
  const normalized = rawValue.toLocaleUpperCase('sl-SI').replace(/\s+/g, '');
  const prefixedMatch = normalized.match(/^R0*(\d+)$/);
  const numericMatch = normalized.match(/^0*(\d+)$/);
  const numericPart = prefixedMatch?.[1] ?? numericMatch?.[1];
  if (!numericPart) return '';
  const numberValue = Number.parseInt(numericPart, 10);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return '';
  return `R${String(numberValue).padStart(6, '0')}`;
};

const masterRow = (event: HomepageApiRecord) => pickPathString(event, ['row', 'master_row', 'masterRow']);
const masterDate = (event: HomepageApiRecord) => pickPathString(event, ['datum', 'date', 'event_date', 'Datum']);
const masterTitle = (event: HomepageApiRecord) => pickPathString(event, ['naziv_prireditve', 'naziv', 'title', 'name']);
const masterPlace = (event: HomepageApiRecord) => pickPathString(event, ['kraj', 'place', 'city', 'location']);
const naturalKey = (date: string, title: string, place: string) => {
  const titleKey = title.toLocaleLowerCase('sl-SI').normalize('NFKC');
  const placeKey = place.toLocaleLowerCase('sl-SI').normalize('NFKC');
  return date && titleKey && placeKey ? `${date}|${titleKey}|${placeKey}` : '';
};

const uniqueIndex = (events: HomepageApiRecord[], keyFor: (event: HomepageApiRecord) => string) => {
  const buckets = new Map<string, HomepageApiRecord[]>();
  for (const event of events) {
    const key = keyFor(event);
    if (!key) continue;
    buckets.set(key, [...(buckets.get(key) ?? []), event]);
  }
  const index = new Map<string, HomepageApiRecord>();
  for (const [key, matches] of buckets) {
    if (matches.length === 1) index.set(key, matches[0]);
  }
  return index;
};

export const buildHomepageMasterEventIndex = (events: HomepageApiRecord[]) => ({
  byRow: uniqueIndex(events, (event) => recentUpdateYear(event) && masterRow(event) ? `${recentUpdateYear(event)}:${masterRow(event)}` : ''),
  byEventId: uniqueIndex(events, (event) => recentUpdateYear(event) && masterRow(event) ? `${recentUpdateYear(event)}:${normalizeHomepageEventId(masterRow(event))}` : ''),
  byNaturalKey: uniqueIndex(events, (event) => naturalKey(masterDate(event), masterTitle(event), masterPlace(event)))
});

export const matchRecentUpdateToMasterEvent = (
  update: HomepageApiRecord,
  index: ReturnType<typeof buildHomepageMasterEventIndex>
): RecentUpdateMatch => {
  const year = recentUpdateYear(update);
  if (!year) return { event: null, reason: 'missing_identity' };
  const rows = getHomepageRowCandidates(update);
  const ids = eventIdKeys.map((key) => normalizeHomepageEventId(pickPathValue(update, key))).filter(Boolean);
  const candidates = [
    ...rows.map((row) => index.byRow.get(`${year}:${row}`)),
    ...ids.map((id) => index.byEventId.get(`${year}:${id}`))
  ];
  if (candidates.length) {
    const match = candidates[0];
    if (!match || candidates.some((candidate) => candidate !== match)) return { event: null, reason: 'not_unique_or_missing' };
    const date = pickPathString(update, ['datum', 'event.datum', 'date', 'event_date', 'Datum']);
    if (date && masterDate(match) !== date) return { event: null, reason: 'date_mismatch' };
    return { event: match, reason: rows.length ? 'row' : 'event_id' };
  }

  const date = pickPathString(update, ['datum', 'event.datum', 'date', 'event_date', 'Datum']);
  const title = pickPathString(update, ['naziv_prireditve', 'naziv', 'event.naziv_prireditve', 'event.naziv', 'title', 'name']);
  const place = pickPathString(update, ['kraj', 'event.kraj', 'place', 'city', 'location']);
  const key = naturalKey(date, title, place);
  if (!key) return { event: null, reason: 'missing_identity' };
  const match = index.byNaturalKey.get(key);
  return match ? { event: match, reason: 'date_title_place' } : { event: null, reason: 'not_unique_or_missing' };
};

export const buildHomepageEventDetailPath = (
  event: HomepageApiRecord,
  helpers: {
    rowKey: (event: HomepageApiRecord) => string;
    getTitle: (event: HomepageApiRecord) => string;
    getDisplayTitle: (title: string) => string;
  }
) => {
  const canonicalEvent = getCanonicalHomepageEvent(event);
  const title = helpers.getDisplayTitle(helpers.getTitle(canonicalEvent));

  return buildEventDetailPath({
    year: getHomepageEventYear(canonicalEvent),
    row: helpers.rowKey(canonicalEvent),
    date: getHomepageEventField(canonicalEvent, 'datum', ['date', 'event_date', 'Datum']),
    title,
    naziv_prireditve: title,
    place: getHomepageEventField(canonicalEvent, 'kraj', ['place', 'city', 'location'])
  });
};

export const buildEnglishHomepageEventDetailPath = (
  event: HomepageApiRecord,
  helpers: {
    rowKey: (event: HomepageApiRecord) => string;
    getTitle: (event: HomepageApiRecord) => string;
    getDisplayTitle: (title: string) => string;
  }
) => {
  const canonicalEvent = getCanonicalHomepageEvent(event);
  const title = helpers.getDisplayTitle(helpers.getTitle(canonicalEvent));

  return buildEnglishEventDetailPath({
    year: getHomepageEventYear(canonicalEvent),
    row: helpers.rowKey(canonicalEvent),
    date: getHomepageEventField(canonicalEvent, 'datum', ['date', 'event_date', 'Datum']),
    title,
    naziv_prireditve: title,
    place: getHomepageEventField(canonicalEvent, 'kraj', ['place', 'city', 'location'])
  });
};

export const hasMultiYearRecentUpdatesContract = (payload: unknown): boolean => {
  const root = homepageAsRecord(payload);
  const block = homepageAsRecord(root?.recent_updates_last_days);
  return root?.ok === true && Array.isArray(block?.years) &&
    block.years.length === 2 && block.years[0] === '2026' && block.years[1] === '2027' &&
    Array.isArray(block.events) && block.events.every(item => homepageAsRecord(item) !== null);
};

/** The opt-in API owns global ordering, including ties. Never re-sort by title. */
export const selectCanonicalHomepageRecentUpdates = (
  payload: unknown,
  limit = 4
): HomepageRecentUpdateSelection => {
  if (!hasMultiYearRecentUpdatesContract(payload)) return { canOrderGlobally: false, items: [] };
  const block = homepageAsRecord(homepageAsRecord(payload)?.recent_updates_last_days)!;
  const events = block.events as HomepageApiRecord[];
  if (events.some(item => parseRecentUpdateDateValue(pickPathString(item, ['recent_update_date'])) === null)) {
    return { canOrderGlobally: false, items: [] };
  }
  const identities = new Set<string>();
  const items: HomepageApiRecord[] = [];
  for (const [index, item] of events.entries()) {
    if (items.length >= Math.max(0, limit)) break;
    const identity = recentUpdateIdentity(item) || `unidentified:${index}`;
    if (identities.has(identity)) continue;
    identities.add(identity);
    items.push(item);
  }
  return { canOrderGlobally: true, items };
};
