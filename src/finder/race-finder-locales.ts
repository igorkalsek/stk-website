import { buildEnglishEventDetailPath, buildEventDetailPath } from '../utils-event-detail.js';
import { formatEnglishDateBadge, formatEnglishMonthLabel, formatEnglishSurface } from '../utils-english.js';
import { formatSloveneDateBadge } from '../utils-slovenian.js';
import type { CalendarEventLinkInput } from '../utils-calendar.js';
import type { RaceFinderLocale } from './race-finder-types.js';

const slMonthFormatter = new Intl.DateTimeFormat('sl-SI', { month: 'long' });
const formatSloveneSurface = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.toLocaleLowerCase('sl-SI').replace(/^./, (letter) => letter.toLocaleUpperCase('sl-SI'));
};

export const buildPreferenceRegionInputId = (language: RaceFinderLocale['language'], index: number) => `pref-region-${language}-${index}`;

export const buildRaceFinderCalendarEventInput = (locale: Pick<RaceFinderLocale, 'language'>, event: Omit<CalendarEventLinkInput, 'language'>): CalendarEventLinkInput => ({
  ...event,
  language: locale.language
});

export const formatSloveneResultCount = (count: number) =>
  `${count} ${count === 1 ? 'dogodek' : count === 2 ? 'dogodka' : count > 2 && count < 5 ? 'dogodki' : 'dogodkov'}`;

export const formatEnglishResultCount = (count: number) => `${count} ${count === 1 ? 'race' : 'races'}`;

export const formatSloveneVisibleResultCount = (visibleCount: number, totalCount: number) =>
  `Prikazanih je ${visibleCount} od ${formatSloveneResultCount(totalCount)}`;

export const formatEnglishVisibleResultCount = (visibleCount: number, totalCount: number) =>
  `Showing ${visibleCount} of ${formatEnglishResultCount(totalCount)}`;

const formatSloveneMonthLabel = (month: string, year: string) => {
  const monthNumber = Number(month);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) return month;
  return slMonthFormatter.format(new Date(Number(year), monthNumber - 1, 1)).replace(/^./, (letter) => letter.toLocaleUpperCase('sl-SI'));
};

