import { trackStkEvent, trackStkPageLoadEventOnce } from './lib/stkAnalytics.js';
import { buildGoogleCalendarEventUrl, buildIcsCalendar, buildIcsDataUrl, buildIcsFilename, buildOutlookCalendarEventUrl, buildRegistrationDeadlineCalendarInput, type MultiIcsCalendarEventInput } from './utils-calendar.js';
import { countSavedRaceStatuses, filterSavedRaceResolutionsByStatus, getInitialMyRacesView, getSavedRaceDetailPath, getUpcomingSavedRaceDeadlines, resolveSavedRaces, sortResolvedSavedRaces, type MyRacesStatusFilter } from './utils-my-races.js';
import { getSavedRaceKey, getSavedRaceStatus, isRaceSaved, isSavedRaceStatus, readSavedRaces, removeSavedRaceFromStorage, SAVED_RACE_STATUSES, SAVED_RACE_STATUS_COPY, SAVED_RACE_STATUS_LABELS, setSavedRaceStatusInStorage, type MinimalStorage, type SavedRace, type SavedRaceStatus } from './utils-saved-races.js';
import { buildMasterApiPath, DEFAULT_PUBLIC_YEAR, isAdditionalDataEnabledForYear, SUPPORTED_PUBLIC_YEARS, type PublicYear } from './utils-public-year.js';
import { getStableEventId, mapPublicRaceEvent, toApiRecords } from './utils-event-detail.js';
import { buildPrimaryActions } from './utils-race-detail-view.js';
import { renderActionIcon } from './utils-action-icons.js';
import { getTodayIsoInLjubljana, isCompletionAllowed } from './utils-date.js';
import { backfillCompletedRaceSnapshots, getCompletedRaceSnapshotKey, upsertCompletedRaceSnapshot } from './utils-completed-snapshots.js';
import { attachAdditionalDataByMasterRow, fetchAdditionalEventData, type AdditionalEventData } from './utils-additional.js';
import { buildRegistrationDeadlineViews, getRegistrationDeadlineCssState, type RegistrationDeadlineView } from './utils-registration-deadlines.js';
import { formatSeasonRegionLabel, formatSeasonSurfaceLabel, formatSloveneCount, getNextAchievement, getNextSavedRace, getSeasonAchievements, getSeasonRegionProgress, getSeasonSummary, normalizeBasicSurface, type AchievementKey, type BasicSurface } from './utils-my-season.js';
import { dispatchSavedRacesChanged } from './saved-races-events.js';
import { getSloveniaMapRegions, renderSloveniaRegionsMap } from './utils-slovenia-map.js';

