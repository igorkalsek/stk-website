import { getDisplayEventTitle } from './utils-events.js';

export type PublicRaceEvent = {
  id: string;
  row: string;
  year: string;
  date: string;
  dateValue: number;
  title: string;
  displayTitle: string;
  naziv_prireditve: string;
  place: string;
  region: string;
  surface: string;
  distances: string;
  startTime: string;
  noticeUrl: string;
  registrationUrl: string;
  voteUrl: string;
  publicNotes: string;
  cup: string;
  familyFriendly: boolean;
  kidsRaces: boolean;
};

type ApiRecord = Record<string, unknown>;

const ARRAY_KEYS = ['data', 'events', 'items', 'rows', 'results', 'top'];

export const asRecord = (value: unknown): ApiRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as ApiRecord : null;

export const toApiRecords = (payload: unknown): ApiRecord[] => {
  if (Array.isArray(payload)) return payload.filter(asRecord) as ApiRecord[];
  const record = asRecord(payload);
  if (!record) return [];
  for (const key of ARRAY_KEYS) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter(asRecord) as ApiRecord[];
  }
  return [];
};

export const pickString = (item: ApiRecord, key: string): string => {
  const value = item[key];
  return value === undefined || value === null ? '' : String(value).trim();
};

export const normalizeSloveneText = (value: string) => value.toLocaleLowerCase('sl-SI').normalize('NFKC');

export const safeHttpUrl = (value: string) => {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};

export const parsePublicDateValue = (value: string) => {
  if (!value) return Number.NaN;
  return new Date(`${value}T00:00:00`).getTime();
};

export const hasKidsRaceNote = (value: string) => /\botro(?:ški|ška|ških|kom|ci|cih|ke|ci)|\bkids?\b|\bchildren(?:’s|'s)?\b/iu.test(value);

export const slugifyEventPart = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('sl-SI')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'tek';

export const getStableEventId = (event: Pick<PublicRaceEvent, 'row' | 'date' | 'naziv_prireditve' | 'place'>) =>
  event.row ? `r${event.row.padStart(6, '0')}` : slugifyEventPart(`${event.date}-${event.naziv_prireditve}-${event.place}`);

export const buildEventDetailSlug = (event: Pick<PublicRaceEvent, 'row' | 'date' | 'title' | 'naziv_prireditve' | 'place'>) =>
  `${getStableEventId(event)}-${slugifyEventPart(event.title || event.naziv_prireditve)}`;

export const buildEventDetailPath = (event: Pick<PublicRaceEvent, 'year' | 'row' | 'date' | 'title' | 'naziv_prireditve' | 'place'>) =>
  `/tek/${event.year}/${buildEventDetailSlug(event)}/`;

export const buildEnglishEventDetailPath = (event: Pick<PublicRaceEvent, 'year' | 'row' | 'date' | 'title' | 'naziv_prireditve' | 'place'>) =>
  `/en/races/${event.year}/${buildEventDetailSlug(event)}/`;

export const slugMatchesEvent = (slug: string, event: Pick<PublicRaceEvent, 'row' | 'date' | 'title' | 'naziv_prireditve' | 'place'>) =>
  slug === buildEventDetailSlug(event) || slug.startsWith(`${getStableEventId(event)}-`) || slug === getStableEventId(event);

export const mapPublicRaceEvent = (item: ApiRecord, year: string, today = 0): PublicRaceEvent | null => {
  const date = pickString(item, 'datum');
  const dateValue = parsePublicDateValue(date);
  const title = pickString(item, 'naziv_prireditve');
  const place = pickString(item, 'kraj');
  const publicNotes = pickString(item, 'opombe_javne');

  if (!date || Number.isNaN(dateValue) || !title) return null;
  if (!date.startsWith(`${year}-`)) return null;
  if (today && dateValue < today) return null;
  if (normalizeSloveneText(pickString(item, 'status_dogodka')) !== 'potrjeno') return null;
  if (pickString(item, 'vidno_v_javnem_koledarju').toLocaleUpperCase('sl-SI') !== 'DA') return null;

  const row = pickString(item, 'row');
  const displayTitle = getDisplayEventTitle(title);

  return {
    id: row || `${date}-${title}-${place}`,
    row,
    year,
    date,
    dateValue,
    title: displayTitle,
    displayTitle,
    naziv_prireditve: title,
    place,
    region: pickString(item, 'regija'),
    surface: pickString(item, 'tip_podlage'),
    distances: pickString(item, 'razdalje_km'),
    startTime: pickString(item, 'cas_zacetka'),
    noticeUrl: safeHttpUrl(pickString(item, 'povezava_razpis')),
    registrationUrl: safeHttpUrl(pickString(item, 'povezava_prijava')),
    voteUrl: safeHttpUrl(pickString(item, 'vote_url') || pickString(item, 'glasovanje_url') || pickString(item, 'url_glasovanje')),
    publicNotes,
    cup: pickString(item, 'pokal') || pickString(item, 'serija') || pickString(item, 'pokal_serija'),
    familyFriendly: normalizeSloveneText(publicNotes).includes('družinam prijazno'),
    kidsRaces: hasKidsRaceNote(publicNotes)
  };
};
