import { buildEnglishEventDetailPath, buildEventDetailPath } from './utils-event-detail.js';

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
  byRow: uniqueIndex(events, masterRow),
  byEventId: uniqueIndex(events, (event) => normalizeHomepageEventId(masterRow(event))),
  byNaturalKey: uniqueIndex(events, (event) => naturalKey(masterDate(event), masterTitle(event), masterPlace(event)))
});

export const matchRecentUpdateToMasterEvent = (
  update: HomepageApiRecord,
  index: ReturnType<typeof buildHomepageMasterEventIndex>
): RecentUpdateMatch => {
  for (const row of getHomepageRowCandidates(update)) {
    const match = index.byRow.get(row);
    if (match) return { event: match, reason: 'row' };
  }

  for (const key of eventIdKeys) {
    const id = normalizeHomepageEventId(pickPathValue(update, key));
    const match = id ? index.byEventId.get(id) : null;
    if (match) return { event: match, reason: 'event_id' };
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