const API_BASE = 'https://stk-master-api.igor-kalsek.workers.dev';
type MyRacesRequestCache = { master: Map<PublicYear, Promise<unknown>>; additional: Map<PublicYear, Promise<AdditionalEventData[]>> };
const pageDataCache = new WeakMap<HTMLElement, MyRacesRequestCache>();
const pageRenderVersions = new WeakMap<object, number>();
export const beginMyRacesRender = (mount: object) => {
  const renderVersion = (pageRenderVersions.get(mount) ?? 0) + 1;
  pageRenderVersions.set(mount, renderVersion);
  return () => pageRenderVersions.get(mount) === renderVersion;
};
const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);
const formatDate = (value: string, language: 'sl' | 'en') => value ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'sl-SI', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : '';
const SLOVENIAN_GENITIVE_MONTHS = ['januarja', 'februarja', 'marca', 'aprila', 'maja', 'junija', 'julija', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'] as const;

const ACHIEVEMENT_NAMES: Record<'sl' | 'en', Record<AchievementKey, string>> = {
  sl: { debut: 'Debi', five: 'Petica', ten: 'Desetka', nomad: 'Nomad', 'all-terrain': 'Terenec', veteran: 'Veteran' },
  en: { debut: 'Debut', five: 'Five', ten: 'Ten', nomad: 'Nomad', 'all-terrain': 'All-terrain', veteran: 'Veteran' }
};
const SURFACE_NAMES: Record<'sl' | 'en', Record<BasicSurface, string>> = {
  sl: { road: 'Cesta', trail: 'Trail', mountain: 'Gorski' }, en: { road: 'Road', trail: 'Trail', mountain: 'Mountain' }
};

const decorativeSvg = (body: string, className = '') => `<svg class="${className}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const renderSurfaceStampIcon = (surface: BasicSurface | null) => surface === 'trail'
  ? decorativeSvg('<path data-surface-icon="trail" d="M3 18c3-7 5 2 8-7s5 4 10-5"/><path d="m17 4 4 2-2 4"/>', 'season-stamp-icon')
  : surface === 'mountain'
    ? decorativeSvg('<path data-surface-icon="mountain" d="m2 19 7-12 3 5 3-4 7 11Z"/><path d="m7.5 9.5 1.5 2 1.5-2"/>', 'season-stamp-icon')
    : surface === 'road'
      ? decorativeSvg('<path data-surface-icon="road" d="M9 21 11 3M15 21 13 3M12 6v3m0 3v3m0 3v3"/>', 'season-stamp-icon')
      : decorativeSvg('<path data-surface-icon="other" d="M4 20c0-5 8-4 8-9V4m0 7c0 5 8 4 8 9M8 7l4-3 4 3"/>', 'season-stamp-icon');
const renderAchievementIcon = (key: AchievementKey) => {
  if (key === 'debut') return decorativeSvg('<path d="M5 21V4m0 1h12l-3 4 3 4H5"/><path d="m8 18 1.2 1.2L12 16"/>', 'achievement-symbol');
  if (key === 'five' || key === 'ten') return decorativeSvg(`<circle cx="12" cy="10" r="7"/><path d="m8 16-2 6 6-3 6 3-2-6"/><text x="12" y="13" text-anchor="middle" stroke="none" fill="currentColor" font-size="8" font-weight="900">${key === 'five' ? '5' : '10'}</text>`, 'achievement-symbol');
  if (key === 'nomad') return decorativeSvg('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>', 'achievement-symbol');
  if (key === 'all-terrain') return decorativeSvg('<path d="M2 19h20M3 16l4-5 3 3 4-8 7 10"/><path d="M5 19v-3m4 3v-2m4 2v-3"/>', 'achievement-symbol');
  return decorativeSvg('<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 13v4m-4 3h8"/>', 'achievement-symbol');
};

export const formatDeadlineDateAfterUntil = (value: string, language: 'sl' | 'en', includeYear = false) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) return '';
  if (language === 'sl') return `${day}. ${SLOVENIAN_GENITIVE_MONTHS[month - 1]}${includeYear ? ` ${year}` : ''}`;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', ...(includeYear ? { year: 'numeric' as const } : {}) }).format(date);
};

type Labels = Record<'updating' | 'pastLoading' | 'pastError' | 'pastEmpty' | 'nextDeadline' | 'deadlines' | 'viewRace' | 'earlyRegistration' | 'registrationDeadline' | 'addDeadline' | 'addRace' | 'daysLeft' | 'tomorrow' | 'today' | 'loading' | 'empty' | 'search' | 'upcoming' | 'other' | 'unresolved' | 'remove' | 'details' | 'google' | 'apple' | 'outlook' | 'apiError' | 'storageError' | 'local' | 'downloadAll' | 'downloadAllNote' | 'calendarError' | 'emptyFilter' | 'nextRace', string>;
const LABELS: Record<'sl' | 'en', Labels> = {
  sl: { updating: 'Posodabljamo podatke …', pastLoading: 'Nalagamo pretekle teke …', pastError: 'Preteklih tekov trenutno ni bilo mogoče naložiti.', pastEmpty: 'Ni preteklih tekov za prikaz.', nextDeadline: 'Naslednji prijavni rok', deadlines: 'Prijavni roki', viewRace: 'Prikaži v načrtu', earlyRegistration: 'Cenejša prijava do', registrationDeadline: 'Prijave do', addDeadline: 'Dodaj rok v koledar', addRace: 'Dodaj tek v koledar', daysLeft: 'še {n} dni', tomorrow: 'jutri', today: 'danes', loading: 'Nalagamo shranjene teke …', empty: 'Nimate še shranjenih tekov.', search: 'Odprite iskalnik tekov', upcoming: 'Moj tekaški načrt', other: 'Pretekli ali trenutno nerazrešeni teki', unresolved: 'Shranjena referenca', remove: 'Odstrani', details: 'Podrobnosti', google: 'Google koledar', apple: 'Apple/iCal', outlook: 'Outlook', apiError: 'API trenutno ni dosegljiv. Prikazane so osnovne shranjene reference.', storageError: 'Brskalnik trenutno ne dovoljuje dostopa do shranjenih tekov.', local: 'Shranjeno samo v tem brskalniku · brez računa in sinhronizacije med napravami.', downloadAll: 'Prenesi vse prihodnje teke (.ics)', downloadAllNote: 'Datoteka vsebuje prihodnje shranjene teke, razen tekov z oznako Opravljen.', emptyFilter: 'V tem statusu ni shranjenih tekov.', nextRace: 'Naslednji tek', calendarError: 'Koledarske datoteke trenutno ni bilo mogoče pripraviti.' },
  en: { updating: 'Updating race details …', pastLoading: 'Loading past races …', pastError: 'Past races could not be loaded right now.', pastEmpty: 'There are no past races to show.', nextDeadline: 'Next registration deadline', deadlines: 'Registration deadlines', viewRace: 'Show in race plan', earlyRegistration: 'Early registration until', registrationDeadline: 'Registration until', addDeadline: 'Add deadline to calendar', addRace: 'Add race to calendar', daysLeft: '{n} days left', tomorrow: 'tomorrow', today: 'today', loading: 'Loading saved races …', empty: 'You have not saved any races yet.', search: 'Open race finder', upcoming: 'My race plan', other: 'Past or currently unresolved races', unresolved: 'Saved reference', remove: 'Remove', details: 'Details', google: 'Google Calendar', apple: 'Apple/iCal', outlook: 'Outlook', apiError: 'The API is currently unavailable. Basic saved references are shown below.', storageError: 'The browser currently does not allow access to saved races.', local: 'Stored only in this browser · no account or cross-device sync.', downloadAll: 'Download all upcoming races (.ics)', downloadAllNote: 'The file contains upcoming saved races except races marked Completed.', emptyFilter: 'There are no saved races with this status.', nextRace: 'Next race', calendarError: 'The calendar file could not be prepared at this time.' }
};

export const getStorage = (): MinimalStorage | null => {
  try { return window.localStorage; } catch { return null; }
};

const renderLocalNotice = (labels: Labels) => `<p class="muted-note my-races-local-note"><span class="action-icon">${renderActionIcon('notes')}</span> ${escapeHtml(labels.local)}</p>`;

export const renderPrimaryActionLinks = (event: Parameters<typeof buildPrimaryActions>[0], language: 'sl' | 'en') => buildPrimaryActions(event, language)
  .map((action) => `<a class="button button-small ${action.kind === 'registration' ? 'my-race-action-registration' : 'button-secondary-light my-race-action-notice'}" href="${escapeHtml(action.url)}" target="_blank" rel="noopener noreferrer"><span class="action-icon">${renderActionIcon(action.kind === 'registration' ? 'registration' : 'notice')}</span> ${escapeHtml(action.label)}</a>`)
  .join('');


export const getExportableUpcomingRaceEvents = (items: ReturnType<typeof resolveSavedRaces>, language: 'sl' | 'en'): MultiIcsCalendarEventInput[] => {
  const seen = new Set<string>();
  return items
    .filter((item) => item.status === 'upcoming' && item.savedRace.status !== 'completed' && item.event && item.event.date && item.event.title)
    .filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    })
    .map((item) => {
      const event = item.event!;
      const stableId = item.key.split(':')[1] || event.id || item.key;
      return {
        uid: `${event.year}-${stableId}-${event.date.replace(/-/g, '')}@slovenski-tekaski-koledar`,
        title: event.title,
        date: event.date,
        location: [event.place, event.region].filter(Boolean).join(', '),
        noticeUrl: event.noticeUrl,
        registrationUrl: event.registrationUrl,
        language
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, language === 'en' ? 'en' : 'sl-SI'));
};


const renderStatusSelect = (race: SavedRace, language: 'sl' | 'en', todayIso = getTodayIsoInLjubljana()) => {
  const copy = SAVED_RACE_STATUS_COPY[language];
  const id = `status-${race.year}-${race.eventId}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `<label class="sr-only" for="${escapeHtml(id)}">${escapeHtml(copy.label)}</label><select id="${escapeHtml(id)}" class="race-status-select" data-my-race-status-select data-race-status-control data-race-status="${race.status}" data-event-id="${escapeHtml(race.eventId)}" data-event-year="${escapeHtml(race.year)}" data-event-date="${escapeHtml(race.date)}" data-event-title="${escapeHtml(race.title)}" data-language="${language}"><option value="">${escapeHtml(copy.empty)}</option>${SAVED_RACE_STATUSES.map((status) => `<option value="${status}"${status === 'completed' && !isCompletionAllowed(race.date, todayIso) ? ' disabled' : ''}${race.status === status ? ' selected' : ''}>${escapeHtml(SAVED_RACE_STATUS_LABELS[language][status])}</option>`).join('')}</select>`;
};
const renderStatusFilters = (counts: Record<SavedRaceStatus, number>, active: MyRacesStatusFilter, total: number, language: 'sl' | 'en') => `<div class="my-races-status-filters" role="group" aria-label="${escapeHtml(SAVED_RACE_STATUS_COPY[language].label)}">${[`<button class="my-races-status-filter" type="button" data-my-races-status-filter="all" aria-pressed="${active === 'all'}">${escapeHtml(SAVED_RACE_STATUS_COPY[language].all)} <span data-my-races-status-count="all">${total}</span></button>`, ...SAVED_RACE_STATUSES.map((status) => `<button class="my-races-status-filter" type="button" data-my-races-status-filter="${status}" aria-pressed="${active === status}">${escapeHtml(SAVED_RACE_STATUS_LABELS[language][status])} <span data-my-races-status-count="${status}">${counts[status]}</span></button>`)].join('')}</div>`;



type DeadlineEvent = Parameters<typeof buildRegistrationDeadlineCalendarInput>[0];
const renderDeadlineCalendarMenu = (input: DeadlineEvent, labels: Labels) => {
  const cal = buildRegistrationDeadlineCalendarInput(input);
  const google = buildGoogleCalendarEventUrl(cal);
  const ics = buildIcsDataUrl(cal);
  const outlook = buildOutlookCalendarEventUrl(cal);
  if (!google && !ics && !outlook) return '';
  return `<details class="deadline-calendar-menu"><summary>${escapeHtml(labels.addDeadline)}</summary><div class="deadline-calendar-actions">${google ? `<a data-calendar-action="google" href="${escapeHtml(google)}" target="_blank" rel="noopener">${escapeHtml(labels.google)}</a>` : ''}${ics ? `<a data-calendar-action="apple" href="${escapeHtml(ics)}" download="${escapeHtml(buildIcsFilename(cal))}">${escapeHtml(labels.apple)}</a>` : ''}${outlook ? `<a data-calendar-action="outlook" href="${escapeHtml(outlook)}" target="_blank" rel="noopener">${escapeHtml(labels.outlook)}</a>` : ''}</div></details>`;
};

