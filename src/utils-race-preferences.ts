import { isDistanceInRange, parseRaceDistancesKm, type DistanceFilterValue } from './utils-distance-filter.js';
import { getStableEventId, normalizeSloveneText, parsePublicDateValue, type PublicRaceEvent } from './utils-event-detail.js';

export const RACE_PREFERENCES_STORAGE_KEY = 'stkRacePreferencesV1';
export const RACE_PREFERENCES_VERSION = 1 as const;
export const MAX_PREFERENCE_VALUES = 20;
export const PREFERENCE_DISTANCE_BUCKETS = ['up-to-5', 'over-5-to-10', 'over-10-to-half', 'over-half-to-marathon', 'ultra'] as const;
export const PREFERENCE_SURFACE_CATEGORIES = ['road', 'trail', 'mountain'] as const;

export type RacePreferenceDistanceBucket = (typeof PREFERENCE_DISTANCE_BUCKETS)[number];
export type RacePreferenceSurfaceCategory = (typeof PREFERENCE_SURFACE_CATEGORIES)[number];
export type RacePreferencesV1 = {
  version: 1;
  distanceBuckets: RacePreferenceDistanceBucket[];
  surfaceCategories: RacePreferenceSurfaceCategory[];
  regions: string[];
  familyFriendly: boolean;
  active: boolean;
};
export type RacePreferenceReasonKey = 'preferred-distance' | 'preferred-surface' | 'preferred-region' | 'family-friendly';
export type RacePreferenceMatch = { event: PublicRaceEvent; score: number; reasonKeys: RacePreferenceReasonKey[] };
export type MinimalStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type PreferenceStorageResult = { preferences: RacePreferencesV1; persistent: boolean };

const emptyPreferences = (active = false): RacePreferencesV1 => ({ version: 1, distanceBuckets: [], surfaceCategories: [], regions: [], familyFriendly: false, active });
export const getEmptyRacePreferences = () => emptyPreferences(false);

const normalizeText = (value: string) => normalizeSloveneText(value).replace(/[()]/g, ' ').replace(/[\/,+&]+/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeRegion = (value: string) => normalizeText(value);

const uniqueLimitedStrings = (values: unknown, allowed?: readonly string[]) => {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (allowed && !allowed.includes(trimmed)) continue;
    const key = allowed ? trimmed : normalizeRegion(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= MAX_PREFERENCE_VALUES) break;
  }
  return result;
};

export const hasMeaningfulRacePreferences = (preferences: Pick<RacePreferencesV1, 'distanceBuckets' | 'surfaceCategories' | 'regions' | 'familyFriendly'>) =>
  preferences.distanceBuckets.length > 0 || preferences.surfaceCategories.length > 0 || preferences.regions.length > 0 || preferences.familyFriendly;

export const validateRacePreferences = (value: unknown): RacePreferencesV1 | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.version !== RACE_PREFERENCES_VERSION) return null;
  const preferences: RacePreferencesV1 = {
    version: 1,
    distanceBuckets: uniqueLimitedStrings(record.distanceBuckets, PREFERENCE_DISTANCE_BUCKETS) as RacePreferenceDistanceBucket[],
    surfaceCategories: uniqueLimitedStrings(record.surfaceCategories, PREFERENCE_SURFACE_CATEGORIES) as RacePreferenceSurfaceCategory[],
    regions: uniqueLimitedStrings(record.regions),
    familyFriendly: record.familyFriendly === true,
    active: record.active === true
  };
  if (!hasMeaningfulRacePreferences(preferences)) preferences.active = false;
  return preferences;
};

export const parseRacePreferencesJson = (json: string | null | undefined) => {
  if (!json) return null;
  try { return validateRacePreferences(JSON.parse(json)); } catch { return null; }
};

export const readRacePreferences = (storage?: MinimalStorage | null): PreferenceStorageResult => {
  if (!storage) return { preferences: emptyPreferences(), persistent: false };
  try { return { preferences: parseRacePreferencesJson(storage.getItem(RACE_PREFERENCES_STORAGE_KEY)) ?? emptyPreferences(), persistent: true }; }
  catch { return { preferences: emptyPreferences(), persistent: false }; }
};

export const writeRacePreferences = (storage: MinimalStorage | null | undefined, preferences: RacePreferencesV1): PreferenceStorageResult => {
  const validated = validateRacePreferences(preferences) ?? emptyPreferences();
  if (!storage) return { preferences: validated, persistent: false };
  try { storage.setItem(RACE_PREFERENCES_STORAGE_KEY, JSON.stringify(validated)); return { preferences: validated, persistent: true }; }
  catch { return { preferences: validated, persistent: false }; }
};

export const resetRacePreferences = (storage?: MinimalStorage | null) => {
  if (!storage) return false;
  try { storage.removeItem(RACE_PREFERENCES_STORAGE_KEY); return true; } catch { return false; }
};

export const getPreferenceComparisonDistances = (value: string | null | undefined) => {
  const distinct = [...new Set(parseRaceDistancesKm(value).filter((distance) => distance > 0))].sort((a, b) => a - b);
  const adult = distinct.filter((distance) => distance >= 3);
  return adult.length ? adult : distinct;
};

