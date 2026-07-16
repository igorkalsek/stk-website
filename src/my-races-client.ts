import { trackStkEvent, trackStkPageLoadEventOnce } from './lib/stkAnalytics.js';
import { buildGoogleCalendarEventUrl, buildIcsCalendar, buildIcsDataUrl, buildIcsFilename, buildOutlookCalendarEventUrl, buildRegistrationDeadlineCalendarInput, type MultiIcsCalendarEventInput } from './utils-calendar.js';
import { countSavedRaceStatuses, filterSavedRaceResolutionsByStatus, getSavedRaceDetailPath, getUpcomingSavedRaceDeadlines, groupUpcomingDeadlinesByRace, resolveSavedRaces, sortResolvedSavedRaces, type MyRacesStatusFilter } from './utils-my-races.js';
import { getSavedRaceKey, isRaceSaved, isSavedRaceStatus, readSavedRaces, removeSavedRaceFromStorage, SAVED_RACE_STATUSES, SAVED_RACE_STATUS_COPY, SAVED_RACE_STATUS_LABELS, setSavedRaceStatusInStorage, type MinimalStorage, type SavedRace, type SavedRaceStatus } from './utils-saved-races.js';
import { buildMasterApiPath, isAdditionalDataEnabledForYear, SUPPORTED_PUBLIC_YEARS, type PublicYear } from './utils-public-year.js';
import { getStableEventId } from './utils-event-detail.js';
import { buildPrimaryActions } from './utils-race-detail-view.js';
import { getTodayIsoInLjubljana } from './utils-date.js';
import { attachAdditionalDataByMasterRow, fetchAdditionalEventData, type AdditionalEventData } from './utils-additional.js';
import { buildRegistrationDeadlineViews, formatRegistrationDeadlineRelative, getRegistrationDeadlineCssState, type RegistrationDeadlineView } from './utils-registration-deadlines.js';

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

type Labels = Record<'deadlinePanel' | 'earlyRegistration' | 'registrationDeadline' | 'addDeadline' | 'addRace' | 'racePrefix' | 'daysLeft' | 'tomorrow' | 'today' | 'verifyDeadline' | 'deadlineUnavailable' | 'deadlinePrefix' | 'untilPrefix' | 'loading' | 'empty' | 'search' | 'upcoming' | 'other' | 'unresolved' | 'remove' | 'details' | 'google' | 'apple' | 'outlook' | 'apiError' | 'storageError' | 'local' | 'downloadAll' | 'downloadAllNote' | 'calendarError' | 'emptyFilter', string>;
const LABELS: Record<'sl' | 'en', Labels> = {
  sl: { deadlinePanel: 'Prihajajoči prijavni roki', earlyRegistration: 'Cenejša prijava do', registrationDeadline: 'Prijave do', addDeadline: 'Dodaj rok v koledar', addRace: 'Dodaj tek v koledar', racePrefix: 'Tek:', daysLeft: 'še {n} dni', tomorrow: 'jutri', today: 'danes', verifyDeadline: 'Rok preverite v uradnem razpisu.', deadlineUnavailable: 'Podatki o prijavnih rokih trenutno niso na voljo.', deadlinePrefix: 'Rok:', untilPrefix: 'Do', loading: 'Nalagamo shranjene teke …', empty: 'Nimate še shranjenih tekov.', search: 'Odprite iskalnik tekov', upcoming: 'Prihodnji teki', other: 'Pretekli ali trenutno nerazrešeni teki', unresolved: 'Shranjena referenca', remove: 'Odstrani', details: 'Podrobnosti', google: 'Google koledar', apple: 'Apple/iCal', outlook: 'Outlook', apiError: 'API trenutno ni dosegljiv. Prikazane so osnovne shranjene reference.', storageError: 'Brskalnik trenutno ne dovoljuje dostopa do shranjenih tekov.', local: 'Shranjeni teki in njihovi osebni statusi so shranjeni samo v vašem brskalniku. Ne pošiljajo se na strežnik in se ne sinhronizirajo med napravami.', downloadAll: 'Prenesi vse prihodnje teke (.ics)', downloadAllNote: 'Datoteka vsebuje prihodnje shranjene teke, razen tekov z oznako Opravljen.', emptyFilter: 'V tem statusu ni shranjenih tekov.', calendarError: 'Koledarske datoteke trenutno ni bilo mogoče pripraviti.' },
  en: { deadlinePanel: 'Upcoming registration deadlines', earlyRegistration: 'Early registration until', registrationDeadline: 'Registration until', addDeadline: 'Add deadline to calendar', addRace: 'Add race to calendar', racePrefix: 'Race:', daysLeft: '{n} days left', tomorrow: 'tomorrow', today: 'today', verifyDeadline: 'Verify the deadline in the official announcement.', deadlineUnavailable: 'Registration deadline information is currently unavailable.', deadlinePrefix: 'Deadline:', untilPrefix: 'Until', loading: 'Loading saved races …', empty: 'You have not saved any races yet.', search: 'Open race finder', upcoming: 'Upcoming races', other: 'Past or currently unresolved races', unresolved: 'Saved reference', remove: 'Remove', details: 'Details', google: 'Google Calendar', apple: 'Apple/iCal', outlook: 'Outlook', apiError: 'The API is currently unavailable. Basic saved references are shown below.', storageError: 'The browser currently does not allow access to saved races.', local: 'Saved races and their personal statuses are stored only in your browser. They are not sent to the server and do not sync between devices.', downloadAll: 'Download all upcoming races (.ics)', downloadAllNote: 'The file contains upcoming saved races except races marked Completed.', emptyFilter: 'There are no saved races with this status.', calendarError: 'The calendar file could not be prepared at this time.' }
};

