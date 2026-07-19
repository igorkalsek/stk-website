import { trackStkEvent, trackStkPageLoadEventOnce } from './lib/stkAnalytics.js';
import { buildGoogleCalendarEventUrl, buildIcsCalendar, buildIcsDataUrl, buildIcsFilename, buildOutlookCalendarEventUrl, buildRegistrationDeadlineCalendarInput, type MultiIcsCalendarEventInput } from './utils-calendar.js';
import { countSavedRaceStatuses, filterSavedRaceResolutionsByStatus, getSavedRaceDetailPath, getUpcomingSavedRaceDeadlines, resolveSavedRaces, sortResolvedSavedRaces, type MyRacesStatusFilter } from './utils-my-races.js';
import { getSavedRaceKey, isRaceSaved, isSavedRaceStatus, readSavedRaces, removeSavedRaceFromStorage, SAVED_RACE_STATUSES, SAVED_RACE_STATUS_COPY, SAVED_RACE_STATUS_LABELS, setSavedRaceStatusInStorage, type MinimalStorage, type SavedRace, type SavedRaceStatus } from './utils-saved-races.js';
import { buildMasterApiPath, isAdditionalDataEnabledForYear, SUPPORTED_PUBLIC_YEARS, type PublicYear } from './utils-public-year.js';
import { getStableEventId } from './utils-event-detail.js';
import { buildPrimaryActions } from './utils-race-detail-view.js';
import { renderActionIcon } from './utils-action-icons.js';
import { getTodayIsoInLjubljana } from './utils-date.js';
import { attachAdditionalDataByMasterRow, fetchAdditionalEventData, type AdditionalEventData } from './utils-additional.js';
import { buildRegistrationDeadlineViews, getRegistrationDeadlineCssState, type RegistrationDeadlineView } from './utils-registration-deadlines.js';

