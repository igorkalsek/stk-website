export const DEFAULT_PUBLIC_YEAR = '2026' as const;
export const SUPPORTED_PUBLIC_YEARS = ['2026', '2027'] as const;

export type PublicYear = (typeof SUPPORTED_PUBLIC_YEARS)[number];

export const isSupportedPublicYear = (year: string | null | undefined): year is PublicYear =>
  SUPPORTED_PUBLIC_YEARS.includes(year as PublicYear);

export const normalizePublicYear = (year: string | null | undefined): PublicYear =>
  isSupportedPublicYear(year) ? year : DEFAULT_PUBLIC_YEAR;

export const getPublicYearFromSearchParams = (searchParams: URLSearchParams): PublicYear =>
  normalizePublicYear(searchParams.get('year'));

export const buildMasterApiPath = (year: PublicYear): string =>
  year === DEFAULT_PUBLIC_YEAR ? '/' : `/?year=${year}`;

export const isAdditionalDataEnabledForYear = (year: PublicYear): boolean =>
  year === DEFAULT_PUBLIC_YEAR;

export const isRecentUpdatesEnabledForYear = (year: PublicYear): boolean =>
  year === DEFAULT_PUBLIC_YEAR;
