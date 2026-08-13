
  import { filtersToAnalyticsJson, trackStkEvent } from '../lib/stkAnalytics';
  import { attachAdditionalDataByMasterRow, fetchAdditionalEventData, hasRenderableAdditionalData, renderAdditionalDataChips, type AdditionalEventData } from '../utils-additional';
  import { buildGoogleCalendarEventUrl, buildIcsDataUrl, buildIcsFilename, buildOutlookCalendarEventUrl } from '../utils-calendar';
  import { getStableEventId, mapPublicRaceEvent, normalizeSloveneText, parsePublicDateValue, toApiRecords, type PublicRaceEvent } from '../utils-event-detail';
  import { getMaxRaceDistanceKm, matchesRaceDistanceFilter } from '../utils-distance-filter';
  import { formatSloveneDistances } from '../utils-slovenian';
  import { enrichEventsWithVoteUrls, isVoteUrlSafeForEvent } from '../utils-vote';
  import { getRaceFinderResultDescription, getRacePreferencePanelState, getRacePreferenceReasonLabels, rankRacesForPreferences, readRacePreferences, resetRacePreferences, summarizeRacePreferences, validateRacePreferences, writeRacePreferences, type RacePreferenceMatch, type RacePreferencePanelState, type RacePreferencesV1 } from '../utils-race-preferences';
  import { buildPrimaryActions } from '../utils-race-detail-view';
  import { renderActionIcon } from '../utils-action-icons';
  import { initSavedRaceButtons } from '../saved-races-client';
  import { buildMasterApiPath, getPublicYearFromSearchParams, isAdditionalDataEnabledForYear, DEFAULT_PUBLIC_YEAR, type PublicYear } from '../utils-public-year';
  import { buildFinderUrl, buildFinderUrlForLanguage, buildFinderUrlForYear, clearFinderUrlState, parseFinderUrlState, stateForYear, type FinderUrlState } from '../utils-finder-url-state';
  import { formatActiveFinderFilterCount, getActiveFinderFilters, isActiveFilterKind, removeActiveFinderFilter, type ActiveFilterLabelLookup } from '../utils-finder-active-filters';
import { buildPreferenceRegionInputId, buildRaceFinderCalendarEventInput } from './race-finder-locales';
import type { RaceFinderLocale } from './race-finder-types';

  type ApiRecord = Record<string, unknown>;
  type RaceEvent = PublicRaceEvent & {
    month: string;
    datum: string;
    searchText: string;
    additionalData?: AdditionalEventData | null;
  };

  const API_BASE = 'https://stk-master-api.igor-kalsek.workers.dev';
  const initialUrlState = parseFinderUrlState(new URLSearchParams(window.location.search));