const deadlineLabel = (deadline: RegistrationDeadlineView, labels: Labels) => deadline.kind === 'early' ? labels.earlyRegistration : labels.registrationDeadline;
const cardDeadlineLabel = (deadline: RegistrationDeadlineView, language: 'sl' | 'en') => language === 'en' ? (deadline.kind === 'early' ? 'Early entry' : 'Registration') : (deadline.kind === 'early' ? 'Cenejša prijava' : 'Prijava');
const conciseRelative = (deadline: RegistrationDeadlineView, labels: Labels, language: 'sl' | 'en') => deadline.state === 'today' ? labels.today : deadline.state === 'tomorrow' ? labels.tomorrow : language === 'en' ? `in ${deadline.daysRemaining} days` : `čez ${deadline.daysRemaining} dni`;
const cardDeadlineRelative = (deadline: RegistrationDeadlineView, labels: Labels, language: 'sl' | 'en') => deadline.state === 'today' ? labels.today : deadline.state === 'tomorrow' ? labels.tomorrow : language === 'en' ? `${deadline.daysRemaining} days left` : labels.daysLeft.replace('{n}', String(deadline.daysRemaining));

const getActiveCardDeadlines = (event: { date: string; additionalData?: AdditionalEventData | null }, todayIso: string) => buildRegistrationDeadlineViews({ todayIso, eventDate: event.date, registrationDeadline: event.additionalData?.registrationDeadline, earlyRegistrationDeadline: event.additionalData?.earlyRegistrationDeadline })
  .filter((item) => item.state === 'today' || item.state === 'tomorrow' || item.state === 'future')
  .sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'registration' ? -1 : 1));

const renderRaceCardDeadlines = (event: { id: string; year: string; title: string; date: string; registrationUrl: string; additionalData?: AdditionalEventData | null }, detailUrl: string, labels: Labels, language: 'sl' | 'en', todayIso: string) => {
  const deadlines = getActiveCardDeadlines(event, todayIso);
  if (!deadlines.length) return '';
  return `<section class="my-race-deadlines" data-my-race-deadlines><h4>${escapeHtml(labels.deadlines)}</h4>${deadlines.map((deadline) => `<div class="my-race-deadline ${getRegistrationDeadlineCssState(deadline)}" data-my-race-deadline data-deadline-kind="${deadline.kind}"><p>${escapeHtml(cardDeadlineLabel(deadline, language))} · ${escapeHtml(formatDeadlineDateAfterUntil(deadline.date, language))} · ${escapeHtml(cardDeadlineRelative(deadline, labels, language))}</p>${renderDeadlineCalendarMenu({ eventId: event.id, eventYear: event.year, eventTitle: event.title, deadlineKind: deadline.kind, deadlineDate: deadline.date, detailUrl, registrationUrl: event.registrationUrl, language }, labels)}</div>`).join('')}</section>`;
};

const renderRaceCalendarMenu = (event: { title: string; date: string; noticeUrl?: string; registrationUrl?: string }, location: string, labels: Labels, language: 'sl' | 'en') => {
  const cal = { title: event.title, date: event.date, location, noticeUrl: event.noticeUrl, registrationUrl: event.registrationUrl, language };
  const google = buildGoogleCalendarEventUrl(cal);
  const ics = buildIcsDataUrl(cal);
  const outlook = buildOutlookCalendarEventUrl(cal);
  if (!google && !ics && !outlook) return '';
  return `<details class="race-calendar-menu" data-race-calendar-menu><summary><span class="action-icon">${renderActionIcon('calendar')}</span> ${escapeHtml(labels.addRace)}</summary><div class="race-calendar-actions" data-race-calendar-actions>${google ? `<a data-calendar-action="google" href="${escapeHtml(google)}" target="_blank" rel="noopener">${escapeHtml(labels.google)}</a>` : ''}${ics ? `<a data-calendar-action="apple" href="${escapeHtml(ics)}" download="${escapeHtml(buildIcsFilename(cal))}">${escapeHtml(labels.apple)}</a>` : ''}${outlook ? `<a data-calendar-action="outlook" href="${escapeHtml(outlook)}" target="_blank" rel="noopener">${escapeHtml(labels.outlook)}</a>` : ''}</div></details>`;
};


const getRaceCardId = (key: string) => `my-race-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
const renderNextStepSummary = (items: ReturnType<typeof getUpcomingSavedRaceDeadlines>, races: ReturnType<typeof resolveSavedRaces>, labels: Labels, language: 'sl' | 'en', todayIso: string) => {
  const item = items[0];
  if (!item) {
    const race = getNextSavedRace(races);
    if (!race?.event) return '';
    const days = Math.max(0, Math.round((new Date(`${race.event.date}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime()) / 86400000));
    return `<section class="next-registration-deadline next-race-step" data-next-race-step><p class="next-registration-deadline-title"><span class="action-icon">${renderActionIcon('calendar')}</span> ${language === 'en' ? 'Next race' : 'Naslednji tek'}</p><p class="next-registration-deadline-race"><a href="#${escapeHtml(getRaceCardId(race.key))}">${escapeHtml(race.event.title)}</a></p><p class="next-registration-deadline-copy">${escapeHtml(formatDate(race.event.date, language))} · ${days === 0 ? labels.today : language === 'en' ? `${days} days to go` : `še ${days} dni`}</p><a class="next-registration-deadline-jump" href="#${escapeHtml(getRaceCardId(race.key))}">${escapeHtml(labels.viewRace)}</a></section>`;
  }
  const detailUrl = getSavedRaceDetailPath(item.event, language);
  return `<section class="next-registration-deadline" data-next-registration-deadline><p class="next-registration-deadline-title"><span class="action-icon">${renderActionIcon('calendar')}</span> ${escapeHtml(labels.nextDeadline)}</p><p class="next-registration-deadline-race"><a href="${escapeHtml(detailUrl)}">${escapeHtml(item.event.title)}</a></p><p class="next-registration-deadline-copy">${escapeHtml(deadlineLabel(item.deadline, labels))} ${escapeHtml(formatDeadlineDateAfterUntil(item.deadline.date, language))} · ${escapeHtml(conciseRelative(item.deadline, labels, language))}</p><a class="next-registration-deadline-jump" href="#${escapeHtml(getRaceCardId(item.key))}">${escapeHtml(labels.viewRace)}</a></section>`;
};

const renderExportToolbar = (events: MultiIcsCalendarEventInput[], labels: Labels) => events.length ? `<div class="my-races-toolbar"><div><button class="button button-small" type="button" data-download-upcoming-races-ics><span class="action-icon">${renderActionIcon('calendar')}</span> ${escapeHtml(labels.downloadAll)}</button><p>${escapeHtml(labels.downloadAllNote)}</p></div><p class="notice warning" data-calendar-export-status aria-live="polite" hidden></p></div>` : '';

const downloadUpcomingRacesIcs = (events: MultiIcsCalendarEventInput[], labels: Labels, filename: string, status: HTMLElement | null) => {
  if (!events.length) return;
  try {
    const ics = buildIcsCalendar({ events, language: events[0]?.language ?? 'sl' });
    if (!ics) throw new Error('Empty calendar');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    if (status) { status.textContent = ''; status.hidden = true; }
    trackStkEvent({ event_type: 'my_races_bulk_ics_exported', results_count: events.length, calendar_type: 'ics', placement: 'my_races' });
  } catch {
    if (status) { status.textContent = labels.calendarError; status.hidden = false; }
  }
};