const API_BASE = 'https://stk-master-api.igor-kalsek.workers.dev';
type MyRacesDataCache = { payloads: Record<string, unknown>; apiOk: boolean; additionalRows: AdditionalEventData[] };
const pageDataCache = new WeakMap<HTMLElement, Promise<MyRacesDataCache>>();
const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);
const formatDate = (value: string, language: 'sl' | 'en') => value ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'sl-SI', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : '';
const SLOVENIAN_GENITIVE_MONTHS = ['januarja', 'februarja', 'marca', 'aprila', 'maja', 'junija', 'julija', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'] as const;

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

type Labels = Record<'nextDeadline' | 'deadlines' | 'viewRace' | 'earlyRegistration' | 'registrationDeadline' | 'addDeadline' | 'addRace' | 'daysLeft' | 'tomorrow' | 'today' | 'loading' | 'empty' | 'search' | 'upcoming' | 'other' | 'unresolved' | 'remove' | 'details' | 'google' | 'apple' | 'outlook' | 'apiError' | 'storageError' | 'local' | 'downloadAll' | 'downloadAllNote' | 'calendarError' | 'emptyFilter', string>;
const LABELS: Record<'sl' | 'en', Labels> = {
  sl: { nextDeadline: 'Naslednji prijavni rok', deadlines: 'Prijavni roki', viewRace: 'Prikaži v načrtu', earlyRegistration: 'Cenejša prijava do', registrationDeadline: 'Prijave do', addDeadline: 'Dodaj rok v koledar', addRace: 'Dodaj tek v koledar', daysLeft: 'še {n} dni', tomorrow: 'jutri', today: 'danes', loading: 'Nalagamo shranjene teke …', empty: 'Nimate še shranjenih tekov.', search: 'Odprite iskalnik tekov', upcoming: 'Moj tekaški načrt', other: 'Pretekli ali trenutno nerazrešeni teki', unresolved: 'Shranjena referenca', remove: 'Odstrani', details: 'Podrobnosti', google: 'Google koledar', apple: 'Apple/iCal', outlook: 'Outlook', apiError: 'API trenutno ni dosegljiv. Prikazane so osnovne shranjene reference.', storageError: 'Brskalnik trenutno ne dovoljuje dostopa do shranjenih tekov.', local: 'Shranjeno samo v tem brskalniku · brez računa in sinhronizacije med napravami.', downloadAll: 'Prenesi vse prihodnje teke (.ics)', downloadAllNote: 'Datoteka vsebuje prihodnje shranjene teke, razen tekov z oznako Opravljen.', emptyFilter: 'V tem statusu ni shranjenih tekov.', calendarError: 'Koledarske datoteke trenutno ni bilo mogoče pripraviti.' },
  en: { nextDeadline: 'Next registration deadline', deadlines: 'Registration deadlines', viewRace: 'Show in race plan', earlyRegistration: 'Early registration until', registrationDeadline: 'Registration until', addDeadline: 'Add deadline to calendar', addRace: 'Add race to calendar', daysLeft: '{n} days left', tomorrow: 'tomorrow', today: 'today', loading: 'Loading saved races …', empty: 'You have not saved any races yet.', search: 'Open race finder', upcoming: 'My race plan', other: 'Past or currently unresolved races', unresolved: 'Saved reference', remove: 'Remove', details: 'Details', google: 'Google Calendar', apple: 'Apple/iCal', outlook: 'Outlook', apiError: 'The API is currently unavailable. Basic saved references are shown below.', storageError: 'The browser currently does not allow access to saved races.', local: 'Stored only in this browser · no account or cross-device sync.', downloadAll: 'Download all upcoming races (.ics)', downloadAllNote: 'The file contains upcoming saved races except races marked Completed.', emptyFilter: 'There are no saved races with this status.', calendarError: 'The calendar file could not be prepared at this time.' }
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


const renderStatusSelect = (race: SavedRace, language: 'sl' | 'en') => {
  const copy = SAVED_RACE_STATUS_COPY[language];
  const id = `status-${race.year}-${race.eventId}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `<label class="sr-only" for="${escapeHtml(id)}">${escapeHtml(copy.label)}</label><select id="${escapeHtml(id)}" class="race-status-select" data-my-race-status-select data-race-status-control data-race-status="${race.status}" data-event-id="${escapeHtml(race.eventId)}" data-event-year="${escapeHtml(race.year)}" data-event-date="${escapeHtml(race.date)}" data-event-title="${escapeHtml(race.title)}" data-language="${language}"><option value="">${escapeHtml(copy.empty)}</option>${SAVED_RACE_STATUSES.map((status) => `<option value="${status}"${race.status === status ? ' selected' : ''}>${escapeHtml(SAVED_RACE_STATUS_LABELS[language][status])}</option>`).join('')}</select>`;
};
const renderStatusFilters = (counts: Record<SavedRaceStatus, number>, active: MyRacesStatusFilter, total: number, language: 'sl' | 'en') => `<div class="my-races-status-filters" role="group" aria-label="${escapeHtml(SAVED_RACE_STATUS_COPY[language].label)}">${[`<button class="my-races-status-filter" type="button" data-my-races-status-filter="all" aria-pressed="${active === 'all'}">${escapeHtml(SAVED_RACE_STATUS_COPY[language].all)} <span data-my-races-status-count="all">${total}</span></button>`, ...SAVED_RACE_STATUSES.map((status) => `<button class="my-races-status-filter" type="button" data-my-races-status-filter="${status}" aria-pressed="${active === status}">${escapeHtml(SAVED_RACE_STATUS_LABELS[language][status])} <span data-my-races-status-count="${status}">${counts[status]}</span></button>`)].join('')}</div>`;



type DeadlineEvent = Parameters<typeof buildRegistrationDeadlineCalendarInput>[0];
const renderDeadlineCalendarMenu = (input: DeadlineEvent, labels: Labels) => {
  const cal = buildRegistrationDeadlineCalendarInput(input);
  const google = buildGoogleCalendarEventUrl(cal);
  const ics = buildIcsDataUrl(cal);
  const outlook = buildOutlookCalendarEventUrl(cal);
  if (!google && !ics && !outlook) return '';
  return `<details class="deadline-calendar-menu"><summary>${escapeHtml(labels.addDeadline)}</summary><div class="deadline-calendar-actions">${google ? `<a href="${escapeHtml(google)}" target="_blank" rel="noopener">${escapeHtml(labels.google)}</a>` : ''}${ics ? `<a href="${escapeHtml(ics)}" download="${escapeHtml(buildIcsFilename(cal))}">${escapeHtml(labels.apple)}</a>` : ''}${outlook ? `<a href="${escapeHtml(outlook)}" target="_blank" rel="noopener">${escapeHtml(labels.outlook)}</a>` : ''}</div></details>`;
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
  return `<details class="race-calendar-menu" data-race-calendar-menu><summary><span class="action-icon">${renderActionIcon('calendar')}</span> ${escapeHtml(labels.addRace)}</summary><div class="race-calendar-actions" data-race-calendar-actions>${google ? `<a href="${escapeHtml(google)}" target="_blank" rel="noopener">${escapeHtml(labels.google)}</a>` : ''}${ics ? `<a href="${escapeHtml(ics)}" download="${escapeHtml(buildIcsFilename(cal))}">${escapeHtml(labels.apple)}</a>` : ''}${outlook ? `<a href="${escapeHtml(outlook)}" target="_blank" rel="noopener">${escapeHtml(labels.outlook)}</a>` : ''}</div></details>`;
};


const getRaceCardId = (key: string) => `my-race-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
const renderNextDeadlineSummary = (items: ReturnType<typeof getUpcomingSavedRaceDeadlines>, labels: Labels, language: 'sl' | 'en') => {
  const item = items[0];
  if (!item) return '';
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

const renderFallback = (race: SavedRace, labels: Labels, language: 'sl' | 'en') => `<article class="my-race-card is-muted" data-key="${escapeHtml(getSavedRaceKey(race))}"><div class="my-race-overview"><div class="my-race-main"><h3>${escapeHtml(race.title || labels.unresolved)}</h3><p>${escapeHtml([race.year, race.eventId, race.date].filter(Boolean).join(' · '))}</p></div><div class="my-race-card-status">${renderStatusSelect(race, language)}</div></div><div class="my-race-actions-secondary"><button class="my-race-remove" type="button" aria-label="${escapeHtml(`${labels.remove}: ${race.title || labels.unresolved}`)}" data-remove-saved-race data-event-id="${escapeHtml(race.eventId)}" data-event-year="${escapeHtml(race.year)}" data-event-title="${escapeHtml(race.title || labels.unresolved)}" data-event-date="${escapeHtml(race.date)}">${escapeHtml(labels.remove)}</button></div></article>`;

const renderEvent = (item: ReturnType<typeof resolveSavedRaces>[number] & { event: any }, labels: Labels, language: 'sl' | 'en', todayIso: string) => {
  if (!item.event) return renderFallback(item.savedRace, labels, language);
  const event = item.event;
  const location = [event.place, event.region].filter(Boolean).join(', ');
  const detailPath = getSavedRaceDetailPath(event, language);
  const actions = buildPrimaryActions(event, language);
  const registration = actions.filter((action) => action.kind === 'registration');
  const notices = actions.filter((action) => action.kind === 'notice');
  const renderActions = (items: typeof actions) => items.map((action) => `<a class="button button-small ${action.kind === 'registration' ? 'my-race-action-registration' : 'button-secondary-light my-race-action-notice'}" href="${escapeHtml(action.url)}" target="_blank" rel="noopener noreferrer"><span class="action-icon">${renderActionIcon(action.kind === 'registration' ? 'registration' : 'notice')}</span> ${escapeHtml(action.label)}</a>`).join('');
  return `<article id="${escapeHtml(getRaceCardId(item.key))}" class="my-race-card" data-key="${escapeHtml(item.key)}" data-analytics-placement="my_races" data-analytics-event-id="${escapeHtml(event.id)}" data-analytics-event-name="${escapeHtml(event.title)}" data-analytics-event-date="${escapeHtml(event.date)}" data-analytics-event-year="${escapeHtml(event.year)}"><div class="my-race-overview"><p class="my-race-date">${escapeHtml(formatDate(event.date, language))}</p><div class="my-race-main"><h3><a href="${escapeHtml(detailPath)}">${escapeHtml(event.title)}</a></h3><p class="my-race-location">${escapeHtml(location)}</p></div><div class="my-race-card-status">${renderStatusSelect({ ...item.savedRace, date: event.date, title: event.title }, language)}</div></div>${renderRaceCardDeadlines(event, detailPath, labels, language, todayIso)}<div class="my-race-actions"><div class="my-race-actions-primary">${renderActions(registration)}<a class="button button-small button-secondary-light my-race-action-details" href="${escapeHtml(detailPath)}"><span class="action-icon">${renderActionIcon('facts')}</span> ${escapeHtml(labels.details)}</a>${renderActions(notices)}${renderRaceCalendarMenu(event, location, labels, language)}</div><div class="my-race-actions-secondary"><button class="my-race-remove" type="button" aria-label="${escapeHtml(`${labels.remove}: ${event.title}`)}" data-remove-saved-race data-event-id="${escapeHtml(item.savedRace.eventId)}" data-event-year="${escapeHtml(item.savedRace.year)}" data-event-title="${escapeHtml(event.title)}" data-event-date="${escapeHtml(event.date)}">${escapeHtml(labels.remove)}</button></div></div></article>`;
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
  return true;
};

export const initMyRacesPage = async (root = document) => {
  const mount = root.querySelector<HTMLElement>('[data-my-races-app]');
  if (!mount) return;
  const language = mount.dataset.language === 'en' ? 'en' : 'sl';
  const labels = LABELS[language];
  const storage = getStorage();
  if (!storage) {
    trackStkPageLoadEventOnce(`my_races_viewed:${language}`, { event_type: 'my_races_viewed', language, placement: 'my_races' });
    mount.innerHTML = `<p class="notice warning">${labels.storageError}</p>${renderLocalNotice(labels)}`; return; }
  const saved = readSavedRaces(storage).state.races;
  trackStkPageLoadEventOnce(`my_races_viewed:${language}`, { event_type: 'my_races_viewed', language, placement: 'my_races', results_count: saved.length });
  if (!saved.length) { mount.innerHTML = `<p>${labels.empty}</p><a class="button" href="${language === 'en' ? '/en/find-races/' : '/iskalnik-tekov/'}">${labels.search}</a>${renderLocalNotice(labels)}`; return; }
  mount.textContent = labels.loading;
  const loadData = async (): Promise<MyRacesDataCache> => {
    const payloads: Record<string, unknown> = {};
    let apiOk = true;
    const additionalPromise = fetchAdditionalEventData().catch(() => [] as AdditionalEventData[]);
    await Promise.all(SUPPORTED_PUBLIC_YEARS.map(async (year: PublicYear) => {
      try { const response = await fetch(`${API_BASE}${buildMasterApiPath(year)}`, { headers: { Accept: 'application/json' } }); if (!response.ok) throw new Error(String(response.status)); payloads[year] = await response.json(); }
      catch { apiOk = false; }
    }));
    return { payloads, apiOk, additionalRows: await additionalPromise };
  };
  const data = await (pageDataCache.get(mount) ?? pageDataCache.set(mount, loadData()).get(mount)!);
  const { payloads, apiOk, additionalRows } = data;
  const todayIso = getTodayIsoInLjubljana();
  let resolved = sortResolvedSavedRaces(resolveSavedRaces(saved, payloads, todayIso));
  try {
    if (additionalRows.length) {
      const attached = attachAdditionalDataByMasterRow(resolved.filter((item) => item.event && isAdditionalDataEnabledForYear(item.event.year as PublicYear)).map((item) => item.event!), additionalRows);
      const byKey = new Map(attached.map((event) => [`${event.year}:${getStableEventId(event)}`, event]));
      resolved = resolved.map((item) => byKey.has(item.key) ? { ...item, event: byKey.get(item.key)! } : item);
    }
  } catch { /* optional additional data */ }
  const activeFilter = (mount.dataset.activeStatusFilter && (mount.dataset.activeStatusFilter === 'all' || isSavedRaceStatus(mount.dataset.activeStatusFilter))) ? mount.dataset.activeStatusFilter as MyRacesStatusFilter : 'all';
  const counts = countSavedRaceStatuses(resolved);
  const filtered = filterSavedRaceResolutionsByStatus(resolved, activeFilter);
  const upcoming = filtered.filter((item) => item.status === 'upcoming');
  const exportableUpcoming = getExportableUpcomingRaceEvents(resolved, language);
  const other = filtered.filter((item) => item.status !== 'upcoming');
  const emptyFiltered = activeFilter !== 'all' && !filtered.length;
  mount.innerHTML = `${apiOk ? '' : `<p class="notice warning">${labels.apiError}</p>`}${renderLocalNotice(labels)}${renderStatusFilters(counts, activeFilter, resolved.length, language)}${renderNextDeadlineSummary(getUpcomingSavedRaceDeadlines({ items: filtered as any, todayIso, windowDays: Number.MAX_SAFE_INTEGER, limit: 1 }), labels, language)}${emptyFiltered ? `<p>${labels.emptyFilter}</p>` : ''}${upcoming.length ? `<section><h2>${labels.upcoming}</h2>${renderExportToolbar(exportableUpcoming, labels)}<div class="my-race-list">${upcoming.map((item) => renderEvent(item as any, labels, language, todayIso)).join('')}</div></section>` : (!emptyFiltered && activeFilter === 'all' ? `<p>${labels.empty} <a href="${language === 'en' ? '/en/find-races/' : '/iskalnik-tekov/'}">${labels.search}</a>.</p>` : '')}${other.length ? `<section class="my-races-secondary"><h2>${labels.other}</h2><div class="my-race-list">${other.map((item) => renderEvent(item as any, labels, language, todayIso)).join('')}</div></section>` : ''}`;
  mount.querySelector<HTMLButtonElement>('[data-download-upcoming-races-ics]')?.addEventListener('click', () => downloadUpcomingRacesIcs(exportableUpcoming, labels, language === 'en' ? 'my-races.ics' : 'moji-teki.ics', mount.querySelector<HTMLElement>('[data-calendar-export-status]')));
  mount.querySelectorAll<HTMLButtonElement>('[data-my-races-status-filter]').forEach((button) => button.addEventListener('click', () => { mount.dataset.activeStatusFilter = button.dataset.myRacesStatusFilter || 'all'; initMyRacesPage(root); }));
  mount.querySelectorAll<HTMLSelectElement>('[data-my-race-status-select]').forEach((select) => select.addEventListener('change', () => { const status = select.value; const race = { eventId: select.dataset.eventId || '', year: select.dataset.eventYear || '', date: select.dataset.eventDate || '', title: select.dataset.eventTitle || '' }; if (isSavedRaceStatus(status)) setSavedRaceStatusInStorage(getStorage(), race, status); else removeSavedRaceFromMyRaces(getStorage(), race, { eventName: race.title, eventDate: race.date, language }); initMyRacesPage(root); }));
  mount.querySelectorAll<HTMLButtonElement>('[data-remove-saved-race]').forEach((button) => button.addEventListener('click', () => {
    removeSavedRaceFromMyRaces(getStorage(), { eventId: button.dataset.eventId || '', year: button.dataset.eventYear || '' }, { eventName: button.dataset.eventTitle || '', eventDate: button.dataset.eventDate || '', language });
    initMyRacesPage(root);
  }));
};
