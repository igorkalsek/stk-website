export const DISTANCE_FILTER_ALL = 'all' as const;

export const DISTANCE_FILTER_VALUES = [
  DISTANCE_FILTER_ALL,
  'up-to-5',
  'over-5-to-10',
  'over-10-to-half',
  'over-half-to-marathon',
  'ultra'
] as const;

export type DistanceFilterValue = (typeof DISTANCE_FILTER_VALUES)[number];

const DISTANCE_TOKEN_PATTERN = /^\d+(?:[.,]\d+)?\s*(?:km)?$/iu;

export const parseRaceDistancesKm = (value: string | null | undefined): number[] => {
  if (!value) return [];

  return value
    .split(';')
    .map((token) => token.trim())
    .filter((token) => DISTANCE_TOKEN_PATTERN.test(token))
    .map((token) => Number(token.replace(/\s*km$/iu, '').replace(',', '.').trim()))
    .filter((distance) => Number.isFinite(distance) && distance > 0);
};

export const isDistanceInRange = (distance: number, filter: DistanceFilterValue): boolean => {
  if (filter === DISTANCE_FILTER_ALL) return true;
  if (!Number.isFinite(distance) || distance <= 0) return false;

  if (filter === 'up-to-5') return distance <= 5;
  if (filter === 'over-5-to-10') return distance > 5 && distance <= 10;
  if (filter === 'over-10-to-half') return distance > 10 && distance <= 21.1;
  if (filter === 'over-half-to-marathon') return distance > 21.1 && distance <= 42.2;
  if (filter === 'ultra') return distance > 42.2;
  return false;
};

export const matchesRaceDistanceFilter = (value: string | null | undefined, filter: string): boolean => {
  if (!filter || filter === DISTANCE_FILTER_ALL) return true;
  if (!DISTANCE_FILTER_VALUES.includes(filter as DistanceFilterValue)) return true;

  const distances = parseRaceDistancesKm(value);
  return distances.some((distance) => isDistanceInRange(distance, filter as DistanceFilterValue));
};

export const getMaxRaceDistanceKm = (value: string | null | undefined): number | null => {
  const distances = parseRaceDistancesKm(value);
  return distances.length ? Math.max(...distances) : null;
};