const renderFallback = (race: SavedRace, labels: Labels, language: 'sl' | 'en') => `<article class="my-race-card is-muted${race.status === 'completed' ? ' is-completed' : ''}" data-key="${escapeHtml(getSavedRaceKey(race))}"><div class="my-race-overview"><div class="my-race-main"><h3>${escapeHtml(race.title || labels.unresolved)}</h3><p>${escapeHtml([race.year, race.eventId, race.date].filter(Boolean).join(' · '))}</p></div><div class="my-race-card-status">${renderStatusSelect(race, language)}</div></div><div class="my-race-actions-secondary"><button class="my-race-remove" type="button" aria-label="${escapeHtml(`${labels.remove}: ${race.title || labels.unresolved}`)}" data-remove-saved-race data-event-id="${escapeHtml(race.eventId)}" data-event-year="${escapeHtml(race.year)}" data-event-title="${escapeHtml(race.title || labels.unresolved)}" data-event-date="${escapeHtml(race.date)}">${escapeHtml(labels.remove)}</button></div></article>`;

const renderEvent = (item: ReturnType<typeof resolveSavedRaces>[number] & { event: any }, labels: Labels, language: 'sl' | 'en', todayIso: string, isNext = false) => {
  if (!item.event) return renderFallback(item.savedRace, labels, language);
  const event = item.event;
  const location = [event.place, event.region].filter(Boolean).join(', ');
  const detailPath = getSavedRaceDetailPath(event, language);
  const actions = buildPrimaryActions(event, language);
  const registration = actions.filter((action) => action.kind === 'registration');
  const notices = actions.filter((action) => action.kind === 'notice');
  const renderActions = (items: typeof actions) => items.map((action) => `<a class="button button-small ${action.kind === 'registration' ? 'my-race-action-registration' : 'button-secondary-light my-race-action-notice'}" href="${escapeHtml(action.url)}" target="_blank" rel="noopener noreferrer"><span class="action-icon">${renderActionIcon(action.kind === 'registration' ? 'registration' : 'notice')}</span> ${escapeHtml(action.label)}</a>`).join('');
  return `<article id="${escapeHtml(getRaceCardId(item.key))}" class="my-race-card${isNext ? ' is-next' : ''}${item.savedRace.status === 'completed' ? ' is-completed' : ''}" data-key="${escapeHtml(item.key)}" data-analytics-placement="my_races" data-analytics-event-id="${escapeHtml(event.id)}" data-analytics-event-name="${escapeHtml(event.title)}" data-analytics-event-date="${escapeHtml(event.date)}" data-analytics-event-year="${escapeHtml(event.year)}"${isNext ? ' data-next-race="true"' : ''}>${isNext ? `<p class="my-race-next-label"><span aria-hidden="true">●</span> ${escapeHtml(labels.nextRace)}</p>` : ''}<div class="my-race-overview"><p class="my-race-date"><span class="action-icon">${renderActionIcon('calendar')}</span>${escapeHtml(formatDate(event.date, language))}</p><div class="my-race-main"><h3><a href="${escapeHtml(detailPath)}">${escapeHtml(event.title)}</a></h3><p class="my-race-location"><span class="action-icon">${renderActionIcon('location')}</span>${escapeHtml(location)}</p></div><div class="my-race-card-status">${renderStatusSelect({ ...item.savedRace, date: event.date, title: event.title }, language, todayIso)}</div></div>${renderRaceCardDeadlines(event, detailPath, labels, language, todayIso)}${isCompletionAllowed(event.date, todayIso) && item.savedRace.status !== 'completed' ? `<aside class="post-race-cta"><strong>${language === 'en' ? 'Did you run it?' : 'Ste tekli?'}</strong><button class="button button-small" type="button" data-mark-completed data-event-id="${escapeHtml(item.savedRace.eventId)}" data-event-year="${escapeHtml(item.savedRace.year)}">${language === 'en' ? 'Mark as completed' : 'Označi kot opravljeno'}</button></aside>` : ''}<div class="my-race-actions"><div class="my-race-actions-primary">${renderActions(registration)}<a class="button button-small button-secondary-light my-race-action-details" href="${escapeHtml(detailPath)}"><span class="action-icon">${renderActionIcon('facts')}</span> ${escapeHtml(labels.details)}</a>${renderActions(notices)}${renderRaceCalendarMenu(event, location, labels, language)}</div><div class="my-race-actions-secondary"><button class="my-race-remove" type="button" aria-label="${escapeHtml(`${labels.remove}: ${event.title}`)}" data-remove-saved-race data-event-id="${escapeHtml(item.savedRace.eventId)}" data-event-year="${escapeHtml(item.savedRace.year)}" data-event-title="${escapeHtml(event.title)}" data-event-date="${escapeHtml(event.date)}"><span class="action-icon">${renderActionIcon('remove')}</span>${escapeHtml(labels.remove)}</button></div></div></article>`;
};


