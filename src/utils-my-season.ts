import type { SavedRaceResolution } from './utils-my-races.js';

export type AchievementKey = 'debut' | 'five' | 'ten' | 'nomad' | 'all-terrain' | 'veteran';
export type BasicSurface = 'road' | 'trail' | 'mountain';
export type SeasonAchievement = { key: AchievementKey; achieved: boolean; current: number; target: number };

export const ACHIEVEMENT_ORDER: AchievementKey[] = ['debut', 'five', 'all-terrain', 'ten', 'nomad', 'veteran'];

const normalize = (value: string) => value.trim().toLocaleLowerCase('sl-SI').replace(/\s+/g, ' ');
const SURFACES: Record<string, BasicSurface> = {
  cesta: 'road', asfalt: 'road', 'cesta/asfalt': 'road', road: 'road',
  trail: 'trail', 'trail tek': 'trail',
  gorski: 'mountain', 'gorski tek': 'mountain', mountain: 'mountain'
};

/** Combined and unknown values intentionally return null: one event can prove only one category. */
export const normalizeBasicSurface = (value: string): BasicSurface | null => SURFACES[normalize(value)] ?? null;

export const getCompletedRaces = (items: SavedRaceResolution[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (item.savedRace.status !== 'completed' || seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
};

export const getSeasonSummary = (items: SavedRaceResolution[]) => {
  const completed = getCompletedRaces(items);
  const regions = new Set(completed.map((item) => item.event?.region.trim()).filter(Boolean));
  const surfaces = new Set(completed.map((item) => normalizeBasicSurface(item.event?.surface ?? '')).filter((value): value is BasicSurface => Boolean(value)));
  return { completed, completedCount: completed.length, regionCount: regions.size, surfaceCount: surfaces.size, regions, surfaces };
};

export const getSeasonAchievements = (items: SavedRaceResolution[]): SeasonAchievement[] => {
  const { completedCount, regionCount, surfaces } = getSeasonSummary(items);
  const terrainCount = (['road', 'trail', 'mountain'] as BasicSurface[]).filter((surface) => surfaces.has(surface)).length;
  return [
    { key: 'debut', achieved: completedCount >= 1, current: Math.min(completedCount, 1), target: 1 },
    { key: 'five', achieved: completedCount >= 5, current: Math.min(completedCount, 5), target: 5 },
    { key: 'ten', achieved: completedCount >= 10, current: Math.min(completedCount, 10), target: 10 },
    { key: 'nomad', achieved: regionCount >= 6, current: Math.min(regionCount, 6), target: 6 },
    { key: 'all-terrain', achieved: terrainCount >= 3, current: terrainCount, target: 3 },
    { key: 'veteran', achieved: completedCount >= 20, current: Math.min(completedCount, 20), target: 20 }
  ];
};

export const getNextAchievement = (items: SavedRaceResolution[]) => {
  const achievements = getSeasonAchievements(items);
  return ACHIEVEMENT_ORDER.map((key) => achievements.find((item) => item.key === key)!).find((item) => !item.achieved) ?? null;
};
