import type { SavedRaceResolution } from './utils-my-races.js';
import { DEFAULT_PUBLIC_YEAR, type PublicYear } from './utils-public-year.js';
import { formatEnglishRegion, formatEnglishSurface } from './utils-english.js';

export type AchievementKey = 'debut' | 'five' | 'ten' | 'nomad' | 'all-terrain' | 'veteran';
export type BasicSurface = 'road' | 'trail' | 'mountain';
export type SeasonAchievement = { key: AchievementKey; achieved: boolean; current: number; target: number };
export type SeasonRegionProgress = { key: string; label: string; visited: boolean; completedEventCount: number };

export const ACHIEVEMENT_ORDER: AchievementKey[] = ['debut', 'five', 'all-terrain', 'ten', 'nomad', 'veteran'];
const normalize = (value: string) => value.trim().toLocaleLowerCase('sl-SI').replace(/\s+/g, ' ');
const SURFACES: Record<string, BasicSurface> = {
  cesta: 'road', asfalt: 'road', 'cesta/asfalt': 'road', road: 'road',
  trail: 'trail', 'trail tek': 'trail',
  gorski: 'mountain', 'gorski tek': 'mountain', mountain: 'mountain'
};

/** Combined and unknown values intentionally return null: one event can prove only one category. */
export const normalizeBasicSurface = (value: string): BasicSurface | null => SURFACES[normalize(value)] ?? null;
export const normalizeRegionKey = (value: string) => normalize(value);
export const formatSeasonRegionLabel = (value: string, language: 'sl' | 'en') => language === 'en' ? formatEnglishRegion(value) : value;
export const formatSeasonSurfaceLabel = (value: string, language: 'sl' | 'en') => language === 'en' ? formatEnglishSurface(value) : value;

export const getCompletedRaces = (items: SavedRaceResolution[], year: PublicYear = DEFAULT_PUBLIC_YEAR) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (item.savedRace.year !== year || item.savedRace.status !== 'completed' || seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
};

export const getNextSavedRace = (items: SavedRaceResolution[]) => items.find((item) =>
  item.status === 'upcoming' && item.savedRace.status !== 'completed' && Boolean(item.event)
) ?? null;

export const getSeasonSummary = (items: SavedRaceResolution[], year: PublicYear = DEFAULT_PUBLIC_YEAR) => {
  const completed = getCompletedRaces(items, year);
  const regions = new Set(completed.map((item) => normalizeRegionKey(item.event?.region ?? '')).filter(Boolean));
  const surfaces = new Set(completed.map((item) => normalizeBasicSurface(item.event?.surface ?? '')).filter((value): value is BasicSurface => Boolean(value)));
  return { completed, completedCount: completed.length, distinctEventCount: completed.length, regionCount: regions.size, surfaceCount: surfaces.size, regions, surfaces };
};

export const getSeasonRegionProgress = (items: SavedRaceResolution[], availableRegionLabels: string[], year: PublicYear = DEFAULT_PUBLIC_YEAR): SeasonRegionProgress[] => {
  const counts = new Map<string, number>();
  getCompletedRaces(items, year).forEach((item) => {
    const key = normalizeRegionKey(item.event?.region ?? '');
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const labels = new Map<string, string>();
  availableRegionLabels.forEach((label) => { const key = normalizeRegionKey(label); if (key && !labels.has(key)) labels.set(key, label.trim()); });
  return [...labels].map(([key, label]) => ({ key, label, visited: counts.has(key), completedEventCount: counts.get(key) ?? 0 }))
    .sort((a, b) => a.label.localeCompare(b.label, 'sl-SI'));
};

export const getSeasonAchievements = (items: SavedRaceResolution[], year: PublicYear = DEFAULT_PUBLIC_YEAR): SeasonAchievement[] => {
  const { distinctEventCount, regionCount, surfaces } = getSeasonSummary(items, year);
  const terrainCount = (['road', 'trail', 'mountain'] as BasicSurface[]).filter((surface) => surfaces.has(surface)).length;
  return [
    { key: 'debut', achieved: distinctEventCount >= 1, current: Math.min(distinctEventCount, 1), target: 1 },
    { key: 'five', achieved: distinctEventCount >= 5, current: Math.min(distinctEventCount, 5), target: 5 },
    { key: 'ten', achieved: distinctEventCount >= 10, current: Math.min(distinctEventCount, 10), target: 10 },
    { key: 'nomad', achieved: regionCount >= 6, current: Math.min(regionCount, 6), target: 6 },
    { key: 'all-terrain', achieved: terrainCount >= 3, current: terrainCount, target: 3 },
    { key: 'veteran', achieved: distinctEventCount >= 20, current: Math.min(distinctEventCount, 20), target: 20 }
  ];
};

export const getNextAchievement = (items: SavedRaceResolution[], year: PublicYear = DEFAULT_PUBLIC_YEAR) => {
  const achievements = getSeasonAchievements(items, year);
  return ACHIEVEMENT_ORDER.map((key) => achievements.find((item) => item.key === key)!).find((item) => !item.achieved) ?? null;
};

type SloveneCountKind = 'completed-race' | 'region' | 'achievement' | 'distinct-event';
const FORMS: Record<SloveneCountKind, [string, string, string, string]> = {
  'completed-race': ['opravljen tek', 'opravljena teka', 'opravljeni teki', 'opravljenih tekov'],
  region: ['regija', 'regiji', 'regije', 'regij'], achievement: ['dosežek', 'dosežka', 'dosežki', 'dosežkov'],
  'distinct-event': ['različna prireditev', 'različni prireditvi', 'različne prireditve', 'različnih prireditev']
};
export const formatSloveneCount = (count: number, kind: SloveneCountKind) => {
  const mod100 = Math.abs(count) % 100;
  const form = mod100 === 1 ? 0 : mod100 === 2 ? 1 : (mod100 === 3 || mod100 === 4) ? 2 : 3;
  return `${count} ${FORMS[kind][form]}`;
};
