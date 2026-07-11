export type DistanceFormatLanguage = 'sl' | 'en';

const formatDistancePart = (value: string, language: DistanceFormatLanguage) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const withoutKm = trimmed.replace(/\s*km\b/gi, '').trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(withoutKm)) {
    return language === 'sl' ? trimmed.replace(/\./g, ',') : trimmed.replace(/,/g, '.');
  }

  const decimal = language === 'sl' ? withoutKm.replace('.', ',') : withoutKm.replace(',', '.');
  return `${decimal} km`;
};

export const formatRaceDistances = (value: string, language: DistanceFormatLanguage = 'sl') => value
  .trim()
  .split(';')
  .map((part) => formatDistancePart(part, language))
  .filter(Boolean)
  .join(' · ');