const agendaMonth = (item: ReturnType<typeof resolveSavedRaces>[number], language: 'sl' | 'en') => {
  const date = item.event?.date || item.savedRace.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return language === 'en' ? 'Earlier' : 'Prej';
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'sl-SI', { month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00`));
};

export const renderRaceAgenda = (items: ReturnType<typeof resolveSavedRaces>, labels: Labels, language: 'sl' | 'en', todayIso: string, highlightNext = false) => {
  let previousMonth = '';
  const nextRaceKey = highlightNext ? getNextSavedRace(items)?.key : undefined;
  return `<ol class="my-race-agenda">${items.map((item) => {
    const month = agendaMonth(item, language);
    const monthHeading = month !== previousMonth ? `<h3 class="my-race-month">${escapeHtml(month)}</h3>` : '';
    previousMonth = month;
    return `<li class="my-race-agenda-item">${monthHeading}<span class="my-race-axis-marker" aria-hidden="true"></span>${renderEvent(item as any, labels, language, todayIso, item.key === nextRaceKey)}</li>`;
  }).join('')}</ol>`;
};


export const removeSavedRaceFromMyRaces = (storage: MinimalStorage | null, race: Pick<SavedRace, 'eventId' | 'year'>, context: { eventName?: string; eventDate?: string; language: 'sl' | 'en' }) => {
  const before = readSavedRaces(storage).state;
  const savedRace = before.races.find((item) => getSavedRaceKey(item) === getSavedRaceKey(race));
  if (!savedRace || !isRaceSaved(before, race)) return false;
  const result = removeSavedRaceFromStorage(storage, race);
  if (!result.persistent || isRaceSaved(readSavedRaces(storage).state, race)) return false;
  trackStkEvent({
    event_type: 'race_unsaved',
    event_id: savedRace.eventId,
    event_name: context.eventName || savedRace.title,
    event_date: context.eventDate || savedRace.date,
    event_year: savedRace.year,
    language: context.language,
    placement: 'my_races'
  });
  dispatchSavedRacesChanged();
  return true;
};

export const renderSeason = (items: ReturnType<typeof resolveSavedRaces>, availableRegions: string[], language: 'sl' | 'en') => {
  const summary = getSeasonSummary(items, DEFAULT_PUBLIC_YEAR);
  const achievements = getSeasonAchievements(items, DEFAULT_PUBLIC_YEAR);
  const nextAchievement = getNextAchievement(items, DEFAULT_PUBLIC_YEAR);
  const regionProgress = getSeasonRegionProgress(items, availableRegions, DEFAULT_PUBLIC_YEAR);
  const regions = getSloveniaMapRegions(regionProgress, language);
  const visitedRegionCount = regions.filter((region) => region.visited).length;
  const copy = language === 'en'
    ? { title: `My ${DEFAULT_PUBLIC_YEAR} season`, empty: 'Once you complete a race, mark it as Completed in My races. Your running passport will begin here.', passport: 'My running passport', achievements: 'My achievements', exploring: 'Exploring Slovenia', achieved: 'Achieved', active: 'In progress', locked: 'Locked', next: 'Next achievement', old: 'Saved race (details are no longer available)' }
    : { title: `Moja sezona ${DEFAULT_PUBLIC_YEAR}`, empty: 'Ko tek opravite, ga v Mojih tekih označite kot Opravljen. Tukaj se bo začel vaš tekaški potni list.', passport: 'Moj tekaški potni list', achievements: 'Moji dosežki', exploring: 'Odkrivam Slovenijo', achieved: 'Osvojeno', active: 'V napredku', locked: 'Zaklenjeno', next: 'Naslednji dosežek', old: 'Shranjeni tek (podrobnosti niso več na voljo)' };
  const terrain = summary.surfaces;
  const progress = (achievement: typeof achievements[number]) => achievement.key === 'all-terrain'
    ? (['road', 'trail', 'mountain'] as BasicSurface[]).map((surface) => `${SURFACE_NAMES[language][surface]} ${terrain.has(surface) ? '✓' : '○'}`).join(' · ')
    : `${achievement.current} / ${achievement.target}${achievement.key === 'nomad' ? (language === 'en' ? ' regions' : ' regij') : ''}`;
  const stamps = summary.completed.map((item) => {
    const event = item.event || item.snapshot;
    if (!event) return `<article class="season-stamp is-unresolved"><strong>${escapeHtml(item.savedRace.title || copy.old)}</strong><span>${escapeHtml(item.savedRace.date || item.savedRace.year)}</span></article>`;
    const region = formatSeasonRegionLabel(event.region, language);
    const location = event.place ? `${event.place}${region ? ` · ${region}` : ''}` : region;
    const surface = normalizeBasicSurface(event.surface);
    const surfaceLabel = formatSeasonSurfaceLabel(event.surface, language);
    const body = `<span class="season-stamp-seal">${renderSurfaceStampIcon(surface)}<span>${escapeHtml(event.year)}</span></span><span class="season-stamp-mark">STK · ${escapeHtml(surfaceLabel)}</span><strong>${escapeHtml(event.title)}</strong><span class="season-stamp-date">${escapeHtml(formatDate(event.date, language))}</span><span class="season-stamp-meta">${escapeHtml(location)} · ${escapeHtml(surfaceLabel)}</span>`;
    return item.event ? `<a class="season-stamp is-${surface ?? 'other'}" href="${escapeHtml(getSavedRaceDetailPath(item.event, language))}">${body}</a>` : `<article class="season-stamp is-unresolved is-${surface ?? 'other'}">${body}<span class="season-stamp-unavailable">${copy.old}</span></article>`;
  }).join('');
  const summaryRace = language === 'en' ? `${summary.completedCount} completed races` : formatSloveneCount(summary.completedCount, 'completed-race');
  const summaryEvent = language === 'en' ? `${summary.distinctEventCount} different events` : formatSloveneCount(summary.distinctEventCount, 'distinct-event');
  const summaryRaceLabel = summaryRace.replace(/^\d+\s+/, '');
  const summaryEventLabel = summaryEvent.replace(/^\d+\s+/, '');
  const regionCard = (region: typeof regions[number]) => {
    const state = region.visited
      ? (language === 'en' ? `${region.completedEventCount} completed ${region.completedEventCount === 1 ? 'race' : 'races'}` : formatSloveneCount(region.completedEventCount, 'completed-race'))
      : (language === 'en' ? 'Not visited yet' : 'Še ni obiskana');
    return `<article class="season-region${region.visited ? ' is-visited' : ''}"><strong><span aria-hidden="true">${region.visited ? '✓' : '○'}</span> ${escapeHtml(formatSeasonRegionLabel(region.label, language))}</strong><span>${escapeHtml(state)}</span></article>`;
  };
  const visitedRegionCards = regions.filter((region) => region.visited).map(regionCard).join('');
  const remainingRegions = regions.filter((region) => !region.visited);
  const remainingRegionCards = remainingRegions.map(regionCard).join('');
  const regionDisclosure = remainingRegions.length ? `<details class="season-regions-disclosure"><summary>${language === 'en' ? 'Remaining regions' : 'Preostale regije'} (${remainingRegions.length})</summary><div class="season-regions season-regions-remaining">${remainingRegionCards}</div></details>` : '';
  const regionCta = remainingRegions.length ? `<a class="button button-small button-secondary-light season-map-cta" href="${language === 'en' ? '/en/find-races/' : '/iskalnik-tekov/'}">${language === 'en' ? 'Discover a race in a new region' : 'Odkrij tek v novi regiji'}</a>` : '';
  const nextAchievementCopy = nextAchievement ? `${language === 'en' ? 'Next achievement' : 'Naslednji dosežek'}: ${ACHIEVEMENT_NAMES[language][nextAchievement.key]} · ${nextAchievement.current}/${nextAchievement.target}` : (language === 'en' ? 'All achievements completed' : 'Vsi dosežki so osvojeni');
  const nomad = achievements.find((achievement) => achievement.key === 'nomad')!;
  const nomadCopy = nomad.achieved
    ? (language === 'en' ? 'Nomad achieved' : 'Dosežek Nomad je osvojen')
    : (language === 'en' ? `${nomad.target - nomad.current} regions to the Nomad achievement` : `Še ${formatSloveneCount(nomad.target - nomad.current, 'region')} do dosežka Nomad`);
  const summaryStrip = `<div class="season-summary"><span class="season-metric season-metric-primary"><strong>${summary.completedCount}</strong><span>${escapeHtml(summaryRaceLabel)}</span></span><span class="season-metric"><strong>${visitedRegionCount} / ${regions.length}</strong><span>${language === 'en' ? 'regions' : 'regij'}</span></span><span class="season-metric"><strong>${summary.distinctEventCount}</strong><span>${escapeHtml(summaryEventLabel)}</span></span><div class="season-next-achievement"><span class="action-icon">${renderActionIcon('cup')}</span><div><strong>${escapeHtml(nextAchievementCopy)}</strong>${nextAchievement ? `<progress max="${nextAchievement.target}" value="${nextAchievement.current}" aria-label="${escapeHtml(nextAchievementCopy)}"></progress>` : ''}</div></div></div>`;
  return `<section class="my-season" aria-labelledby="my-season-title"><div class="my-season-heading"><h2 id="my-season-title">${copy.title}</h2><button class="button button-small button-secondary-light" type="button" data-toggle-past-races>${language === 'en' ? 'Add a past race' : 'Dodaj pretekli tek'}</button></div><section class="past-race-picker" data-past-race-picker hidden><label>${language === 'en' ? 'Search by race name or place' : 'Išči po nazivu teka ali kraju'}<input type="search" data-past-race-search></label><div data-past-race-results></div></section>${summaryStrip}<section class="season-map-panel" aria-labelledby="season-map-heading"><div class="season-map-copy"><span class="eyebrow">${copy.exploring}</span><h3 id="season-map-heading">${language === 'en' ? 'My running Slovenia' : 'Moja tekaška Slovenija'}</h3><strong class="season-map-count">${visitedRegionCount} / ${regions.length} ${language === 'en' ? 'regions' : 'regij'}</strong><p>${escapeHtml(nomadCopy)}</p>${regionCta}</div>${renderSloveniaRegionsMap(regionProgress, language, 'full')}</section>${summary.completedCount ? '' : `<p class="season-empty">${copy.empty}</p>`}<section class="my-season-section season-region-list"><h3>${copy.exploring}</h3>${visitedRegionCards ? `<div class="season-regions season-regions-visited">${visitedRegionCards}</div>` : `<p class="season-regions-start">${language === 'en' ? 'Complete a race to visit your first region.' : 'Opravi tek in obišči svojo prvo regijo.'}</p>`}${regionDisclosure}</section>${summary.completedCount ? `<section class="my-season-section"><h3>${copy.passport}</h3><div class="season-passport">${stamps}</div></section>` : ''}<section class="my-season-section achievements-section"><h3>${copy.achievements}</h3><div class="achievement-grid">${achievements.map((achievement) => { const isNext = nextAchievement?.key === achievement.key; const state = achievement.achieved ? copy.achieved : isNext ? copy.next : achievement.current > 0 ? copy.active : copy.locked; return `<article class="achievement-card${achievement.achieved ? ' is-achieved' : achievement.current > 0 ? ' is-active' : ' is-locked'}${isNext ? ' is-next' : ''}" data-achievement="${achievement.key}" data-achievement-state="${achievement.achieved ? 'achieved' : isNext ? 'next' : achievement.current > 0 ? 'active' : 'locked'}"><div class="achievement-heading"><span class="achievement-icon" aria-hidden="true">${renderAchievementIcon(achievement.key)}</span><div><h4>${ACHIEVEMENT_NAMES[language][achievement.key]}</h4><span class="achievement-status">${state}</span></div><strong class="achievement-value">${achievement.current} / ${achievement.target}</strong></div>${achievement.key === 'all-terrain' ? `<p>${progress(achievement)}</p>` : ''}<progress max="${achievement.target}" value="${achievement.current}" aria-label="${escapeHtml(ACHIEVEMENT_NAMES[language][achievement.key])}: ${achievement.current} / ${achievement.target}"></progress></article>`; }).join('')}</div></section></section>`;
};

const updateSeasonMount = (root: ParentNode, items: ReturnType<typeof resolveSavedRaces>, availableRegions: string[], language: 'sl' | 'en') => {
  const seasonMount = root.querySelector<HTMLElement>('[data-my-season-app]');
  if (seasonMount && 'mySeasonApp' in seasonMount.dataset) {
    const previousRegionsDisclosure = seasonMount.querySelector<HTMLDetailsElement>('.season-regions-disclosure');
    const restoreRegionsDisclosure = Boolean(previousRegionsDisclosure?.open);
    const restoreRegionsFocus = Boolean(previousRegionsDisclosure?.contains(document.activeElement));
    seasonMount.innerHTML = renderSeason(items, availableRegions, language);
    const regionsDisclosure = seasonMount.querySelector<HTMLDetailsElement>('.season-regions-disclosure');
    if (regionsDisclosure && restoreRegionsDisclosure) regionsDisclosure.open = true;
    if (regionsDisclosure && restoreRegionsFocus) regionsDisclosure.querySelector<HTMLElement>('summary')?.focus();
    seasonMount.classList.remove('season-loading');
    delete seasonMount.dataset.seasonLoading;
    seasonMount.removeAttribute('aria-label');
    seasonMount.setAttribute('aria-live', 'polite');
    seasonMount.closest<HTMLElement>('[data-my-races-panel="season"]')?.removeAttribute('aria-busy');
  }
};

export const initMyRacesTabs = (root = document) => {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-my-races-tab]')];
  const selectTab = (button: HTMLButtonElement) => {
    const selected = button.dataset.myRacesTab || 'plan';
    root.querySelectorAll<HTMLElement>('[data-my-races-panel]').forEach((panel) => { panel.hidden = panel.dataset.myRacesPanel !== selected; });
    tabs.forEach((tab) => { const active = tab === button; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
    if (selected === 'season') {
      const seasonMount = root.querySelector<HTMLElement>('[data-my-season-app]');
      if (seasonMount?.dataset.seasonLoading !== undefined) {
        seasonMount.closest<HTMLElement>('[data-my-races-panel="season"]')?.setAttribute('aria-busy', 'true');
      }
      const language = root.querySelector<HTMLElement>('[data-my-races-app]')?.dataset.language;
      trackStkPageLoadEventOnce(`season_viewed:${location.pathname}`, { event_type: 'season_viewed', language, placement: 'my_races' });
      trackStkPageLoadEventOnce(`achievement_viewed:${location.pathname}`, { event_type: 'achievement_viewed', language, placement: 'my_races' });
    }
  };
  tabs.forEach((button, index) => {
    button.addEventListener('click', () => selectTab(button));
    button.addEventListener('keydown', (event) => {
      const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
      if (nextIndex < 0) return;
      event.preventDefault(); tabs[nextIndex].focus(); selectTab(tabs[nextIndex]);
    });
  });
  const initialView = getInitialMyRacesView(typeof window === 'undefined' ? '' : window.location.search);
  const initialTab = tabs.find((tab) => tab.dataset.myRacesTab === initialView) ?? tabs[0];
  if (initialTab) selectTab(initialTab);
};

export const rebuildProgressiveRaceResolutions = (
  saved: SavedRace[],
  payloads: Record<string, unknown>,
  additionalRowsByYear: Partial<Record<PublicYear, AdditionalEventData[]>>,
  todayIso: string
) => {
  let items = sortResolvedSavedRaces(resolveSavedRaces(saved, payloads, todayIso));
  const attached = SUPPORTED_PUBLIC_YEARS.flatMap((year) => {
    const rows = additionalRowsByYear[year] ?? [];
    if (!rows.length || !isAdditionalDataEnabledForYear(year)) return [];
    return attachAdditionalDataByMasterRow(items.filter((item) => item.event?.year === year).map((item) => item.event!), rows, year);
  });
  if (!attached.length) return items;
  const byKey = new Map(attached.map((event) => [`${event.year}:${getStableEventId(event)}`, event]));
  return items.map((item) => byKey.has(item.key) ? { ...item, event: byKey.get(item.key)! } : item);
};

export const initMyRacesPage = async (root = document) => {
  const mount = root.querySelector<HTMLElement>('[data-my-races-app]');
  if (!mount) return;
  const isCurrentRender = beginMyRacesRender(mount);
  const language = mount.dataset.language === 'en' ? 'en' : 'sl';
  const labels = LABELS[language];
  const storage = getStorage();
  if (!storage) {
    trackStkPageLoadEventOnce(`my_races_viewed:${language}`, { event_type: 'my_races_viewed', language, placement: 'my_races' });
    mount.innerHTML = `<p class="notice warning">${labels.storageError}</p>${renderLocalNotice(labels)}`;
    updateSeasonMount(root, [], [], language);
    return;
  }

  const saved = readSavedRaces(storage).state.races;
  trackStkPageLoadEventOnce(`my_races_viewed:${language}`, { event_type: 'my_races_viewed', language, placement: 'my_races', results_count: saved.length });
  const todayIso = getTodayIsoInLjubljana();
  const payloads: Record<string, unknown> = {};
  const additionalRowsByYear: Partial<Record<PublicYear, AdditionalEventData[]>> = {};
  const failedMasterYears = new Set<PublicYear>();
  let pastEvents: NonNullable<ReturnType<typeof mapPublicRaceEvent>>[] = [];
  let pastEventsState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  const requiredYears = [...new Set(saved.map((race) => race.year))].filter((year): year is PublicYear => SUPPORTED_PUBLIC_YEARS.includes(year as PublicYear));
  const pendingRequiredRequests = new Set(requiredYears.flatMap((year) => [`master:${year}`, `additional:${year}`]));
  const requestCache = pageDataCache.get(mount) ?? { master: new Map(), additional: new Map() };
  pageDataCache.set(mount, requestCache);
  const masterRequest = (year: PublicYear): Promise<unknown> => {
    const existing = requestCache.master.get(year);
    if (existing) return existing;
    const request = fetch(`${API_BASE}${buildMasterApiPath(year)}`, { headers: { Accept: 'application/json' } })
      .then((response) => { if (!response.ok) throw new Error(String(response.status)); return response.json(); });
    requestCache.master.set(year, request);
    return request;
  };
  const additionalRequest = (year: PublicYear): Promise<AdditionalEventData[]> => {
    const existing = requestCache.additional.get(year);
    if (existing) return existing;
    const request = fetchAdditionalEventData(year);
    requestCache.additional.set(year, request);
    return request;
  };

  const withSnapshots = (items: ReturnType<typeof resolveSavedRaces>) => {
    const snapshotState = backfillCompletedRaceSnapshots(storage, items, todayIso);
    const snapshots = new Map(snapshotState.snapshots.map((item) => [getCompletedRaceSnapshotKey(item), item]));
    return items.map((item) => ({ ...item, snapshot: snapshots.get(item.key) ?? null }));
  };
  let resolved = withSnapshots(rebuildProgressiveRaceResolutions(saved, payloads, additionalRowsByYear, todayIso));
  const rebuildAndRender = () => {
    resolved = withSnapshots(rebuildProgressiveRaceResolutions(saved, payloads, additionalRowsByYear, todayIso));
    render();
  };

  const renderPastRacePickerResults = () => {
    const picker = root.querySelector<HTMLElement>('[data-past-race-picker]');
    const resultsMount = picker?.querySelector<HTMLElement>('[data-past-race-results]');
    if (!picker || !resultsMount) return;
    if (pastEventsState === 'loading' || pastEventsState === 'idle') { resultsMount.innerHTML = `<p role="status">${escapeHtml(labels.pastLoading)}</p>`; return; }
    if (pastEventsState === 'error') { resultsMount.innerHTML = `<p class="notice warning">${escapeHtml(labels.pastError)}</p>`; return; }
    const query = picker.querySelector<HTMLInputElement>('[data-past-race-search]')?.value ?? '';
    const q = query.trim().toLocaleLowerCase(language === 'en' ? 'en' : 'sl-SI');
    const results = pastEvents.filter((event) => !q || `${event.title} ${event.place}`.toLocaleLowerCase(language === 'en' ? 'en' : 'sl-SI').includes(q)).slice(0, 30);
    if (!results.length) { resultsMount.innerHTML = `<p>${escapeHtml(labels.pastEmpty)}</p>`; return; }
    resultsMount.innerHTML = results.map((event) => { const eventId = getStableEventId(event); const added = getSavedRaceStatus(readSavedRaces(storage).state, { year: event.year, eventId }) === 'completed'; return `<article class="past-race-result"><div><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(formatDate(event.date, language))} · ${escapeHtml(event.place)} · ${escapeHtml(formatSeasonRegionLabel(event.region, language))}</span></div><button class="button button-small" type="button" data-add-past-race="${escapeHtml(`${event.year}:${eventId}`)}"${added ? ' disabled' : ''}>${added ? (language === 'en' ? 'Already added' : 'Že dodano') : (language === 'en' ? 'I completed this race' : 'Opravil sem ta tek')}</button></article>`; }).join('');
    resultsMount.querySelectorAll<HTMLButtonElement>('[data-add-past-race]').forEach((button) => button.addEventListener('click', () => { const event = pastEvents.find((candidate) => `${candidate.year}:${getStableEventId(candidate)}` === button.dataset.addPastRace); if (!event || !isCompletionAllowed(event.date, todayIso)) return; const result = setSavedRaceStatusInStorage(storage, { eventId: getStableEventId(event), year: event.year, date: event.date, title: event.title }, 'completed'); if (result.persistent) { upsertCompletedRaceSnapshot(storage, event); dispatchSavedRacesChanged(); initMyRacesPage(root); } }));
  };

  const bindPastRacePicker = () => {
    const picker = root.querySelector<HTMLElement>('[data-past-race-picker]');
    root.querySelector<HTMLButtonElement>('[data-toggle-past-races]')?.addEventListener('click', () => {
      if (!picker) return;
      picker.hidden = !picker.hidden;
      if (!picker.hidden) {
        if (pastEventsState === 'idle') void loadPastEvents();
        renderPastRacePickerResults();
        picker.querySelector<HTMLInputElement>('input')?.focus();
      }
    });
    picker?.querySelector<HTMLInputElement>('[data-past-race-search]')?.addEventListener('input', renderPastRacePickerResults);
  };

  let deferredPlanControl: HTMLSelectElement | null = null;
  const render = () => {
    if (!isCurrentRender()) return;
    const previousPicker = root.querySelector<HTMLElement>('[data-past-race-picker]');
    const previousSearch = previousPicker?.querySelector<HTMLInputElement>('[data-past-race-search]');
    const restorePicker = Boolean(previousPicker && !previousPicker.hidden);
    const restoreSearchFocus = previousSearch === document.activeElement;
    const pickerQuery = previousSearch?.value ?? '';
    const selectionStart = previousSearch?.selectionStart ?? pickerQuery.length;
    const selectionEnd = previousSearch?.selectionEnd ?? selectionStart;
    const activeStatusSelect = mount.contains(document.activeElement) && (document.activeElement as HTMLElement).matches('[data-my-race-status-select]') ? document.activeElement as HTMLSelectElement : null;
    const openDisclosures = [...mount.querySelectorAll<HTMLDetailsElement>('details[open]')].map((details) => ({
      raceKey: details.closest<HTMLElement>('[data-key]')?.dataset.key ?? '',
      kind: details.matches('[data-race-calendar-menu]') ? 'race' : details.closest<HTMLElement>('[data-my-race-deadline]')?.dataset.deadlineKind ?? ''
    })).filter((item) => item.raceKey && item.kind);
    const activeCalendarLink = mount.contains(document.activeElement) ? (document.activeElement as HTMLElement).closest<HTMLAnchorElement>('[data-calendar-action]') : null;
    const activeCalendarIdentity = activeCalendarLink ? {
      raceKey: activeCalendarLink.closest<HTMLElement>('[data-key]')?.dataset.key ?? '',
      kind: activeCalendarLink.closest('[data-race-calendar-menu]') ? 'race' : activeCalendarLink.closest<HTMLElement>('[data-my-race-deadline]')?.dataset.deadlineKind ?? '',
      action: activeCalendarLink.dataset.calendarAction ?? ''
    } : null;
    const availableRegions = toApiRecords(payloads[DEFAULT_PUBLIC_YEAR]).map((record, index) => mapPublicRaceEvent(record, DEFAULT_PUBLIC_YEAR, index)?.region ?? '').filter(Boolean);
    updateSeasonMount(root, resolved, availableRegions, language);
    bindPastRacePicker();
    if (restorePicker) {
      const picker = root.querySelector<HTMLElement>('[data-past-race-picker]');
      const search = picker?.querySelector<HTMLInputElement>('[data-past-race-search]');
      if (picker && search) {
        picker.hidden = false;
        search.value = pickerQuery;
        renderPastRacePickerResults();
        if (restoreSearchFocus) { search.focus(); search.setSelectionRange(selectionStart, selectionEnd); }
      }
    }
    const activeFilter = (mount.dataset.activeStatusFilter && (mount.dataset.activeStatusFilter === 'all' || isSavedRaceStatus(mount.dataset.activeStatusFilter))) ? mount.dataset.activeStatusFilter as MyRacesStatusFilter : 'all';
    const counts = countSavedRaceStatuses(resolved);
    const filtered = filterSavedRaceResolutionsByStatus(resolved, activeFilter);
    const upcoming = filtered.filter((item) => item.status === 'upcoming');
    const exportableUpcoming = getExportableUpcomingRaceEvents(resolved, language);
    const other = filtered.filter((item) => item.status !== 'upcoming');
    const emptyFiltered = activeFilter !== 'all' && !filtered.length;
    const updateStatusMount = root.querySelector<HTMLElement>('[data-my-races-update-status-mount]');
    if (updateStatusMount) updateStatusMount.innerHTML = pendingRequiredRequests.size ? `<p class="muted-note" role="status" aria-live="polite" data-my-races-update-status>${escapeHtml(labels.updating)}</p>` : '';
    if (activeStatusSelect) {
      if (deferredPlanControl !== activeStatusSelect) {
        deferredPlanControl = activeStatusSelect;
        activeStatusSelect.addEventListener('blur', () => { deferredPlanControl = null; if (isCurrentRender()) render(); }, { once: true });
      }
      return;
    }
    deferredPlanControl = null;
    mount.innerHTML = `${failedMasterYears.size ? `<p class="notice warning">${labels.apiError}</p>` : ''}${renderLocalNotice(labels)}${renderStatusFilters(counts, activeFilter, resolved.length, language)}${renderNextStepSummary(getUpcomingSavedRaceDeadlines({ items: filtered as any, todayIso, windowDays: Number.MAX_SAFE_INTEGER, limit: 1 }), filtered, labels, language, todayIso)}${emptyFiltered ? `<p>${labels.emptyFilter}</p>` : ''}${upcoming.length ? `<section><h2>${labels.upcoming}</h2>${renderExportToolbar(exportableUpcoming, labels)}${renderRaceAgenda(upcoming, labels, language, todayIso, true)}</section>` : (!emptyFiltered && activeFilter === 'all' ? `<p>${labels.empty} <a href="${language === 'en' ? '/en/find-races/' : '/iskalnik-tekov/'}">${labels.search}</a>.</p>` : '')}${other.length ? `<section class="my-races-secondary"><h2>${labels.other}</h2>${renderRaceAgenda(other, labels, language, todayIso)}</section>` : ''}`;
    openDisclosures.forEach(({ raceKey, kind }) => {
      const raceCard = [...mount.querySelectorAll<HTMLElement>('[data-key]')].find((card) => card.dataset.key === raceKey);
      const disclosure = kind === 'race' ? raceCard?.querySelector<HTMLDetailsElement>('[data-race-calendar-menu]') : [...(raceCard?.querySelectorAll<HTMLDetailsElement>('[data-my-race-deadline] .deadline-calendar-menu') ?? [])].find((details) => details.closest<HTMLElement>('[data-my-race-deadline]')?.dataset.deadlineKind === kind);
      if (disclosure) disclosure.open = true;
      if (disclosure && activeCalendarIdentity?.raceKey === raceKey && activeCalendarIdentity.kind === kind) disclosure.querySelector<HTMLAnchorElement>(`[data-calendar-action="${activeCalendarIdentity.action}"]`)?.focus();
    });
    mount.closest<HTMLElement>('[data-my-races-panel="plan"]')?.removeAttribute('aria-busy');
    mount.querySelector<HTMLButtonElement>('[data-download-upcoming-races-ics]')?.addEventListener('click', () => downloadUpcomingRacesIcs(exportableUpcoming, labels, language === 'en' ? 'my-races.ics' : 'moji-teki.ics', mount.querySelector<HTMLElement>('[data-calendar-export-status]')));
    mount.querySelectorAll<HTMLButtonElement>('[data-my-races-status-filter]').forEach((button) => button.addEventListener('click', () => { mount.dataset.activeStatusFilter = button.dataset.myRacesStatusFilter || 'all'; initMyRacesPage(root); }));
    mount.querySelectorAll<HTMLSelectElement>('[data-my-race-status-select]').forEach((select) => select.addEventListener('change', () => { const status = select.value; const race = { eventId: select.dataset.eventId || '', year: select.dataset.eventYear || '', date: select.dataset.eventDate || '', title: select.dataset.eventTitle || '' }; const before = getSavedRaceStatus(readSavedRaces(storage).state, race); if (isSavedRaceStatus(status)) { if (status === 'completed' && !isCompletionAllowed(race.date, todayIso)) { select.value = before || ''; return; } const result = setSavedRaceStatusInStorage(storage, race, status); const event = resolved.find((item) => item.key === `${race.year}:${race.eventId}`)?.event; if (result.persistent && status === 'completed' && event) upsertCompletedRaceSnapshot(storage, event); if (result.persistent && before !== status && getSavedRaceStatus(readSavedRaces(storage).state, race) === status) dispatchSavedRacesChanged(); } else removeSavedRaceFromMyRaces(storage, race, { eventName: race.title, eventDate: race.date, language }); initMyRacesPage(root); }));
    mount.querySelectorAll<HTMLButtonElement>('[data-mark-completed]').forEach((button) => button.addEventListener('click', () => { const item = resolved.find((candidate) => candidate.savedRace.eventId === button.dataset.eventId && candidate.savedRace.year === button.dataset.eventYear); if (!item?.event || !isCompletionAllowed(item.event.date, todayIso)) return; const result = setSavedRaceStatusInStorage(storage, { eventId: item.savedRace.eventId, year: item.savedRace.year, date: item.event.date, title: item.event.title }, 'completed'); if (result.persistent) { upsertCompletedRaceSnapshot(storage, item.event); dispatchSavedRacesChanged(); initMyRacesPage(root); } }));
    mount.querySelectorAll<HTMLButtonElement>('[data-remove-saved-race]').forEach((button) => button.addEventListener('click', () => { removeSavedRaceFromMyRaces(getStorage(), { eventId: button.dataset.eventId || '', year: button.dataset.eventYear || '' }, { eventName: button.dataset.eventTitle || '', eventDate: button.dataset.eventDate || '', language }); initMyRacesPage(root); }));
  };

  // First paint is entirely local: saved references, statuses and completed snapshots.
  render();

  const loadPastEvents = async () => {
    if (pastEventsState === 'loading' || pastEventsState === 'ready') return;
    pastEventsState = 'loading';
    renderPastRacePickerResults();
    try {
      const payload = await masterRequest(DEFAULT_PUBLIC_YEAR);
      if (!isCurrentRender()) return;
      payloads[DEFAULT_PUBLIC_YEAR] = payload;
      pastEvents = toApiRecords(payload).map((record) => mapPublicRaceEvent(record, DEFAULT_PUBLIC_YEAR, 0)).filter((event): event is NonNullable<typeof event> => Boolean(event && isCompletionAllowed(event.date, todayIso)));
      pastEventsState = 'ready';
    } catch {
      if (!isCurrentRender()) return;
      pastEvents = [];
      pastEventsState = 'error';
    }
    render();
  };

  const yearLoads = requiredYears.flatMap((year) => {
    const masterLoad = masterRequest(year).then((payload) => {
      if (!isCurrentRender()) return;
      payloads[year] = payload;
      if (year === DEFAULT_PUBLIC_YEAR) {
        pastEvents = toApiRecords(payload).map((record) => mapPublicRaceEvent(record, year, 0)).filter((event): event is NonNullable<typeof event> => Boolean(event && isCompletionAllowed(event.date, todayIso)));
        pastEventsState = 'ready';
      }
    }).catch(() => {
      if (!isCurrentRender()) return;
      failedMasterYears.add(year);
      if (year === DEFAULT_PUBLIC_YEAR) pastEventsState = 'error';
    }).finally(() => {
      pendingRequiredRequests.delete(`master:${year}`);
      if (isCurrentRender()) rebuildAndRender();
    });
    const additionalLoad = additionalRequest(year).then((rows) => {
      if (isCurrentRender()) additionalRowsByYear[year] = rows;
    }).catch(() => { /* optional enrichment never removes the dashboard */ }).finally(() => {
      pendingRequiredRequests.delete(`additional:${year}`);
      if (isCurrentRender()) rebuildAndRender();
    });
    return [masterLoad, additionalLoad];
  });

  await Promise.allSettled(yearLoads);
  if (isCurrentRender()) render();
};