export const getStorage = (): MinimalStorage | null => {
  try { return window.localStorage; } catch { return null; }
};

export const renderPrimaryActionLinks = (event: Parameters<typeof buildPrimaryActions>[0], language: 'sl' | 'en') => buildPrimaryActions(event, language)
  .map((action) => `<a class="button button-small button-secondary-light" href="${escapeHtml(action.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(action.label)}</a>`)
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


const renderStatusBadge = (status: SavedRaceStatus, language: 'sl' | 'en') => `<span class="race-status-badge" data-race-status-badge>${escapeHtml(SAVED_RACE_STATUS_LABELS[language][status])}</span>`;
const renderStatusSelect = (race: SavedRace, language: 'sl' | 'en') => {
  const copy = SAVED_RACE_STATUS_COPY[language];
  const id = `status-${race.year}-${race.eventId}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `<label class="sr-only" for="${escapeHtml(id)}">${escapeHtml(copy.label)}</label><select id="${escapeHtml(id)}" class="race-status-select" data-my-race-status-select data-race-status-control data-event-id="${escapeHtml(race.eventId)}" data-event-year="${escapeHtml(race.year)}" data-event-date="${escapeHtml(race.date)}" data-event-title="${escapeHtml(race.title)}" data-language="${language}"><option value="">${escapeHtml(copy.empty)}</option>${SAVED_RACE_STATUSES.map((status) => `<option value="${status}"${race.status === status ? ' selected' : ''}>${escapeHtml(SAVED_RACE_STATUS_LABELS[language][status])}</option>`).join('')}</select>`;
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
const renderDeadlineItem = (deadline: RegistrationDeadlineView, event: { id: string; year: string; title: string; date: string; registrationUrl: string }, detailUrl: string, labels: Labels, language: 'sl' | 'en', compact = false) => {
  const relative = formatRegistrationDeadlineRelative(deadline, language);
  const css = getRegistrationDeadlineCssState(deadline);
  const calendar = deadline.state === 'past' ? '' : renderDeadlineCalendarMenu({ eventId: event.id, eventYear: event.year, eventTitle: event.title, deadlineKind: deadline.kind, deadlineDate: deadline.date, detailUrl, registrationUrl: event.registrationUrl, language }, labels);
  return `<div class="registration-deadline-item ${css}" data-deadline-item data-deadline-kind="${deadline.kind}"><p class="registration-deadline-relative">${escapeHtml(relative)}</p><p class="registration-deadline-absolute">${escapeHtml(compact ? deadlineLabel(deadline, labels) : (deadline.kind === 'early' ? labels.untilPrefix : labels.deadlinePrefix))} ${escapeHtml(compact ? formatDeadlineDateAfterUntil(deadline.date, language, true) : formatDate(deadline.date, language))}</p>${calendar}</div>`;
};


const conciseRelative = (deadline: RegistrationDeadlineView, labels: Labels) => deadline.state === 'today' ? labels.today : deadline.state === 'tomorrow' ? labels.tomorrow : labels.daysLeft.replace('{n}', String(deadline.daysRemaining));

export const renderRaceCardDeadlineSummary = (event: { date: string; additionalData?: AdditionalEventData | null }, labels: Labels, language: 'sl' | 'en', todayIso: string) => {
  const deadline = buildRegistrationDeadlineViews({ todayIso, eventDate: event.date, registrationDeadline: event.additionalData?.registrationDeadline, earlyRegistrationDeadline: event.additionalData?.earlyRegistrationDeadline })
    .filter((item) => item.state === 'today' || item.state === 'tomorrow' || item.state === 'future')
    .sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'registration' ? -1 : 1))[0];
  if (!deadline) return '';
  const css = getRegistrationDeadlineCssState(deadline);
  return `<p class="my-race-deadline-summary ${css}" data-my-race-deadline-summary data-deadline-kind="${deadline.kind}">${escapeHtml(deadlineLabel(deadline, labels))} ${escapeHtml(formatDeadlineDateAfterUntil(deadline.date, language))} · ${escapeHtml(conciseRelative(deadline, labels))}</p>`;
};

const renderRaceCalendarMenu = (event: { title: string; date: string; noticeUrl?: string; registrationUrl?: string }, location: string, labels: Labels, language: 'sl' | 'en') => {
  const cal = { title: event.title, date: event.date, location, noticeUrl: event.noticeUrl, registrationUrl: event.registrationUrl, language };
  const google = buildGoogleCalendarEventUrl(cal);
  const ics = buildIcsDataUrl(cal);
  const outlook = buildOutlookCalendarEventUrl(cal);
  if (!google && !ics && !outlook) return '';
  return `<details class="race-calendar-menu" data-race-calendar-menu><summary>${escapeHtml(labels.addRace)}</summary><div class="race-calendar-actions" data-race-calendar-actions>${google ? `<a href="${escapeHtml(google)}" target="_blank" rel="noopener">${escapeHtml(labels.google)}</a>` : ''}${ics ? `<a href="${escapeHtml(ics)}" download="${escapeHtml(buildIcsFilename(cal))}">${escapeHtml(labels.apple)}</a>` : ''}${outlook ? `<a href="${escapeHtml(outlook)}" target="_blank" rel="noopener">${escapeHtml(labels.outlook)}</a>` : ''}</div></details>`;
};


const renderUpcomingDeadlinesPanel = (items: ReturnType<typeof getUpcomingSavedRaceDeadlines>, labels: Labels, language: 'sl' | 'en') => {
  const groups = groupUpcomingDeadlinesByRace(items);
  return groups.length ? `<section class="upcoming-deadlines-panel" data-upcoming-deadlines-panel><h2>${escapeHtml(labels.deadlinePanel)}</h2><div class="upcoming-deadline-list">${groups.map((group) => `<article class="upcoming-deadline-group" data-upcoming-deadline-group data-upcoming-deadline-group-key="${escapeHtml(group.key)}"><div class="upcoming-deadline-group-header"><h3><a href="${escapeHtml(getSavedRaceDetailPath(group.event, language))}">${escapeHtml(group.event.title)}</a></h3><p>${escapeHtml(labels.racePrefix)} ${escapeHtml(formatDate(group.event.date, language))}</p></div><div class="upcoming-deadline-group-list" data-upcoming-deadline-group-list>${group.items.map((item) => `<div class="upcoming-deadline-item" data-upcoming-deadline-item>${renderDeadlineItem(item.deadline, item.event, getSavedRaceDetailPath(item.event, language), labels, language, true)}</div>`).join('')}</div></article>`).join('')}</div></section>` : '';
};

const renderExportToolbar = (events: MultiIcsCalendarEventInput[], labels: Labels) => events.length ? `<div class="my-races-toolbar"><div><button class="button button-small" type="button" data-download-upcoming-races-ics><span aria-hidden="true">📅</span> ${escapeHtml(labels.downloadAll)}</button><p>${escapeHtml(labels.downloadAllNote)}</p></div><p class="notice warning" data-calendar-export-status aria-live="polite" hidden></p></div>` : '';

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

const renderFallback = (race: SavedRace, labels: Labels, language: 'sl' | 'en') => `<article class="my-race-card is-muted" data-key="${escapeHtml(getSavedRaceKey(race))}"><div><h3>${escapeHtml(race.title || labels.unresolved)}</h3><p>${escapeHtml([race.year, race.eventId, race.date].filter(Boolean).join(' · '))}</p><div class="my-race-card-status">${renderStatusBadge(race.status, language)}${renderStatusSelect(race, language)}</div></div><button class="button button-small button-secondary-light" type="button" data-remove-saved-race data-event-id="${escapeHtml(race.eventId)}" data-event-year="${escapeHtml(race.year)}" data-event-title="${escapeHtml(race.title || labels.unresolved)}" data-event-date="${escapeHtml(race.date)}">${labels.remove}</button></article>`;

const renderEvent = (item: ReturnType<typeof resolveSavedRaces>[number] & { event: any }, labels: Labels, language: 'sl' | 'en', todayIso: string) => {
  if (!item.event) return renderFallback(item.savedRace, labels, language);
  const event = item.event;
  const location = [event.place, event.region].filter(Boolean).join(', ');
  const detailPath = getSavedRaceDetailPath(event, language);
  return `<article class="my-race-card" data-key="${escapeHtml(item.key)}" data-analytics-placement="my_races" data-analytics-event-id="${escapeHtml(event.id)}" data-analytics-event-name="${escapeHtml(event.title)}" data-analytics-event-date="${escapeHtml(event.date)}" data-analytics-event-year="${escapeHtml(event.year)}"><div><p class="my-race-date">${escapeHtml(formatDate(event.date, language))}</p><h3><a href="${escapeHtml(detailPath)}">${escapeHtml(event.title)}</a></h3><p>${escapeHtml(location)}</p><div class="my-race-card-status">${renderStatusBadge(item.savedRace.status, language)}${renderStatusSelect({ ...item.savedRace, date: event.date, title: event.title }, language)}</div>${renderRaceCardDeadlineSummary(event, labels, language, todayIso)}</div><div class="my-race-actions"><div class="my-race-actions-primary"><a class="button button-small" href="${escapeHtml(detailPath)}">${escapeHtml(labels.details)}</a>${renderPrimaryActionLinks(event, language)}${renderRaceCalendarMenu(event, location, labels, language)}</div><div class="my-race-actions-secondary"><button class="button button-small button-secondary-light" type="button" data-remove-saved-race data-event-id="${escapeHtml(item.savedRace.eventId)}" data-event-year="${escapeHtml(item.savedRace.year)}" data-event-title="${escapeHtml(event.title)}" data-event-date="${escapeHtml(event.date)}">${escapeHtml(labels.remove)}</button></div></div></article>`;
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
    mount.innerHTML = `<p class="notice warning">${labels.storageError}</p><p class="muted-note">${labels.local}</p>`; return; }
  const saved = readSavedRaces(storage).state.races;
  trackStkPageLoadEventOnce(`my_races_viewed:${language}`, { event_type: 'my_races_viewed', language, placement: 'my_races', results_count: saved.length });
  if (!saved.length) { mount.innerHTML = `<p>${labels.empty}</p><a class="button" href="${language === 'en' ? '/en/find-races/' : '/iskalnik-tekov/'}">${labels.search}</a><p class="muted-note">${labels.local}</p>`; return; }
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
  mount.innerHTML = `${apiOk ? '' : `<p class="notice warning">${labels.apiError}</p>`}<p class="muted-note">${labels.local}</p>${renderStatusFilters(counts, activeFilter, resolved.length, language)}${renderUpcomingDeadlinesPanel(getUpcomingSavedRaceDeadlines({ items: resolved as any, todayIso }), labels, language)}${emptyFiltered ? `<p>${labels.emptyFilter}</p>` : ''}${upcoming.length ? `<section><h2>${labels.upcoming}</h2>${renderExportToolbar(exportableUpcoming, labels)}<div class="my-race-list">${upcoming.map((item) => renderEvent(item as any, labels, language, todayIso)).join('')}</div></section>` : (!emptyFiltered && activeFilter === 'all' ? `<p>${labels.empty} <a href="${language === 'en' ? '/en/find-races/' : '/iskalnik-tekov/'}">${labels.search}</a>.</p>` : '')}${other.length ? `<section class="my-races-secondary"><h2>${labels.other}</h2><div class="my-race-list">${other.map((item) => renderEvent(item as any, labels, language, todayIso)).join('')}</div></section>` : ''}`;
  mount.querySelector<HTMLButtonElement>('[data-download-upcoming-races-ics]')?.addEventListener('click', () => downloadUpcomingRacesIcs(exportableUpcoming, labels, language === 'en' ? 'my-races.ics' : 'moji-teki.ics', mount.querySelector<HTMLElement>('[data-calendar-export-status]')));
  mount.querySelectorAll<HTMLButtonElement>('[data-my-races-status-filter]').forEach((button) => button.addEventListener('click', () => { mount.dataset.activeStatusFilter = button.dataset.myRacesStatusFilter || 'all'; initMyRacesPage(root); }));
  mount.querySelectorAll<HTMLSelectElement>('[data-my-race-status-select]').forEach((select) => select.addEventListener('change', () => { const status = select.value; const race = { eventId: select.dataset.eventId || '', year: select.dataset.eventYear || '', date: select.dataset.eventDate || '', title: select.dataset.eventTitle || '' }; if (isSavedRaceStatus(status)) setSavedRaceStatusInStorage(getStorage(), race, status); else removeSavedRaceFromMyRaces(getStorage(), race, { eventName: race.title, eventDate: race.date, language }); initMyRacesPage(root); }));
  mount.querySelectorAll<HTMLButtonElement>('[data-remove-saved-race]').forEach((button) => button.addEventListener('click', () => {
    removeSavedRaceFromMyRaces(getStorage(), { eventId: button.dataset.eventId || '', year: button.dataset.eventYear || '' }, { eventName: button.dataset.eventTitle || '', eventDate: button.dataset.eventDate || '', language });
    initMyRacesPage(root);
  }));
};