const SURFACE_CATEGORY_ALIASES: Record<string, RacePreferenceSurfaceCategory> = {
  cesta: 'road', cestni: 'road', road: 'road', asfalt: 'road', asphalt: 'road',
  trail: 'trail', trejl: 'trail',
  gorski: 'mountain', gorska: 'mountain', mountain: 'mountain', hribovski: 'mountain', planinski: 'mountain'
};

export const getRaceSurfaceCategories = (value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) return [] as RacePreferenceSurfaceCategory[];
  const categories = new Set<RacePreferenceSurfaceCategory>();
  for (const token of normalized.split(/\s+/).filter(Boolean)) {
    const category = SURFACE_CATEGORY_ALIASES[token];
    if (category) categories.add(category);
  }
  const exact = SURFACE_CATEGORY_ALIASES[normalized];
  if (exact) categories.add(exact);
  return [...categories].sort();
};

const REASON_PRIORITY: RacePreferenceReasonKey[] = ['preferred-distance', 'preferred-surface', 'preferred-region', 'family-friendly'];

export const rankRacesForPreferences = ({ events, preferences }: { events: PublicRaceEvent[]; preferences: RacePreferencesV1 }): RacePreferenceMatch[] => {
  const validPreferences = validateRacePreferences(preferences);
  if (!validPreferences || !hasMeaningfulRacePreferences(validPreferences)) return [];
  const preferredRegions = new Set(validPreferences.regions.map(normalizeRegion).filter(Boolean));
  return events.map((event) => {
    let score = 0;
    const reasonKeys: RacePreferenceReasonKey[] = [];
    const distances = getPreferenceComparisonDistances(event.distances);
    if (validPreferences.distanceBuckets.length && distances.some((distance) => validPreferences.distanceBuckets.some((bucket) => isDistanceInRange(distance, bucket as DistanceFilterValue)))) {
      score += 5; reasonKeys.push('preferred-distance');
    }
    const surfaces = getRaceSurfaceCategories(event.surface);
    if (validPreferences.surfaceCategories.length && surfaces.some((surface) => validPreferences.surfaceCategories.includes(surface))) {
      score += 4; reasonKeys.push('preferred-surface');
    }
    if (preferredRegions.size && preferredRegions.has(normalizeRegion(event.region))) {
      score += 3; reasonKeys.push('preferred-region');
    }
    if (validPreferences.familyFriendly && event.familyFriendly === true) {
      score += 2; reasonKeys.push('family-friendly');
    }
    return { event, score, reasonKeys: REASON_PRIORITY.filter((key) => reasonKeys.includes(key)) };
  }).filter((match) => match.score > 0).sort((a, b) =>
    b.score - a.score
    || b.reasonKeys.length - a.reasonKeys.length
    || parsePublicDateValue(a.event.date) - parsePublicDateValue(b.event.date)
    || normalizeText(a.event.title).localeCompare(normalizeText(b.event.title), 'sl-SI')
    || getStableEventId(a.event).localeCompare(getStableEventId(b.event), 'sl-SI')
  );
};

export const getRacePreferenceReasonLabels = (reasonKeys: RacePreferenceReasonKey[], language: 'sl' | 'en') => {
  const labels = {
    sl: { 'preferred-distance': 'Želena razdalja', 'preferred-surface': 'Izbrana podlaga', 'preferred-region': 'Izbrana regija', 'family-friendly': 'Družinam prijazno' },
    en: { 'preferred-distance': 'Preferred distance', 'preferred-surface': 'Preferred surface', 'preferred-region': 'Preferred region', 'family-friendly': 'Family-friendly' }
  } as const;
  return REASON_PRIORITY.filter((key) => reasonKeys.includes(key)).slice(0, 3).map((key) => labels[language][key]);
};

export type RacePreferenceLanguage = 'sl' | 'en';
export type RacePreferencePanelState = 'empty' | 'active' | 'inactive' | 'editing';
export type RaceFinderSortValue = 'date' | 'registration-deadline' | 'registration-min' | 'registration-max' | 'my-races' | string;

const DISTANCE_LABELS: Record<RacePreferenceLanguage, Record<RacePreferenceDistanceBucket, string>> = {
  sl: { 'up-to-5': 'Do 5 km', 'over-5-to-10': '5–10 km', 'over-10-to-half': '10–21,1 km', 'over-half-to-marathon': '21,1–42,2 km', ultra: 'Nad 42,2 km' },
  en: { 'up-to-5': 'Up to 5 km', 'over-5-to-10': '5–10 km', 'over-10-to-half': '10–21.1 km', 'over-half-to-marathon': '21.1–42.2 km', ultra: 'Over 42.2 km' }
};

const SURFACE_LABELS: Record<RacePreferenceLanguage, Record<RacePreferenceSurfaceCategory, string>> = {
  sl: { road: 'Cesta', trail: 'Trail', mountain: 'Gorski tek' },
  en: { road: 'Road', trail: 'Trail', mountain: 'Mountain' }
};

