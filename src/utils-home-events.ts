import { buildEnglishEventDetailPath } from './utils-event-detail.js';

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
