import { formatRaceDateBadge } from './utils-date.js';

export const formatSloveneVoteCount = (count: number) => {
  const formattedCount = new Intl.NumberFormat('sl-SI').format(count);
  const absoluteCount = Math.abs(count);
  const lastTwoDigits = absoluteCount % 100;
  const lastDigit = absoluteCount % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${formattedCount} glasov`;
  if (lastDigit === 1) return `${formattedCount} glas`;
  if (lastDigit === 2) return `${formattedCount} glasova`;
  if (lastDigit === 3 || lastDigit === 4) return `${formattedCount} glasovi`;
  return `${formattedCount} glasov`;
};

export const formatSloveneDateBadge = (value: string, includeYear = false) => formatRaceDateBadge(value, 'sl', includeYear);

const formatSloveneDistancePart = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const withoutKm = trimmed.replace(/\s*km\b/gi, '').trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(withoutKm)) return trimmed.replace(/\./g, ',');

  return `${withoutKm.replace('.', ',')} km`;
};

export const formatSloveneDistances = (value: string) => value
  .trim()
  .split(';')
  .map(formatSloveneDistancePart)
  .filter(Boolean)
  .join(' · ');