export const sloveneRaceFinderLocale: RaceFinderLocale = {
  language: 'sl', dateLocale: 'sl-SI', finderPath: '/iskalnik-tekov/', formatDateBadge: formatSloveneDateBadge, formatSurface: formatSloveneSurface, formatMonthLabel: formatSloveneMonthLabel, formatResultCount: formatSloveneResultCount, formatVisibleResultCount: formatSloveneVisibleResultCount, buildDetailPath: buildEventDetailPath,
  advancedFiltersLabel: 'Dodatni filtri', allMonthsLabel: 'Vsi meseci', allRegionsLabel: 'Vse regije', allSurfacesLabel: 'Vse podlage', emptyDefaultPill: 'Iskalnik', clearFiltersLabel: 'Počistite filtre', resetLabel: 'Ponastavite', saveRaceLabel: 'Shrani tek', detailLabel: 'Podrobnosti teka', voteLabel: 'Glasuj', voteAriaLabel: (title) => `Glasujte za ${title}`, familyFriendlyLabel: 'Družinam prijazno', preferenceReasonsAriaLabel: 'Ujema se z vašimi preferencami', cardLabels: { place: 'Kraj', region: 'Regija', distances: 'Razdalje' }, calendar: { addToCalendarLabel: 'V koledar' },
  messages: { loading: 'Nalagamo potrjene javne dogodke …', dataUnavailableStatus: 'Podatki trenutno niso dosegljivi. Poskusite znova čez nekaj minut.', dataUnavailableCount: 'Podatki niso dosegljivi', dataUnavailableTitle: 'Podatki trenutno niso dosegljivi', dataUnavailableMessage: 'Dogodkov trenutno ne moremo prikazati. Poskusite znova čez nekaj minut.', calendarPill: 'Koledar', noEventsStatus: 'Ni prihajajočih potrjenih javnih dogodkov za prikaz.', zeroCount: '0 dogodkov', noEventsTitle: 'Ni dogodkov za prikaz', quickPickStatus: 'Prikazani so teki, ki ustrezajo izbranemu hitremu izboru in filtrom.', deadlineStatus: 'Prikazani so teki, ki ustrezajo izbranemu roku prijave. Roki vključujejo predprijave in cenejše prijave.', choosePreference: 'Izberite vsaj eno preferenco.', preferencesSaved: 'Preference so shranjene.', preferencesSessionOnly: 'Preference delujejo v tej seji, vendar jih ni bilo mogoče trajno shraniti.', preferencesReset: 'Preference so ponastavljene.', copyFallback: 'Povezavo kopirajte iz naslovne vrstice.', copySuccess: 'Povezava je kopirana.', preferencesActive: 'Teki zame so aktivni', preferencesStored: 'Preference so shranjene', noEventsMessage: (year) => `Trenutno ni potrjenih prihajajočih dogodkov za leto ${year}.`, myRacesCount: (count) => count === 1 ? '1 tek se ujema z vašimi preferencami.' : `${count} tekov se ujema z vašimi preferencami.`, visibleCount: (visible) => `Prikazanih je ${visible} od {total}`, noPreferenceMatchesTitle: 'Ni tekov, ki bi se ujemali z izbranimi preferencami.', noPreferenceMatchesMessage: 'Uredite preference ali prikažite vse teke brez osebnega razvrščanja.', myRacesPill: 'Teki zame', editPreferences: 'Uredite preference', showAllRaces: 'Prikažite vse teke', noFilterMatchesTitle: 'Ni dogodkov, ki bi ustrezali izbranim filtrom.', tooManyFiltersMessage: 'Preveč izbranih filtrov. Poskusite izklopiti katerega od hitrih izborov ali počistite filtre.', removeFiltersMessage: 'Poskusite odstraniti katerega od filtrov ali počistite filtre.', filtersPill: 'Filtri' }
};
export const englishRaceFinderLocale: RaceFinderLocale = {
  ...sloveneRaceFinderLocale, language: 'en', dateLocale: 'en-GB', finderPath: '/en/find-races/', formatDateBadge: formatEnglishDateBadge, formatSurface: formatEnglishSurface, formatMonthLabel: (m) => formatEnglishMonthLabel(m), formatResultCount: formatEnglishResultCount, formatVisibleResultCount: formatEnglishVisibleResultCount, buildDetailPath: buildEnglishEventDetailPath,
  advancedFiltersLabel: 'Additional filters', allMonthsLabel: 'All months', allRegionsLabel: 'All regions', allSurfacesLabel: 'All surfaces', emptyDefaultPill: 'Search', clearFiltersLabel: 'Clear filters', resetLabel: 'Reset', saveRaceLabel: 'Save race', detailLabel: 'Race details', voteLabel: 'Vote', voteAriaLabel: (title) => `Vote for ${title}`, familyFriendlyLabel: 'Family-friendly', preferenceReasonsAriaLabel: 'Matches your preferences', cardLabels: { place: 'Town', region: 'Region', distances: 'Distances' }, calendar: { addToCalendarLabel: 'Add to calendar' },
  messages: { loading: 'Loading confirmed public races …', dataUnavailableStatus: 'Race data is currently unavailable. Please try again in a few minutes.', dataUnavailableCount: 'Data unavailable', dataUnavailableTitle: 'Race data is currently unavailable', dataUnavailableMessage: 'We cannot show races right now. Please try again in a few minutes.', calendarPill: 'Calendar', noEventsStatus: 'There are no upcoming confirmed public races to show.', zeroCount: '0 races', noEventsTitle: 'No races to show', quickPickStatus: 'Showing races that match the selected quick pick and filters.', deadlineStatus: 'Showing races that match the selected registration deadline filter. Deadlines include pre-registration and cheaper-entry deadlines.', choosePreference: 'Choose at least one preference.', preferencesSaved: 'Preferences saved.', preferencesSessionOnly: 'Preferences work for this page session, but could not be saved permanently.', preferencesReset: 'Preferences reset.', copyFallback: 'Copy the link from the address bar.', copySuccess: 'Link copied.', preferencesActive: 'Races for me is active', preferencesStored: 'Preferences are saved', noEventsMessage: (year) => `There are currently no confirmed upcoming races for ${year}.`, myRacesCount: (count) => count === 1 ? '1 race matches your preferences.' : `${count} races match your preferences.`, visibleCount: (visible) => `Showing ${visible} of {total}`, noPreferenceMatchesTitle: 'No races match the selected preferences.', noPreferenceMatchesMessage: 'Edit preferences or show all races without personalized ranking.', myRacesPill: 'Races for me', editPreferences: 'Edit preferences', showAllRaces: 'Show all races', noFilterMatchesTitle: 'No races match the selected filters.', tooManyFiltersMessage: 'Too many filters are selected. Try turning off one of the quick picks or clearing the filters.', removeFiltersMessage: 'Try removing one of the filters or clearing all filters.', filtersPill: 'Filters' }
};