export const initializeRaceFinder = (locale: RaceFinderLocale) => {
  const activeYear = getPublicYearFromSearchParams(new URLSearchParams(window.location.search));
  const additionalDataEnabled = isAdditionalDataEnabledForYear(activeYear);
  const API_URL = `${API_BASE}${buildMasterApiPath(activeYear)}`;
  const TOP_API_URL = `${API_BASE}/top?scope=upcoming&limit=1000`;
  const PAGE_SIZE = 30;
  const dateFormatter = new Intl.DateTimeFormat(locale.dateLocale, { day: 'numeric', month: 'short', year: 'numeric' });
  
  const state: { activeYear: PublicYear; events: RaceEvent[]; filtered: RaceEvent[]; apiAvailable: boolean; visibleCount: number; userInteracted: boolean; lastLoggedSearchSignature: string } = {
    activeYear,
    events: [],
    filtered: [],
    apiAvailable: true,
    visibleCount: PAGE_SIZE,
    userInteracted: false,
    lastLoggedSearchSignature: ''
  };

  const resultsElement = document.querySelector<HTMLElement>('[data-search-results]');
  const statusElement = document.querySelector<HTMLElement>('[data-search-status]');
  const countElement = document.querySelector<HTMLElement>('[data-result-count]');
  const formElement = document.querySelector<HTMLFormElement>('[data-search-form]');
  const moreElement = document.querySelector<HTMLElement>('[data-search-more]');
  const showMoreButton = document.querySelector<HTMLButtonElement>('[data-show-more]');
  const searchInput = document.querySelector<HTMLInputElement>('[data-filter="search"]');
  const monthSelect = document.querySelector<HTMLSelectElement>('[data-filter="month"]');
  const regionSelect = document.querySelector<HTMLSelectElement>('[data-filter="region"]');
  const surfaceSelect = document.querySelector<HTMLSelectElement>('[data-filter="surface"]');
  const distanceSelect = document.querySelector<HTMLSelectElement>('[data-filter="distance"]');
  const registrationFeeSelect = document.querySelector<HTMLSelectElement>('[data-filter="registration-fee"]');
  const deadlineSelect = document.querySelector<HTMLSelectElement>('[data-filter="deadline"]');
  const sortSelect = document.querySelector<HTMLSelectElement>('[data-filter="sort"]');
  const familyInput = document.querySelector<HTMLInputElement>('[data-filter="family"]');
  const dayOfRegistrationInput = document.querySelector<HTMLInputElement>('[data-filter="day-of-registration"]');
  const routeInput = document.querySelector<HTMLInputElement>('[data-filter="route"]');
  const elevationSelect = document.querySelector<HTMLSelectElement>('[data-filter="elevation"]');
  const additionalNoteElement = document.querySelector<HTMLElement>('[data-additional-note]');
  const copyLinkButton = document.querySelector<HTMLButtonElement>('[data-copy-link]');
  const copyLinkStatus = document.querySelector<HTMLElement>('[data-copy-link-status]');
  const languageSwitchLinks = document.querySelectorAll<HTMLAnchorElement>('[data-language-switch]');
  const yearNoticeElement = document.querySelector<HTMLElement>('[data-year-notice]');
  const yearLinkElements = document.querySelectorAll<HTMLAnchorElement>('[data-year-link]');
  const activeFiltersElement = document.querySelector<HTMLElement>('[data-active-filters]');
  const activeFilterCountElement = document.querySelector<HTMLElement>('[data-active-filters-count]');
  const activeFilterListElement = document.querySelector<HTMLElement>('[data-active-filter-list]');
  const preferencePanel = document.querySelector<HTMLElement>('[data-race-preferences-panel]');
  const preferenceCompactElement = document.querySelector<HTMLElement>('[data-preferences-compact]');
  const preferenceFormElement = document.querySelector<HTMLElement>('[data-preferences-form]');
  const preferenceFormHeading = document.querySelector<HTMLElement>('[data-preferences-form-heading]');
  const preferenceEmptyTextElement = document.querySelector<HTMLElement>('[data-preferences-empty-text]');
  const preferenceStateTextElement = document.querySelector<HTMLElement>('[data-preferences-state-text]');
  const preferenceSummaryElement = document.querySelector<HTMLElement>('[data-preferences-summary]');
  const preferenceMessageElement = document.querySelector<HTMLElement>('[data-preferences-message]');
  const preferenceRegionList = document.querySelector<HTMLElement>('[data-preference-regions]');
  const savePreferencesButton = document.querySelector<HTMLButtonElement>('[data-save-preferences]');
  const activatePreferencesButton = document.querySelector<HTMLButtonElement>('[data-activate-preferences]');
  const editPreferencesButton = document.querySelector<HTMLButtonElement>('[data-edit-preferences]');
  const cancelPreferencesButton = document.querySelector<HTMLButtonElement>('[data-cancel-preferences]');
  const resetPreferencesButton = document.querySelector<HTMLButtonElement>('[data-reset-preferences]');
  const showAllPreferencesButton = document.querySelector<HTMLButtonElement>('[data-show-all-races]');
  const resetPreferencesFormButton = document.querySelector<HTMLButtonElement>('[data-reset-preferences-form]');
  const preferenceDistanceInputs = [...document.querySelectorAll<HTMLInputElement>('[data-preference-distance]')];
  const preferenceSurfaceInputs = [...document.querySelectorAll<HTMLInputElement>('[data-preference-surface]')];
  const preferenceFamilyInput = document.querySelector<HTMLInputElement>('[data-preference-family]');
  const initialPreferenceRead = (() => { try { return readRacePreferences(window.localStorage); } catch { return readRacePreferences(null); } })();
  let racePreferences: RacePreferencesV1 = initialPreferenceRead.preferences;
  let preferencesPersistent = initialPreferenceRead.persistent;
  let preferencesEditing = false;
  let previousPreferencePanelState: RacePreferencePanelState = racePreferences.active ? 'active' : 'inactive';
  const preferenceMatches = new Map<string, RacePreferenceMatch>();


  const initializeYearUi = () => {
    yearLinkElements.forEach((link) => {
      const isActive = link.dataset.yearLink === activeYear;
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
    });
    if (yearNoticeElement) yearNoticeElement.hidden = activeYear !== '2027';
    document.querySelectorAll<HTMLElement>('[data-selected-year]').forEach((element) => {
      element.textContent = activeYear;
    });
  };
  const advancedFiltersSummary = document.querySelector<HTMLElement>('[data-advanced-filters-summary]');
  const quickPickButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-quick-pick]')];
  const selectedQuickPicks = new Set<string>();
  let directFinderState: FinderUrlState = stateForYear(initialUrlState, activeYear);


  const toArray = toApiRecords;

  const normalize = normalizeSloveneText;

  const todayStart = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  };

  const parseDateValue = (value: string) => {
    if (!value) return Number.NaN;
    return parsePublicDateValue(value);
  };

  const formatDate = (value: string) => {
    const timestamp = parseDateValue(value);
    return Number.isNaN(timestamp) ? value : dateFormatter.format(new Date(timestamp));
  };

  const formatDateBadge = locale.formatDateBadge;

  const formatStartTime = (value: string) => {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(.*)$/);
    if (!match) return trimmed;
    return `${match[1].padStart(2, '0')}:${match[2]}${match[3] ?? ''}`;
  };

  const formatSurface = locale.formatSurface;

  const monthLabel = (month: string) => locale.formatMonthLabel(month, activeYear);

  const escapeHtml = (value: string | number) => {
    const characters: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return String(value).replace(/[&<>"']/g, (character) => characters[character]);
  };


  const parseMoney = (value: string) => {
    if (!value) return null;
    const normalized = value.replace(',', '.').replace(/[^\d.-]/g, '');
    if (!normalized) return null;
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : null;
  };

  const hasReliableAdditionalData = (additionalData?: AdditionalEventData | null): additionalData is AdditionalEventData =>
    additionalData?.reliability === 'visoka';

  const getRegistrationMinEur = (event: RaceEvent) =>
    hasReliableAdditionalData(event.additionalData) ? parseMoney(event.additionalData.registrationMinEur) : null;

  const getRegistrationMaxEur = (event: RaceEvent) =>
    hasReliableAdditionalData(event.additionalData) ? parseMoney(event.additionalData.registrationMaxEur) : null;

  const parseElevationGain = (value: string) => {
    if (!value) return null;
    const normalized = value.trim().replace(',', '.').replace(/\s+/g, '');
    if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
    const elevationGain = Number(normalized);
    return Number.isFinite(elevationGain) ? elevationGain : null;
  };

  const getReliableElevationGain = (event: RaceEvent) =>
    hasReliableAdditionalData(event.additionalData) ? parseElevationGain(event.additionalData.elevationGain) : null;

  const hasDayOfRegistration = (event: RaceEvent) =>
    hasReliableAdditionalData(event.additionalData) &&
    ['da', 'yes', 'true'].includes(event.additionalData.dayOfRegistration.toLocaleLowerCase('sl-SI').trim());

  const hasRouteData = (event: RaceEvent) =>
    hasReliableAdditionalData(event.additionalData) && Boolean(event.additionalData.routeUrl);

  const matchesRegistrationFeeFilter = (event: RaceEvent, filter: string) => {
    if (!filter) return true;

    const min = getRegistrationMinEur(event);
    if (min === null) return false;
    if (filter === 'free-option') return min === 0;

    const limit = Number(filter);
    return Number.isFinite(limit) && min <= limit;
  };

  const matchesElevationFilter = (event: RaceEvent, filter: string) => {
    if (!filter) return true;

    const elevationGain = getReliableElevationGain(event);
    if (elevationGain === null) return false;

    if (filter === 'max-300') return elevationGain <= 300;
    if (filter === 'max-800') return elevationGain <= 800;
    if (filter === 'max-1500') return elevationGain <= 1500;
    if (filter === 'over-1500') return elevationGain > 1500;
    return true;
  };

  const addDaysToIsoDate = (value: string, days: number) => {
    const timestamp = parseIsoDateSortValue(value);
    if (!Number.isFinite(timestamp)) return '';
    return new Date(timestamp + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  };

  const getUpcomingDeadlineDates = (event: RaceEvent, todayIsoDate = todayIsoDateInLjubljana()) => {
    if (!hasReliableAdditionalData(event.additionalData)) return [];
    return [event.additionalData.registrationDeadline, event.additionalData.earlyRegistrationDeadline]
      .filter((deadline) => /^\d{4}-\d{2}-\d{2}$/.test(deadline) && deadline >= todayIsoDate);
  };

  const hasDeadlineWithinDays = (event: RaceEvent, days: number, todayIsoDate = todayIsoDateInLjubljana()) => {
    const latestIsoDate = addDaysToIsoDate(todayIsoDate, days);
    if (!latestIsoDate) return false;
    return getUpcomingDeadlineDates(event, todayIsoDate).some((deadline) => deadline <= latestIsoDate);
  };

  const hasEarlyRegistrationEndingSoon = (event: RaceEvent, todayIsoDate = todayIsoDateInLjubljana()) => {
    if (!hasReliableAdditionalData(event.additionalData)) return false;
    const deadline = event.additionalData.earlyRegistrationDeadline;
    const latestIsoDate = addDaysToIsoDate(todayIsoDate, 14);
    return /^\d{4}-\d{2}-\d{2}$/.test(deadline) && Boolean(latestIsoDate) && deadline >= todayIsoDate && deadline <= latestIsoDate;
  };

  const matchesDeadlineFilter = (event: RaceEvent, filter: string) => {
    if (!filter) return true;
    if (filter === 'race-day') return hasDayOfRegistration(event);
    if (filter === 'early-ending') return hasEarlyRegistrationEndingSoon(event);
    if (filter === 'within-7') return hasDeadlineWithinDays(event, 7);
    if (filter === 'within-14') return hasDeadlineWithinDays(event, 14);
    if (filter === 'within-30') return hasDeadlineWithinDays(event, 30);
    return true;
  };

  const getMaxKnownDistanceKm = (event: RaceEvent) => getMaxRaceDistanceKm(event.distances);

  const hasTrailChallengeName = (event: RaceEvent) => {
    const searchableName = `${event.title} ${event.naziv_prireditve}`
      .toLocaleLowerCase('sl-SI')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return /\b(?:ultra|trails?|vertical|gorski|vzpon|mountain|challenge)\b/i.test(searchableName);
  };

  const isTrailOrMountainSurface = (surface: string) => {
    const normalizedSurface = normalize(surface);
    return normalizedSurface.includes('trail') || normalizedSurface.includes('gorski') || normalizedSurface.includes('mountain');
  };

  const matchesTrailChallengeQuickPick = (event: RaceEvent) => {
    if (!isTrailOrMountainSurface(event.surface)) return false;

    const maxDistanceKm = getMaxKnownDistanceKm(event);
    const elevationGain = getReliableElevationGain(event);
    return (
      (maxDistanceKm !== null && maxDistanceKm >= 20) ||
      (elevationGain !== null && elevationGain >= 800) ||
      hasTrailChallengeName(event)
    );
  };

  const compareNullableNumber = (a: number | null, b: number | null, direction: 'asc' | 'desc') => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return direction === 'asc' ? a - b : b - a;
  };

  const compareByDate = (a: RaceEvent, b: RaceEvent) =>
    a.dateValue - b.dateValue || a.title.localeCompare(b.title, 'sl-SI');

  const todayIsoDateInLjubljana = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Europe/Ljubljana',
      year: 'numeric'
    }).formatToParts(new Date());
    const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  };

  const parseIsoDateSortValue = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return Number.NaN;

    const [, year, month, day] = match;
    return Date.UTC(Number(year), Number(month) - 1, Number(day));
  };

  const getNearestRegistrationDeadlineValue = (event: RaceEvent, todayIsoDate = todayIsoDateInLjubljana()) => {
    if (!hasReliableAdditionalData(event.additionalData)) return null;

    const deadlineValues = [
      event.additionalData.earlyRegistrationDeadline,
      event.additionalData.registrationDeadline
    ]
      .filter((deadline) => deadline >= todayIsoDate)
      .map(parseIsoDateSortValue)
      .filter(Number.isFinite);

    return deadlineValues.length ? Math.min(...deadlineValues) : null;
  };

  const compareByRegistrationDeadline = (a: RaceEvent, b: RaceEvent) => {
    const todayIsoDate = todayIsoDateInLjubljana();
    const aDeadline = getNearestRegistrationDeadlineValue(a, todayIsoDate);
    const bDeadline = getNearestRegistrationDeadlineValue(b, todayIsoDate);

    return compareNullableNumber(aDeadline, bDeadline, 'asc') || compareByDate(a, b);
  };

  const sortEvents = (events: RaceEvent[], sort: string) =>
    [...events].sort((a, b) => {
      if (sort === 'registration-min') {
        return compareNullableNumber(getRegistrationMinEur(a), getRegistrationMinEur(b), 'asc') || compareByDate(a, b);
      }

      if (sort === 'registration-max') {
        return compareNullableNumber(getRegistrationMaxEur(a), getRegistrationMaxEur(b), 'desc') || compareByDate(a, b);
      }

      if (sort === 'registration-deadline') {
        return compareByRegistrationDeadline(a, b);
      }

      return compareByDate(a, b);
    });


  const renderPrimaryActionLink = (action: ReturnType<typeof buildPrimaryActions>[number]) =>
    `<a class="button button-small ${action.kind === 'registration' ? 'button-primary' : 'button-secondary-light'}" href="${escapeHtml(action.url)}" target="_blank" rel="noopener noreferrer" data-analytics-link-type="${escapeHtml(action.analyticsType)}"><span class="action-icon">${renderActionIcon(action.kind === 'registration' ? 'registration' : 'notice')}</span><span>${escapeHtml(action.label)}</span></a>`;

  type SecondaryMenuAction = { url: string; html: string; priority: number };
  const normalizeSecondaryDestination = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith('data:')) return trimmed;
    return trimmed.replace(/\/+$/, '');
  };
  const renderCalendarOptions = ({ title, date, location = '', noticeUrl = '', registrationUrl = '' }: {
    title: string;
    date: string;
    location?: string;
    noticeUrl?: string;
    registrationUrl?: string;
  }): SecondaryMenuAction[] => {
    const event = buildRaceFinderCalendarEventInput(locale, { title, date, location, noticeUrl, registrationUrl });
    const googleUrl = buildGoogleCalendarEventUrl(event);
    const icsUrl = buildIcsDataUrl(event);
    const icsFilename = buildIcsFilename(event);
    const outlookUrl = buildOutlookCalendarEventUrl(event);

    return [
      googleUrl && { url: googleUrl, priority: 5, html: `<a href="${escapeHtml(googleUrl)}" target="_blank" rel="noopener noreferrer" data-analytics-calendar-type="google">Google Calendar</a>` },
      icsUrl && { url: icsUrl, priority: 5, html: `<a href="${escapeHtml(icsUrl)}" download="${escapeHtml(icsFilename)}" data-analytics-calendar-type="ics">Apple / iCal</a>` },
      outlookUrl
        ? { url: outlookUrl, priority: 5, html: `<a href="${escapeHtml(outlookUrl)}" target="_blank" rel="noopener noreferrer" data-analytics-calendar-type="outlook">Outlook</a>` }
        : icsUrl && { url: icsUrl, priority: 5, html: `<a href="${escapeHtml(icsUrl)}" download="${escapeHtml(icsFilename)}" data-analytics-calendar-type="ics">Outlook / .ics</a>` }
    ].filter(Boolean) as SecondaryMenuAction[];
  };

  const setStatus = (message: string) => {
    if (statusElement) statusElement.textContent = message;
  };

  const setCount = (message: string) => {
    if (countElement) countElement.textContent = message;
  };

  const getFilters = () => ({
    search: normalize(searchInput?.value ?? ''),
    month: monthSelect?.value ?? '',
    region: regionSelect?.value ?? '',
    surface: surfaceSelect?.value ?? '',
    distance: distanceSelect?.value ?? 'all',
    registrationFee: registrationFeeSelect?.value ?? '',
    deadlineFilter: deadlineSelect?.value ?? '',
    sort: sortSelect?.value ?? 'date',
    elevation: elevationSelect?.value ?? '',
    family: Boolean(familyInput?.checked),
    dayOfRegistration: Boolean(dayOfRegistrationInput?.checked),
    route: Boolean(routeInput?.checked),
    quickPick: getActiveQuickPickValues().join(',')
  });


  const updateDirectFinderStateFromControl = (control: EventTarget | null) => {
    directFinderState = { ...directFinderState, year: activeYear, quick: [] };
    if (control === searchInput) directFinderState.q = searchInput?.value ?? '';
    else if (control === monthSelect) directFinderState.month = monthSelect?.value ?? '';
    else if (control === regionSelect) directFinderState.region = regionSelect?.value ?? '';
    else if (control === surfaceSelect) directFinderState.surface = surfaceSelect?.value ?? '';
    else if (control === distanceSelect) directFinderState.distance = distanceSelect?.value ?? 'all';
    else if (control === registrationFeeSelect) directFinderState.fee = registrationFeeSelect?.value ?? '';
    else if (control === deadlineSelect) directFinderState.deadline = deadlineSelect?.value ?? '';
    else if (control === sortSelect) directFinderState.sort = sortSelect?.value === 'my-races' ? 'date' : (sortSelect?.value as FinderUrlState['sort'] ?? 'date');
    else if (control === familyInput) directFinderState.family = Boolean(familyInput?.checked);
    else if (control === dayOfRegistrationInput) directFinderState.raceDay = Boolean(dayOfRegistrationInput?.checked);
    else if (control === routeInput) directFinderState.route = Boolean(routeInput?.checked);
    else if (control === elevationSelect) directFinderState.elevation = elevationSelect?.value ?? '';
  };

  const getFinderUrlStateForUrl = (): FinderUrlState => ({ ...directFinderState, year: activeYear, quick: getActiveQuickPickValues() });

  const canonicalPathForState = (finderState = getFinderUrlStateForUrl()) => buildFinderUrl(locale.finderPath, finderState, window.location.origin);

  const syncUrlFromControls = (finderState = getFinderUrlStateForUrl()) => {
    const nextPath = canonicalPathForState(finderState);
    if (`${window.location.pathname}${window.location.search}` !== nextPath) history.replaceState(null, '', nextPath);
    updateDerivedFinderLinks(finderState);
    renderActiveFilters(finderState);
  };

  const updateDerivedFinderLinks = (finderState = getFinderUrlStateForUrl()) => {
    yearLinkElements.forEach((link) => {
      const year = link.dataset.yearLink === '2027' ? '2027' : '2026';
      link.href = buildFinderUrlForYear(locale.finderPath, finderState, year);
    });
    languageSwitchLinks.forEach((link) => {
      const targetLanguage = link.getAttribute('hreflang') === 'en' ? 'en' : 'sl';
      link.href = buildFinderUrlForLanguage(finderState, targetLanguage);
    });
  };

  const getSelectLabelMap = (select: HTMLSelectElement | null) => Object.fromEntries([...select?.options ?? []].filter((option) => option.value).map((option) => [option.value, option.textContent?.trim() ?? option.value]));

  const getActiveFilterLabelLookup = (): ActiveFilterLabelLookup => ({
    month: getSelectLabelMap(monthSelect),
    region: getSelectLabelMap(regionSelect),
    surface: getSelectLabelMap(surfaceSelect),
    distance: getSelectLabelMap(distanceSelect),
    fee: getSelectLabelMap(registrationFeeSelect),
    deadline: getSelectLabelMap(deadlineSelect),
    sort: getSelectLabelMap(sortSelect),
    elevation: getSelectLabelMap(elevationSelect)
  });

  const renderActiveFilters = (finderState = getFinderUrlStateForUrl()) => {
    if (!activeFiltersElement || !activeFilterListElement) return;
    const chips = getActiveFinderFilters(stateForYear(finderState, activeYear), locale.language, getActiveFilterLabelLookup());
    activeFiltersElement.hidden = chips.length === 0;
    if (activeFilterCountElement) activeFilterCountElement.textContent = chips.length ? formatActiveFinderFilterCount(chips.length, locale.language) : '';
    activeFilterListElement.innerHTML = chips.map((filter) => `
      <button type="button" class="active-filter-chip" data-remove-filter="${escapeHtml(filter.kind)}" data-remove-filter-value="${escapeHtml(filter.value)}" aria-label="${escapeHtml(filter.ariaLabel)}">
        <span>${escapeHtml(filter.label)}</span>
        <span aria-hidden="true">×</span>
      </button>
    `).join('');
  };

  const removeActiveFilterChip = (kind: string, value: string) => {
    if (!isActiveFilterKind(kind)) {
      if (import.meta.env.DEV) console.warn('Invalid active filter chip kind', kind);
      return;
    }
    if (searchUrlTimer) window.clearTimeout(searchUrlTimer);
    state.userInteracted = true;
    state.visibleCount = PAGE_SIZE;
    const nextState = removeActiveFinderFilter(getFinderUrlStateForUrl(), kind, value);
    rebuildControlsFromFinderState(stateForYear(nextState, activeYear));
    renderResults();
    syncUrlFromControls();
  };

  const applyPublicSortState = (finderState: FinderUrlState, preservePersonalSort = true) => {
    if (!sortSelect) return;

    const keepPersonalSort =
      preservePersonalSort &&
      sortSelect.value === 'my-races' &&
      finderState.sort === 'date';

    if (!keepPersonalSort) {
      sortSelect.value = finderState.sort;
    }
  };

  const stripQuickPickDerivedFilters = (finderState: FinderUrlState): FinderUrlState => {
    const next = { ...finderState, quick: [...finderState.quick] };
    if (next.quick.includes('deadlines-soon')) {
      if (next.deadline === 'within-14') next.deadline = '';
      if (next.sort === 'registration-deadline') next.sort = 'date';
    }
    if (next.quick.includes('budget') && next.fee === '20') next.fee = '';
    if (next.quick.includes('first-race') && ['cesta', 'cesta/trail'].includes(normalize(next.surface))) next.surface = '';
    if (next.quick.includes('kids')) next.family = false;
    if (next.quick.includes('route')) next.route = false;
    return next;
  };

  const applyDirectFinderStateToControls = (finderState: FinderUrlState) => {
    if (searchInput) searchInput.value = finderState.q;
    if (monthSelect) monthSelect.value = [...monthSelect.options].some((option) => option.value === finderState.month) ? finderState.month : '';
    if (regionSelect) regionSelect.value = [...regionSelect.options].some((option) => option.value === finderState.region) ? finderState.region : '';
    if (surfaceSelect) surfaceSelect.value = [...surfaceSelect.options].some((option) => option.value === finderState.surface) ? finderState.surface : '';
    if (distanceSelect) distanceSelect.value = finderState.distance;
    if (registrationFeeSelect) registrationFeeSelect.value = activeYear === '2027' ? '' : finderState.fee;
    if (deadlineSelect) deadlineSelect.value = activeYear === '2027' ? '' : finderState.deadline;
    applyPublicSortState(finderState);
    if (familyInput) familyInput.checked = finderState.family;
    if (dayOfRegistrationInput) dayOfRegistrationInput.checked = activeYear !== '2027' && finderState.raceDay;
    if (routeInput) routeInput.checked = activeYear !== '2027' && finderState.route;
    if (elevationSelect) elevationSelect.value = activeYear === '2027' ? '' : finderState.elevation;
  };

  const rebuildControlsFromFinderState = (finderState: FinderUrlState) => {
    const normalizedState = stateForYear(finderState, activeYear);
    directFinderState = stripQuickPickDerivedFilters({ ...normalizedState, quick: [] });
    applyDirectFinderStateToControls(directFinderState);
    selectedQuickPicks.clear();
    stateForYear(finderState, activeYear).quick.forEach((quickPick) => selectedQuickPicks.add(quickPick));
    for (const quickPick of selectedQuickPicks) applyQuickPick(quickPick);
    updateQuickPickStates();
  };

  const applyFinderUrlStateToControls = rebuildControlsFromFinderState;

  const restoreFromCurrentUrl = () => {
    state.userInteracted = false;
    state.lastLoggedSearchSignature = '';
    if (searchUrlTimer) window.clearTimeout(searchUrlTimer);
    applyFinderUrlStateToControls(stateForYear(parseFinderUrlState(new URLSearchParams(window.location.search)), activeYear));
    state.visibleCount = PAGE_SIZE;
    renderResults();
    syncUrlFromControls();
  };

  const pickFirstAvailableSurface = (preferredSurfaces: string[]) => {
    const availableSurfaces = new Map([...new Set(state.events.map((event) => event.surface).filter(Boolean))].map((surface) => [normalize(surface), surface]));
    return preferredSurfaces.map((surface) => availableSurfaces.get(surface)).find(Boolean) ?? '';
  };

  const quickPickMatches: Record<string, (filters: any) => boolean> = {
    'deadlines-soon': (filters) => filters.deadlineFilter === 'within-14' && filters.sort === 'registration-deadline',
    budget: (filters) => filters.registrationFee === '20',
    'first-race': (filters) => ['cesta', 'cesta/trail'].includes(normalize(filters.surface)),
    trail: () => true,
    kids: (filters) => filters.family,
    route: (filters) => filters.route
  };

  function getActiveQuickPickValues() {
    const filters = {
      search: normalize(searchInput?.value ?? ''),
      month: monthSelect?.value ?? '',
      region: regionSelect?.value ?? '',
      surface: surfaceSelect?.value ?? '',
      registrationFee: registrationFeeSelect?.value ?? '',
      deadlineFilter: deadlineSelect?.value ?? '',
      sort: sortSelect?.value ?? 'date',
      elevation: elevationSelect?.value ?? '',
      family: Boolean(familyInput?.checked),
      dayOfRegistration: Boolean(dayOfRegistrationInput?.checked),
      route: Boolean(routeInput?.checked)
    };
    return [...selectedQuickPicks].filter((quickPick) => quickPickMatches[quickPick]?.(filters));
  }

  const updateQuickPickStates = () => {
    const activeQuickPicks = new Set(getActiveQuickPickValues());
    for (const quickPick of selectedQuickPicks) {
      if (!activeQuickPicks.has(quickPick)) selectedQuickPicks.delete(quickPick);
    }
    for (const button of quickPickButtons) {
      const isActive = activeQuickPicks.has(button.dataset.quickPick ?? '');
      const label = button.dataset.quickPickLabel ?? button.textContent?.replace(/^✓\s*/, '') ?? '';
      button.dataset.quickPickLabel = label;
      button.textContent = isActive ? `✓ ${label}` : label;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    }
  };

  const applyQuickPick = (quickPick: string) => {
    if (quickPick === 'deadlines-soon') {
      if (deadlineSelect) deadlineSelect.value = 'within-14';
      if (sortSelect) sortSelect.value = 'registration-deadline';
    } else if (quickPick === 'budget') {
      if (registrationFeeSelect) registrationFeeSelect.value = '20';
    } else if (quickPick === 'first-race') {
      const beginnerSurface = pickFirstAvailableSurface(['cesta', 'cesta/trail']);
      if (surfaceSelect && beginnerSurface) surfaceSelect.value = beginnerSurface;
    } else if (quickPick === 'trail') {
      // Trail challenges use a dedicated quick-pick filter so trail and mountain races can both match.
    } else if (quickPick === 'kids') {
      if (familyInput) familyInput.checked = true;
    } else if (quickPick === 'route') {
      if (routeInput) routeInput.checked = true;
    }
  };

  const removeQuickPick = (quickPick: string) => {
    if (quickPick === 'deadlines-soon') {
      if (deadlineSelect?.value === 'within-14') deadlineSelect.value = '';
      if (sortSelect?.value === 'registration-deadline') sortSelect.value = 'date';
    } else if (quickPick === 'budget') {
      if (registrationFeeSelect?.value === '20') registrationFeeSelect.value = '';
    } else if (quickPick === 'first-race') {
      if (surfaceSelect && ['cesta', 'cesta/trail'].includes(normalize(surfaceSelect.value))) surfaceSelect.value = '';
    } else if (quickPick === 'trail') {
      // No visible field is owned by this quick pick.
    } else if (quickPick === 'kids') {
      if (familyInput?.checked) familyInput.checked = false;
    } else if (quickPick === 'route') {
      if (routeInput?.checked) routeInput.checked = false;
    }
  };

  const toggleQuickPick = (quickPick: string) => {
    const isActive = getActiveQuickPickValues().includes(quickPick);
    if (isActive) {
      selectedQuickPicks.delete(quickPick);
      removeQuickPick(quickPick);
    } else {
      selectedQuickPicks.add(quickPick);
      applyQuickPick(quickPick);
    }
  };

  let searchAnalyticsTimer: number | undefined;

  const trackSearchResult = (filters: ReturnType<typeof getFilters>, resultsCount: number) => {
    if (!state.userInteracted) return;

    const query = (searchInput?.value ?? '').trim();
    const analyticsFilters = {
      search: filters.search,
      month: filters.month,
      region: filters.region,
      surface: filters.surface,
      distanceFilter: filters.distance === 'all' ? '' : filters.distance,
      priceFilter: filters.registrationFee,
      deadlineFilter: filters.deadlineFilter,
      sortBy: filters.sort,
      familyFriendly: filters.family,
      raceDayRegistration: filters.dayOfRegistration,
      hasRoute: filters.route,
      elevationFilter: filters.elevation,
      quickPicks: filters.quickPick
    };
    const filtersJson = filtersToAnalyticsJson(analyticsFilters);
    const signature = JSON.stringify({ query, filtersJson, resultsCount });
    if (signature === state.lastLoggedSearchSignature) return;

    if (searchAnalyticsTimer) window.clearTimeout(searchAnalyticsTimer);
    searchAnalyticsTimer = window.setTimeout(() => {
      if (signature === state.lastLoggedSearchSignature) return;
      state.lastLoggedSearchSignature = signature;

      const commonPayload = {
        event_type: 'search_performed' as const,
        search_query: query || undefined,
        filters_json: filtersJson,
        results_count: resultsCount,
        language: locale.language
      };
      trackStkEvent(commonPayload);
      if (resultsCount === 0) {
        trackStkEvent({ ...commonPayload, event_type: 'no_results_search' as const, results_count: 0 });
      }
    }, 700);
  };

  const updateAdvancedFiltersSummary = (filters = getFilters()) => {
    if (!advancedFiltersSummary) return;
    const activeCount = [
      Boolean(filters.surface),
      Boolean(filters.registrationFee),
      Boolean(filters.deadlineFilter),
      filters.family,
      filters.dayOfRegistration,
      filters.route,
      Boolean(filters.elevation)
    ].filter(Boolean).length;

    advancedFiltersSummary.textContent = activeCount ? `${locale.advancedFiltersLabel} (${activeCount})` : locale.advancedFiltersLabel;
  };

  const getPublicUpcomingEvents = (items: ApiRecord[]) => {
    const today = todayStart();

    return items
      .map((item): RaceEvent | null => {
        const event = mapPublicRaceEvent(item, activeYear, today);
        if (!event) return null;

        return {
          ...event,
          month: event.date.slice(5, 7),
          datum: event.date,
          searchText: normalize(`${event.naziv_prireditve} ${event.place}`)
        };
      })
      .filter((event): event is RaceEvent => Boolean(event))
      .sort(compareByDate);
  };

  const renderOptions = (select: HTMLSelectElement | null, values: string[], fallbackLabel: string, labelForValue = (value: string) => value) => {
    if (!select) return;
    select.innerHTML = `<option value="">${escapeHtml(fallbackLabel)}</option>${values
      .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labelForValue(value))}</option>`)
      .join('')}`;
    select.disabled = values.length === 0;
  };


  const formatSurfaceOption = (value: string) => locale.formatSurface(value);




  const getStorage = () => { try { return window.localStorage; } catch { return null; } };
  const preferenceLanguage = locale.language;
  const getPreferenceRegions = () => [...document.querySelectorAll<HTMLInputElement>('[data-preference-region]')].filter((input) => input.checked).map((input) => input.value);
  const collectPreferenceControls = (active = racePreferences.active) => validateRacePreferences({
    version: 1,
    distanceBuckets: preferenceDistanceInputs.filter((input) => input.checked).map((input) => input.dataset.preferenceDistance),
    surfaceCategories: preferenceSurfaceInputs.filter((input) => input.checked).map((input) => input.dataset.preferenceSurface),
    regions: getPreferenceRegions(),
    familyFriendly: Boolean(preferenceFamilyInput?.checked),
    active
  });
  const hasPreferences = () => Boolean(validateRacePreferences(racePreferences)?.distanceBuckets.length || validateRacePreferences(racePreferences)?.surfaceCategories.length || validateRacePreferences(racePreferences)?.regions.length || validateRacePreferences(racePreferences)?.familyFriendly);
  let personalizedResultsLastSignature = '';
  const setPreferenceMessage = (message: string) => { if (preferenceMessageElement) preferenceMessageElement.textContent = message; };
  const updatePreferenceSortOption = () => { const option = sortSelect?.querySelector<HTMLOptionElement>('option[value="my-races"]'); if (option) option.disabled = !hasPreferences(); };
  const syncPreferenceControls = () => {
    preferenceDistanceInputs.forEach((input) => { input.checked = racePreferences.distanceBuckets.includes(input.dataset.preferenceDistance as any); });
    preferenceSurfaceInputs.forEach((input) => { input.checked = racePreferences.surfaceCategories.includes(input.dataset.preferenceSurface as any); });
    if (preferenceFamilyInput) preferenceFamilyInput.checked = racePreferences.familyFriendly;
    document.querySelectorAll<HTMLInputElement>('[data-preference-region]').forEach((input) => { input.checked = racePreferences.regions.includes(input.value); });
  };
  const setPreferenceFormFocusable = (enabled: boolean) => {
    preferenceFormElement?.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>('input, button, select, textarea').forEach((control) => { control.tabIndex = enabled ? 0 : -1; });
  };
  const setPreferencePanelState = (state: RacePreferencePanelState, focusTarget: 'none' | 'compact' | 'edit' | 'form' = 'none') => {
    const hasSaved = hasPreferences();
    const summary = summarizeRacePreferences(racePreferences, preferenceLanguage);
    preferencePanel?.setAttribute('data-preferences-ready', 'true');
    preferencePanel?.setAttribute('data-preferences-state', state);
    updatePreferenceSortOption();
    if (sortSelect && racePreferences.active && hasSaved) sortSelect.value = 'my-races';
    const showForm = state === 'editing';
    if (preferenceCompactElement) preferenceCompactElement.hidden = showForm;
    if (preferenceFormElement) preferenceFormElement.hidden = !showForm;
    setPreferenceFormFocusable(showForm);
    if (preferenceEmptyTextElement) { preferenceEmptyTextElement.hidden = state !== 'empty' || showForm; preferenceEmptyTextElement.textContent = state === 'empty' && !showForm ? locale.preferenceEmptyText : ''; }
    if (preferenceStateTextElement) { preferenceStateTextElement.hidden = state === 'empty' || showForm; preferenceStateTextElement.textContent = state === 'active' ? String(locale.messages.preferencesActive) : state === 'inactive' ? String(locale.messages.preferencesStored) : ''; }
    if (preferenceSummaryElement) { preferenceSummaryElement.hidden = state === 'empty' || showForm; preferenceSummaryElement.textContent = state === 'empty' || showForm ? '' : summary.visible; preferenceSummaryElement.setAttribute('aria-label', state === 'empty' || showForm ? '' : (summary.accessible || summary.visible)); }
    if (activatePreferencesButton) { activatePreferencesButton.hidden = state !== 'inactive'; activatePreferencesButton.textContent = locale.showRacesForMeLabel; }
    if (editPreferencesButton) { editPreferencesButton.hidden = state === 'editing'; editPreferencesButton.textContent = hasSaved ? locale.editPreferencesShortLabel : locale.setPreferencesLabel; editPreferencesButton.setAttribute('aria-expanded', String(state === 'editing')); }
    if (showAllPreferencesButton) showAllPreferencesButton.hidden = state !== 'active';
    if (resetPreferencesButton) { resetPreferencesButton.hidden = state !== 'inactive'; resetPreferencesButton.textContent = locale.resetLabel; }
    if (cancelPreferencesButton) cancelPreferencesButton.hidden = state !== 'editing';
    if (resetPreferencesFormButton) resetPreferencesFormButton.hidden = state !== 'editing' || !hasSaved;
    if (focusTarget === 'form') preferenceFormHeading?.focus();
    else if (focusTarget === 'edit') editPreferencesButton?.focus();
    else if (focusTarget === 'compact') preferenceCompactElement?.focus();
  };
  const refreshPreferencePanel = (focusTarget: 'none' | 'compact' | 'edit' | 'form' = 'none') => {
    const state = getRacePreferencePanelState({ preferences: racePreferences, editing: preferencesEditing });
    setPreferencePanelState(state, focusTarget);
  };
  const persistPreferenceActiveState = (active: boolean) => {
    const validated = validateRacePreferences({ ...racePreferences, active });
    if (!validated) return;
    const result = writeRacePreferences(getStorage(), validated);
    racePreferences = result.preferences;
    preferencesPersistent = result.persistent;
  };
  const populatePreferenceRegions = () => {
    if (!preferenceRegionList) return;
    const regions = [...new Set([...state.events.map((event) => event.region).filter(Boolean), ...racePreferences.regions])].sort((a,b)=>a.localeCompare(b,'sl-SI'));
    preferenceRegionList.innerHTML = regions.map((region, index) => `<label><input id="${buildPreferenceRegionInputId(locale.language, index)}" type="checkbox" value="${escapeHtml(region)}" data-preference-region /> <span>${escapeHtml(region)} </span></label>`).join('');
    syncPreferenceControls();
    refreshPreferencePanel();
  };
  const populateFilters = () => {
    const months = [...new Set(state.events.map((event) => event.month))].sort();
    const regions = [...new Set(state.events.map((event) => event.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'sl-SI'));
    const surfaces = [...new Set(state.events.map((event) => event.surface).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'sl-SI'));

    renderOptions(monthSelect, months, locale.allMonthsLabel, monthLabel);
    renderOptions(regionSelect, regions, locale.allRegionsLabel);
    renderOptions(surfaceSelect, surfaces, locale.allSurfacesLabel, formatSurfaceOption);
    populatePreferenceRegions();
  };

  const renderEmptyState = (title: string, message: string, pill = locale.emptyDefaultPill, showClearAction = false) => {
    if (!resultsElement) return;
    resultsElement.innerHTML = `
      <article class="event-card search-empty-card">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <div class="event-meta">
          <span class="pill">${escapeHtml(pill)}</span>
        </div>
        ${showClearAction ? `<button class="button button-small button-secondary-light empty-clear-button" type="button" data-clear-filters>${locale.clearFiltersLabel}</button>` : ''}
      </article>
    `;
  };

  const formatDistances = formatSloveneDistances;

  const getRenderableVoteUrl = (event: RaceEvent) => {
    if (!event.voteUrl) return '';
    const validation = isVoteUrlSafeForEvent(event, event.voteUrl);
    if (validation.safe) return event.voteUrl;
    if (import.meta.env.DEV) {
      console.warn('[STK vote_url] skipped rendering vote_url', {
        title: event.title,
        date: event.date,
        reason: validation.reason ?? 'unverified'
      });
    }
    return '';
  };

  const renderEvent = (event: RaceEvent) => {
    const preferenceMatch = preferenceMatches.get(event.id);
    const formattedSurface = formatSurface(event.surface);
    const metaItems = [
      formattedSurface && `<span>${escapeHtml(formattedSurface)}</span>`,
      event.distances && `<span>${escapeHtml(formatDistances(event.distances))}</span>`,
      event.startTime && `<span>${locale.startLabel} ${escapeHtml(formatStartTime(event.startTime))}</span>`
    ].filter(Boolean).join('');


    const preferenceReasonLabels = preferenceMatch ? getRacePreferenceReasonLabels(preferenceMatch.reasonKeys, locale.language) : [];
    const preferenceReasons = preferenceReasonLabels.length ? `<div class="preference-reasons" aria-label="${locale.preferenceReasonsAriaLabel}">${preferenceReasonLabels.map((reason) => `<span class="pill preference-reason-pill">${escapeHtml(reason)}</span>`).join('')}</div>` : '';
    const calendarOptions = renderCalendarOptions({
      title: event.title,
      date: event.date,
      location: event.place,
      noticeUrl: event.noticeUrl,
      registrationUrl: event.registrationUrl
    });
    const detailPath = locale.buildDetailPath(event);
    const renderableVoteUrl = getRenderableVoteUrl(event);
    const additionalDataChips = renderAdditionalDataChips(event.additionalData, escapeHtml, { eventDate: event.date, eventId: event.id, eventName: event.title, language: locale.language, kidsRaces: event.kidsRaces, includeRoute: false });
    const routeAction = event.additionalData?.routeUrl
      ? { url: event.additionalData.routeUrl, priority: 3, html: `<a href="${escapeHtml(event.additionalData.routeUrl)}" target="_blank" rel="noopener noreferrer" data-stk-track="external-link" data-stk-action="trasa" data-stk-event-id="${escapeHtml(event.id)}" data-stk-event-name="${escapeHtml(event.title)}" data-stk-event-date="${escapeHtml(event.date)}" data-analytics-link-type="trasa">${locale.routeLabel}</a>` }
      : null;
    // buildPrimaryActions(event, locale.language).map(renderPrimaryActionLink) remains the shared organizer-action renderer.
    const organizerActions = buildPrimaryActions(event, locale.language);
    const registrationActions = organizerActions.filter((action) => action.kind === 'registration');
    const noticeActions = organizerActions.filter((action) => action.kind !== 'registration');
    const primaryLinks = [
      `<a class="button button-small button-primary search-detail-cta" href="${escapeHtml(detailPath)}">${locale.detailLabel}</a>`,
      ...registrationActions.map(renderPrimaryActionLink),
      `<button class="button button-small button-secondary-light saved-race-button saved-race-button-compact" type="button" data-saved-race-button data-event-id="${escapeHtml(getStableEventId(event))}" data-event-year="${escapeHtml(activeYear)}" data-event-date="${escapeHtml(event.date)}" data-event-title="${escapeHtml(event.title)}" data-language="${locale.language}" aria-pressed="false" aria-label="${locale.saveRaceLabel}"><span class="saved-race-star" aria-hidden="true">☆</span><span data-saved-race-label>${locale.saveRaceLabel}</span></button>`,
    ].filter(Boolean).join('');
    const primaryDestinationKeys = new Set(registrationActions.map((action) => normalizeSecondaryDestination(action.url)).filter(Boolean));
    const secondaryActionCandidates: SecondaryMenuAction[] = [
      ...noticeActions.map((action) => ({ url: action.url, priority: 2, html: `<a href="${escapeHtml(action.url)}" target="_blank" rel="noopener noreferrer" data-analytics-link-type="${escapeHtml(action.analyticsType)}"><span class="action-icon">${renderActionIcon('notice')}</span><span>${escapeHtml(action.label)}</span></a>` })),
      routeAction,
      renderableVoteUrl && { url: renderableVoteUrl, priority: 4, html: `<a href="${escapeHtml(renderableVoteUrl)}" target="_blank" rel="noopener noreferrer" data-analytics-action="vote" aria-label="${escapeHtml(locale.voteAriaLabel(event.title))}">${locale.voteLabel}</a>` },
      ...calendarOptions
    ].filter(Boolean) as SecondaryMenuAction[];
    const seenSecondaryDestinations = new Set(primaryDestinationKeys);
    const moreOptions = secondaryActionCandidates
      .sort((a, b) => a.priority - b.priority)
      .filter((action) => {
        const key = normalizeSecondaryDestination(action.url);
        if (!key || seenSecondaryDestinations.has(key)) return false;
        seenSecondaryDestinations.add(key);
        return true;
      })
      .map((action) => action.html)
      .join('');
    const secondaryLinks = moreOptions
      ? `<details class="search-event-more-menu"><summary class="button button-small button-secondary-light">${locale.moreMenuLabel}</summary><div class="search-event-more-menu-options">${moreOptions}</div></details>`
      : '';

    return `
      <article class="event-card search-event-card search-event-row" data-analytics-placement="finder_results" data-event-row="${escapeHtml(event.row)}" data-analytics-event-id="${escapeHtml(event.id)}" data-analytics-event-name="${escapeHtml(event.title)}" data-analytics-event-date="${escapeHtml(event.date)}" data-analytics-event-year="${escapeHtml(activeYear)}">
        <div class="search-event-date search-event-row-date">
          <time class="event-card-date" datetime="${escapeHtml(event.date)}" aria-label="${escapeHtml(formatDate(event.date))}">${escapeHtml(formatDateBadge(event.date))}</time>
          ${event.familyFriendly ? `<span class="pill pill-family">${locale.familyFriendlyLabel}</span>` : ''}
        </div>
        <div class="search-event-row-main">
        <h3 class="search-event-title"><a class="search-event-title-link" href="${escapeHtml(detailPath)}">${escapeHtml(event.title)}</a></h3>
        ${[event.place, event.region].filter(Boolean).length ? `<p class="search-event-location">${[event.place, event.region].filter(Boolean).map(escapeHtml).join(' · ')}</p>` : ''}
        ${metaItems ? `<div class="search-event-facts">${metaItems}</div>` : ''}
        ${additionalDataChips}
        ${preferenceReasons}
        </div>
        <div class="search-event-row-actions">
        ${primaryLinks ? `<div class="search-event-primary-actions">${primaryLinks}</div>` : ''}
        ${secondaryLinks ? `<div class="search-event-secondary-actions">${secondaryLinks}</div>` : ''}
        </div>
      </article>
    `;
  };

  const renderResults = () => {
    const filters = getFilters();
    updateAdvancedFiltersSummary(filters);

    if (!state.apiAvailable) {
      setStatus(String(locale.messages.dataUnavailableStatus));
      setCount(String(locale.messages.dataUnavailableCount));
      renderEmptyState(String(locale.messages.dataUnavailableTitle), String(locale.messages.dataUnavailableMessage), String(locale.messages.calendarPill));
      if (moreElement) moreElement.hidden = true;
      updateQuickPickStates();
      return;
    }

    if (!state.events.length) {
      setStatus(String(locale.messages.noEventsStatus));
      setCount(String(locale.messages.zeroCount));
      renderEmptyState(String(locale.messages.noEventsTitle), String((locale.messages.noEventsMessage as (year: string | number) => string)(activeYear)), activeYear);
      if (moreElement) moreElement.hidden = true;
      return;
    }

    state.filtered = state.events.filter((event) => {
      if (filters.search && !event.searchText.includes(filters.search)) return false;
      if (filters.month && event.month !== filters.month) return false;
      if (filters.region && event.region !== filters.region) return false;
      if (filters.surface && event.surface !== filters.surface) return false;
      if (!matchesRaceDistanceFilter(event.distances, filters.distance)) return false;
      if (filters.registrationFee && !matchesRegistrationFeeFilter(event, filters.registrationFee)) return false;
      if (filters.deadlineFilter && !matchesDeadlineFilter(event, filters.deadlineFilter)) return false;
      if (filters.elevation && !matchesElevationFilter(event, filters.elevation)) return false;
      if (filters.family && !event.familyFriendly) return false;
      if (filters.dayOfRegistration && !hasDayOfRegistration(event)) return false;
      if (filters.route && !hasRouteData(event)) return false;
      if (filters.quickPick.split(',').includes('trail') && !matchesTrailChallengeQuickPick(event)) return false;
      return true;
    });
    preferenceMatches.clear();
    let personalizedResultsSignature = '';
    if (filters.sort === 'my-races' && hasPreferences()) {
      const matches = rankRacesForPreferences({ events: state.filtered as any, preferences: racePreferences });
      matches.forEach((match) => preferenceMatches.set(match.event.id, match));
      state.filtered = matches.map((match) => match.event as unknown as RaceEvent);
      personalizedResultsSignature = JSON.stringify({ filters: { ...filters, search: '' }, results: matches.map((match) => match.event.id) });
    } else {
      state.filtered = sortEvents(state.filtered, filters.sort);
    }

    const count = state.filtered.length;
    const visibleEvents = state.filtered.slice(0, state.visibleCount);
    const visibleCount = visibleEvents.length;

    setCount(filters.sort === 'my-races' ? String((locale.messages.myRacesCount as (count: string | number) => string)(count)) : count > visibleCount ? locale.formatVisibleResultCount(visibleCount, count) : locale.formatResultCount(count));
    const statusMessage = filters.quickPick
      ? locale.messages.quickPickStatus
      : filters.deadlineFilter
        ? locale.messages.deadlineStatus
        : getRaceFinderResultDescription(filters.sort, preferenceLanguage);
    setStatus(String(statusMessage));
    if (additionalNoteElement) additionalNoteElement.hidden = !additionalDataEnabled || !state.events.some((event) => hasRenderableAdditionalData(event.additionalData));
    trackSearchResult(filters, count);
    if (personalizedResultsSignature && personalizedResultsSignature !== personalizedResultsLastSignature) {
      personalizedResultsLastSignature = personalizedResultsSignature;
      const { search, ...safePersonalizedFilters } = filters;
      trackStkEvent({
        event_type: 'personalized_results_used',
        filters_json: filtersToAnalyticsJson({ ...safePersonalizedFilters, sortBy: 'my-races' }),
        results_count: count,
        language: locale.language,
        placement: 'personalized_results'
      });
    }

    if (!count) {
      updateQuickPickStates();
      if (filters.sort === 'my-races') {
        renderEmptyState(String(locale.messages.noPreferenceMatchesTitle), String(locale.messages.noPreferenceMatchesMessage), String(locale.messages.myRacesPill), false);
        resultsElement?.querySelector('.event-meta')?.insertAdjacentHTML('afterend', `<div class="event-actions"><button class="button button-small button-secondary-light" type="button" data-edit-preferences>${locale.messages.editPreferences}</button><button class="button button-small button-primary" type="button" data-show-all-races>${locale.messages.showAllRaces}</button></div>`);
      } else {
        renderEmptyState(String(locale.messages.noFilterMatchesTitle), filters.quickPick ? String(locale.messages.tooManyFiltersMessage) : String(locale.messages.removeFiltersMessage), String(locale.messages.filtersPill), true);
      }
      if (moreElement) moreElement.hidden = true;
      return;
    }

    if (resultsElement) {
      resultsElement.innerHTML = visibleEvents.map(renderEvent).join('');
      initSavedRaceButtons(resultsElement);
    }
    if (moreElement) moreElement.hidden = visibleCount >= count;
    updateQuickPickStates();
  };

  const loadEvents = async () => {
    setStatus(String(locale.messages.loading));

    try {
      const response = await fetch(API_URL, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`API status ${response.status}`);

      const payload = await response.json();
      let events = getPublicUpcomingEvents(toArray(payload));

      try {
        if (additionalDataEnabled) {
          events = attachAdditionalDataByMasterRow(events, await fetchAdditionalEventData(activeYear), activeYear);
        }
      } catch (error) {
        console.warn(`${locale.emptyDefaultPill} additional data skipped`, error);
      }

      if (activeYear === DEFAULT_PUBLIC_YEAR) {
        try {
          const topResponse = await fetch(TOP_API_URL, { headers: { Accept: 'application/json' } });
          if (topResponse.ok) {
            const topPayload = await topResponse.json();
            events = enrichEventsWithVoteUrls(events, toArray(topPayload));
          }
        } catch (error) {
          console.warn(`${locale.emptyDefaultPill} vote enrichment skipped`, error);
        }
      }

      state.events = events;
      state.apiAvailable = true;
      populateFilters();
      applyFinderUrlStateToControls(stateForYear(initialUrlState, activeYear));
      renderResults();
      syncUrlFromControls();
    } catch (error) {
      console.error(`${locale.emptyDefaultPill} API error`, error);
      state.apiAvailable = false;
      renderResults();
    }
  };

  const resetVisibleResults = () => {
    state.userInteracted = true;
    state.visibleCount = PAGE_SIZE;
    renderResults();
    syncUrlFromControls();
  };

  const clearFilters = () => {
    formElement?.reset();
    directFinderState = clearFinderUrlState(activeYear);
    selectedQuickPicks.clear();
    updateQuickPickStates();
    syncUrlFromControls(clearFinderUrlState(activeYear));
    resetVisibleResults();
  };

  savePreferencesButton?.addEventListener('click', () => {
    const next = collectPreferenceControls(true);
    if (!next || (!next.distanceBuckets.length && !next.surfaceCategories.length && !next.regions.length && !next.familyFriendly)) { setPreferenceMessage(String(locale.messages.choosePreference)); return; }
    const result = writeRacePreferences(getStorage(), next);
    racePreferences = result.preferences; preferencesPersistent = result.persistent;
    preferencesEditing = false;
    setPreferenceMessage(preferencesPersistent ? String(locale.messages.preferencesSaved) : String(locale.messages.preferencesSessionOnly));
    if (sortSelect) sortSelect.value = 'my-races';
    syncPreferenceControls();
    refreshPreferencePanel('compact');
    resetVisibleResults();
  });
  activatePreferencesButton?.addEventListener('click', () => {
    persistPreferenceActiveState(true);
    preferencesEditing = false;
    if (sortSelect) sortSelect.value = 'my-races';
    refreshPreferencePanel('compact');
    resetVisibleResults();
  });
  editPreferencesButton?.addEventListener('click', () => {
    previousPreferencePanelState = getRacePreferencePanelState({ preferences: racePreferences, editing: false });
    preferencesEditing = true;
    syncPreferenceControls();
    refreshPreferencePanel('form');
  });
  cancelPreferencesButton?.addEventListener('click', () => {
    preferencesEditing = false;
    syncPreferenceControls();
    setPreferencePanelState(previousPreferencePanelState, 'edit');
  });
  const resetPreferenceFeature = () => {
    resetRacePreferences(getStorage());
    racePreferences = validateRacePreferences({ version: 1, distanceBuckets: [], surfaceCategories: [], regions: [], familyFriendly: false, active: false })!;
    preferencesPersistent = false;
    preferencesEditing = false;
    if (sortSelect?.value === 'my-races') sortSelect.value = 'date';
    syncPreferenceControls();
    refreshPreferencePanel('compact');
    setPreferenceMessage(String(locale.messages.preferencesReset));
    resetVisibleResults();
  };
  resetPreferencesButton?.addEventListener('click', resetPreferenceFeature);
  resetPreferencesFormButton?.addEventListener('click', resetPreferenceFeature);
  sortSelect?.addEventListener('change', () => {
    if (!hasPreferences()) { refreshPreferencePanel(); return; }
    persistPreferenceActiveState(sortSelect.value === 'my-races');
    preferencesEditing = false;
    refreshPreferencePanel();
  });

  let searchUrlTimer: number | undefined;
  searchInput?.addEventListener('input', () => {
    state.userInteracted = true;
    state.visibleCount = PAGE_SIZE;
    updateDirectFinderStateFromControl(searchInput);
    if (searchUrlTimer) window.clearTimeout(searchUrlTimer);
    searchUrlTimer = window.setTimeout(() => {
      renderResults();
      syncUrlFromControls();
    }, 250);
  });
  formElement?.addEventListener('input', (event) => {
    if (event.target === searchInput) return;
    updateDirectFinderStateFromControl(event.target);
    resetVisibleResults();
  });
  formElement?.addEventListener('change', (event) => {
    if (event.target === searchInput) return;
    updateDirectFinderStateFromControl(event.target);
    resetVisibleResults();
  });
  formElement?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (searchUrlTimer) window.clearTimeout(searchUrlTimer);
    resetVisibleResults();
  });

  showMoreButton?.addEventListener('click', () => {
    state.visibleCount += PAGE_SIZE;
    renderResults();
  });

  quickPickButtons.forEach((button) => {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      state.userInteracted = true;
      state.visibleCount = PAGE_SIZE;
      toggleQuickPick(button.dataset.quickPick ?? '');
      rebuildControlsFromFinderState({ ...directFinderState, year: activeYear, quick: [...selectedQuickPicks] });
      renderResults();
      syncUrlFromControls();
    });
  });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-clear-filters]') : null;
    if (target) clearFilters();
    const removeFilterTarget = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-remove-filter]') : null;
    if (removeFilterTarget) removeActiveFilterChip(removeFilterTarget.dataset.removeFilter ?? '', removeFilterTarget.dataset.removeFilterValue ?? '');
    const editTarget = event.target instanceof Element ? event.target.closest('[data-edit-preferences]') : null;
    if (editTarget && editTarget !== editPreferencesButton) { previousPreferencePanelState = getRacePreferencePanelState({ preferences: racePreferences, editing: false }); preferencesEditing = true; syncPreferenceControls(); refreshPreferencePanel('form'); }
    const showAllTarget = event.target instanceof Element ? event.target.closest('[data-show-all-races]') : null;
    if (showAllTarget) { if (sortSelect) sortSelect.value = 'date'; persistPreferenceActiveState(false); preferencesEditing = false; refreshPreferencePanel(); resetVisibleResults(); }
  });

  copyLinkButton?.addEventListener('click', async () => {
    const canonicalUrl = new URL(canonicalPathForState(), window.location.origin).toString();
    if (!navigator.clipboard?.writeText) { if (copyLinkStatus) copyLinkStatus.textContent = String(locale.messages.copyFallback); return; }
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      if (copyLinkStatus) copyLinkStatus.textContent = String(locale.messages.copySuccess);
    } catch {
      if (copyLinkStatus) copyLinkStatus.textContent = String(locale.messages.copyFallback);
    }
  });

  window.addEventListener('popstate', restoreFromCurrentUrl);
  window.addEventListener('pageshow', (event) => { if (event.persisted) restoreFromCurrentUrl(); });

  updateAdvancedFiltersSummary();
  initializeYearUi();
  syncPreferenceControls();
  refreshPreferencePanel();
  loadEvents();

};
