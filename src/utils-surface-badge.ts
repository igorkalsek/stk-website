export type SurfaceBadgeTone = 'road' | 'trail' | 'mountain' | 'mixed' | 'other';

const normalizeSurface = (value: string) => value
  .trim()
  .toLocaleLowerCase('sl-SI')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

export const getSurfaceBadgeTone = (value: string | null | undefined): SurfaceBadgeTone | null => {
  const normalized = normalizeSurface(value ?? '');
  if (!normalized) return null;

  const hasRoad = /\b(?:cesta|road|asfalt)\b/.test(normalized);
  const hasTrail = /\btrail\b/.test(normalized);
  const hasMountain = /\b(?:gorski|mountain|vzpon)\b/.test(normalized);
  const matchedCategories = [hasRoad, hasTrail, hasMountain].filter(Boolean).length;

  if (/\b(?:mesano|mixed)\b/.test(normalized) || matchedCategories > 1) return 'mixed';
  if (hasRoad) return 'road';
  if (hasTrail) return 'trail';
  if (hasMountain) return 'mountain';
  return 'other';
};

export const getSurfaceBadgeClass = (value: string | null | undefined) => {
  const tone = getSurfaceBadgeTone(value);
  return tone ? `surface-badge surface-badge--${tone}` : '';
};

export const renderSurfaceBadgeHtml = (
  value: string | null | undefined,
  label: string,
  escapeHtml: (value: string) => string
) => {
  const className = getSurfaceBadgeClass(value);
  return className && label ? `<span class="${className}">${escapeHtml(label)}</span>` : '';
};

export const renderSurfaceSummaryHtml = (
  summary: string,
  surfaceBadge: string,
  escapeHtml: (value: string) => string
) => {
  if (!summary && !surfaceBadge) return '';
  const summaryText = summary ? `<span>${escapeHtml(summary)}</span>` : '';
  return `<div class="event-card-summary">${summaryText}${surfaceBadge}</div>`;
};