const slCountLabel = (count: number, singular: string, dual: string, few: string, many: string) => {
  const mod100 = Math.abs(count) % 100;
  if (mod100 === 1) return `${count} ${singular}`;
  if (mod100 === 2) return `${count} ${dual}`;
  if (mod100 === 3 || mod100 === 4) return `${count} ${few}`;
  return `${count} ${many}`;
};

export const getRacePreferenceCountLabel = (count: number, group: 'distance' | 'surface' | 'region', language: RacePreferenceLanguage) => {
  if (language === 'en') {
    const labels = { distance: 'distance group', surface: 'surface', region: 'region' } as const;
    return `${count} ${labels[group]}${count === 1 ? '' : 's'}`;
  }
  if (group === 'distance') return slCountLabel(count, 'razdalja', 'razdalji', 'razdalje', 'razdalj');
  if (group === 'region') return slCountLabel(count, 'regija', 'regiji', 'regije', 'regij');
  return slCountLabel(count, 'podlaga', 'podlagi', 'podlage', 'podlag');
};

export const getRacePreferenceDistanceLabel = (bucket: RacePreferenceDistanceBucket, language: RacePreferenceLanguage) => DISTANCE_LABELS[language][bucket];
export const getRacePreferenceSurfaceLabel = (category: RacePreferenceSurfaceCategory, language: RacePreferenceLanguage) => SURFACE_LABELS[language][category];

export const summarizeRacePreferences = (preferences: RacePreferencesV1, language: RacePreferenceLanguage) => {
  const validated = validateRacePreferences(preferences);
  if (!validated || !hasMeaningfulRacePreferences(validated)) return { visible: '', accessible: '' };
  const visibleParts: string[] = [];
  const accessibleParts: string[] = [];
  if (validated.distanceBuckets.length === 1) visibleParts.push(getRacePreferenceDistanceLabel(validated.distanceBuckets[0], language));
  else if (validated.distanceBuckets.length > 1) visibleParts.push(getRacePreferenceCountLabel(validated.distanceBuckets.length, 'distance', language));
  accessibleParts.push(...validated.distanceBuckets.map((bucket) => getRacePreferenceDistanceLabel(bucket, language)));

  if (validated.surfaceCategories.length === 1) visibleParts.push(getRacePreferenceSurfaceLabel(validated.surfaceCategories[0], language));
  else if (validated.surfaceCategories.length > 1) visibleParts.push(getRacePreferenceCountLabel(validated.surfaceCategories.length, 'surface', language));
  accessibleParts.push(...validated.surfaceCategories.map((category) => getRacePreferenceSurfaceLabel(category, language)));

  if (validated.regions.length === 1) visibleParts.push(validated.regions[0]);
  else if (validated.regions.length === 2) visibleParts.push(validated.regions.join(' · '));
  else if (validated.regions.length > 2) visibleParts.push(getRacePreferenceCountLabel(validated.regions.length, 'region', language));
  accessibleParts.push(...validated.regions);

  if (validated.familyFriendly) {
    const familyLabel = language === 'en' ? 'Family-friendly' : 'Družinam prijazno';
    visibleParts.push(familyLabel);
    accessibleParts.push(familyLabel);
  }
  return { visible: visibleParts.join(' · '), accessible: accessibleParts.join(' · ') };
};

export const getRacePreferencePanelState = ({ preferences, editing }: { preferences: RacePreferencesV1; editing: boolean }): RacePreferencePanelState => {
  if (editing) return 'editing';
  if (!hasMeaningfulRacePreferences(preferences)) return 'empty';
  return preferences.active ? 'active' : 'inactive';
};

export const getRaceFinderResultDescription = (sort: RaceFinderSortValue, language: RacePreferenceLanguage) => {
  const descriptions: Record<RacePreferenceLanguage, Record<string, string>> = {
    sl: {
      'my-races': 'Prikazani so potrjeni javni dogodki od danes naprej, razvrščeni po ujemanju z vašimi preferencami.',
      date: 'Prikazani so potrjeni javni dogodki od danes naprej, razvrščeni po datumu.',
      'registration-deadline': 'Prikazani so potrjeni javni dogodki od danes naprej, razvrščeni po roku prijave.',
      'registration-min': 'Prikazani so potrjeni javni dogodki od danes naprej, od najnižje znane startnine.',
      'registration-max': 'Prikazani so potrjeni javni dogodki od danes naprej, od najvišje znane startnine.'
    },
    en: {
      'my-races': 'Confirmed public races from today onward are shown, ranked by how well they match your preferences.',
      date: 'Confirmed public races from today onward are shown, sorted by date.',
      'registration-deadline': 'Confirmed public races from today onward are shown, sorted by registration deadline.',
      'registration-min': 'Confirmed public races from today onward are shown, starting with the lowest known entry fee.',
      'registration-max': 'Confirmed public races from today onward are shown, starting with the highest known entry fee.'
    }
  };
  return descriptions[language][sort] ?? descriptions[language].date;
};
