import type { PublicRaceEvent } from '../utils-event-detail';
import type { PublicYear } from '../utils-public-year';

export type RaceFinderLanguage = 'sl' | 'en';

export type RaceFinderLocale = {
  language: RaceFinderLanguage;
  dateLocale: string;
  finderPath: '/iskalnik-tekov/' | '/en/find-races/';
  formatDateBadge: (value: string) => string;
  formatSurface: (value: string) => string;
  formatMonthLabel: (month: string, year: PublicYear) => string;
  formatResultCount: (count: number) => string;
  formatVisibleResultCount: (visibleCount: number, totalCount: number) => string;
  buildDetailPath: (event: Pick<PublicRaceEvent, 'year' | 'row' | 'date' | 'title' | 'naziv_prireditve' | 'place'>) => string;
  advancedFiltersLabel: string;
  allMonthsLabel: string;
  allRegionsLabel: string;
  allSurfacesLabel: string;
  emptyDefaultPill: string;
  clearFiltersLabel: string;
  resetLabel: string;
  saveRaceLabel: string;
  detailLabel: string;
  voteLabel: string;
  voteAriaLabel: (title: string) => string;
  familyFriendlyLabel: string;
  preferenceReasonsAriaLabel: string;
  cardLabels: { place: string; region: string; distances: string };
  calendar: { addToCalendarLabel: string };
  messages: Record<string, string | ((value: string | number) => string)>;
};
