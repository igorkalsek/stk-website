import { trackStkEvent, trackStkPageLoadEventOnce } from './lib/stkAnalytics.js';
import { buildGoogleCalendarEventUrl, buildIcsCalendar, buildIcsDataUrl, buildIcsFilename, buildOutlookCalendarEventUrl, type MultiIcsCalendarEventInput } from './utils-calendar.js';
import { countSavedRaceStatuses, filterSavedRaceResolutionsByStatus, getSavedRaceDetailPath, resolveSavedRaces, sortResolvedSavedRaces, type MyRacesStatusFilter } from './utils-my-races.js';
import { getSavedRaceKey, isRaceSaved, isSavedRaceStatus, readSavedRaces, removeSavedRaceFromStorage, SAVED_RACE_STATUSES, SAVED_RACE_STATUS_COPY, SAVED_RACE_STATUS_LABELS, setSavedRaceStatusInStorage, type MinimalStorage, type SavedRace, type SavedRaceStatus } from './utils-saved-races.js';
import { buildMasterApiPath, SUPPORTED_PUBLIC_YEARS, type PublicYear } from './utils-public-year.js';
import { buildPrimaryActions } from './utils-race-detail-view.js';
import { getTodayIsoInLjubljana } from './utils-date.js';

const API_BASE = 'https://stk-master-api.igor-kalsek.workers.dev';
const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);
const formatDate = (value: string, language: 'sl' | 'en') => value ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'sl-SI', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : '';

type Labels = Record<'loading' | 'empty' | 'search' | 'upcoming' | 'other' | 'unresolved' | 'remove' | 'details' | 'google' | 'apple' | 'outlook' | 'apiError' | 'storageError' | 'local' | 'downloadAll' | 'downloadAllNote' | 'calendarError' | 'emptyFilter', string>;
const LABELS: Record<'sl' | 'en', Labels> = {
  sl: { loading: 'Nalagamo shranjene teke …', empty: 'Nimate še shranjenih tekov.', search: 'Odprite iskalnik tekov', upcoming: 'Prihodnji teki', other: 'Pretekli ali trenutno nerazrešeni teki', unresolved: 'Shranjena referenca', remove: 'Odstrani', details: 'Podrobnosti', google: 'Google', apple: 'Apple/iCal', outlook: 'Outlook', apiError: 'API trenutno ni dosegljiv. Prikazane so osnovne shranjene reference.', storageError: 'Brskalnik trenutno ne dovoljuje dostopa do shranjenih tekov.', local: 'Shranjeni teki in njihovi osebni statusi so shranjeni samo v vašem brskalniku. Ne pošiljajo se na strežnik in se ne sinhronizirajo med napravami.', downloadAll: 'Prenesi vse prihodnje teke (.ics)', downloadAllNote: 'Datoteka vsebuje prihodnje shranjene teke, razen tekov z oznako Opravljen.', emptyFilter: 'V tem statusu ni shranjenih tekov.', calendarError: 'Koledarske datoteke trenutno ni bilo mogoče pripraviti.' },
  en: { loading: 'Loading saved races …', empty: 'You have not saved any races yet.', search: 'Open race finder', upcoming: 'Upcoming races', other: 'Past or currently unresolved races', unresolved: 'Saved reference', remove: 'Remove', details: 'Details', google: 'Google', apple: 'Apple/iCal', outlook: 'Outlook', apiError: 'The API is currently unavailable. Basic saved references are shown below.', storageError: 'The browser currently does not allow access to saved races.', local: 'Saved races and their personal statuses are stored only in your browser. They are not sent to the server and do not sync between devices.', downloadAll: 'Download all upcoming races (.ics)', downloadAllNote: 'The file contains upcoming saved races except races marked Completed.', emptyFilter: 'There are no saved races with this status.', calendarError: 'The calendar file could not be prepared at this time.' }
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
const renderStatusSummary = (counts: Record<SavedRaceStatus, number>, language: 'sl' | 'en') => `<div class="my-races-status-summary">${SAVED_RACE_STATUSES.map((status) => `<span><strong>${escapeHtml(SAVED_RACE_STATUS_LABELS[language][status])}</strong> ${counts[status]}</span>`).join('')}</div>`;
const renderStatusFilters = (counts: Record<SavedRaceStatus, number>, active: MyRacesStatusFilter, total: number, language: 'sl' | 'en') => `<div class="my-races-status-filters" role="group" aria-label="${escapeHtml(SAVED_RACE_STATUS_COPY[language].label)}">${[`<button class="my-races-status-filter" type="button" data-my-races-status-filter="all" aria-pressed="${active === 'all'}">${escapeHtml(SAVED_RACE_STATUS_COPY[language].all)} <span>${total}</span></button>`, ...SAVED_RACE_STATUSES.map((status) => `<button class="my-races-status-filter" type="button" data-my-races-status-filter="${status}" aria-pressed="${active === status}">${escapeHtml(SAVED_RACE_STATUS_LABELS[language][status])} <span>${counts[status]}</span></button>`)].join('')}</div>`;

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

const renderEvent = (item: ReturnType<typeof resolveSavedRaces>[number], labels: Labels, language: 'sl' | 'en') => {
  if (!item.event) return renderFallback(item.savedRace, labels, language);
  const event = item.event;
  const location = [event.place, event.region].filter(Boolean).join(', ');
  const cal = { title: event.title, date: event.date, location, noticeUrl: event.noticeUrl, registrationUrl: event.registrationUrl, language };
  const google = buildGoogleCalendarEventUrl(cal);
  const ics = buildIcsDataUrl(cal);
  const outlook = buildOutlookCalendarEventUrl(cal);
  return `<article class="my-race-card" data-key="${escapeHtml(item.key)}" data-analytics-placement="my_races" data-analytics-event-id="${escapeHtml(event.id)}" data-analytics-event-name="${escapeHtml(event.title)}" data-analytics-event-date="${escapeHtml(event.date)}" data-analytics-event-year="${escapeHtml(event.year)}"><div><p class="my-race-date">${escapeHtml(formatDate(event.date, language))}</p><h3><a href="${escapeHtml(getSavedRaceDetailPath(event, language))}">${escapeHtml(event.title)}</a></h3><p>${escapeHtml(location)}</p><div class="my-race-card-status">${renderStatusBadge(item.savedRace.status, language)}${renderStatusSelect({ ...item.savedRace, date: event.date, title: event.title }, language)}</div></div><div class="my-race-actions"><a class="button button-small" href="${escapeHtml(getSavedRaceDetailPath(event, language))}">${labels.details}</a>${renderPrimaryActionLinks(event, language)}${google ? `<a class="button button-small button-secondary-light" href="${escapeHtml(google)}" target="_blank" rel="noopener">${labels.google}</a>` : ''}${ics ? `<a class="button button-small button-secondary-light" href="${escapeHtml(ics)}" download="${escapeHtml(buildIcsFilename(cal))}">${labels.apple}</a>` : ''}${outlook ? `<a class="button button-small button-secondary-light" href="${escapeHtml(outlook)}" target="_blank" rel="noopener">${labels.outlook}</a>` : ''}<button class="button button-small button-secondary-light" type="button" data-remove-saved-race data-event-id="${escapeHtml(item.savedRace.eventId)}" data-event-year="${escapeHtml(item.savedRace.year)}" data-event-title="${escapeHtml(event.title)}" data-event-date="${escapeHtml(event.date)}">${labels.remove}</button></div></article>`;
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
  const payloads: Record<string, unknown> = {};
  let apiOk = true;
  await Promise.all(SUPPORTED_PUBLIC_YEARS.map(async (year: PublicYear) => {
    try { const response = await fetch(`${API_BASE}${buildMasterApiPath(year)}`, { headers: { Accept: 'application/json' } }); if (!response.ok) throw new Error(String(response.status)); payloads[year] = await response.json(); }
    catch { apiOk = false; }
  }));
  const resolved = sortResolvedSavedRaces(resolveSavedRaces(saved, payloads, getTodayIsoInLjubljana()));
  const activeFilter = (mount.dataset.activeStatusFilter && (mount.dataset.activeStatusFilter === 'all' || isSavedRaceStatus(mount.dataset.activeStatusFilter))) ? mount.dataset.activeStatusFilter as MyRacesStatusFilter : 'all';
  const counts = countSavedRaceStatuses(resolved);
  const filtered = filterSavedRaceResolutionsByStatus(resolved, activeFilter);
  const upcoming = filtered.filter((item) => item.status === 'upcoming');
  const exportableUpcoming = getExportableUpcomingRaceEvents(resolved, language);
  const other = filtered.filter((item) => item.status !== 'upcoming');
  const emptyFiltered = activeFilter !== 'all' && !filtered.length;
  mount.innerHTML = `${apiOk ? '' : `<p class="notice warning">${labels.apiError}</p>`}<p class="muted-note">${labels.local}</p>${renderStatusSummary(counts, language)}${renderStatusFilters(counts, activeFilter, resolved.length, language)}${emptyFiltered ? `<p>${labels.emptyFilter}</p>` : ''}${upcoming.length ? `<section><h2>${labels.upcoming}</h2>${renderExportToolbar(exportableUpcoming, labels)}<div class="my-race-list">${upcoming.map((item) => renderEvent(item, labels, language)).join('')}</div></section>` : (!emptyFiltered && activeFilter === 'all' ? `<p>${labels.empty} <a href="${language === 'en' ? '/en/find-races/' : '/iskalnik-tekov/'}">${labels.search}</a>.</p>` : '')}${other.length ? `<section class="my-races-secondary"><h2>${labels.other}</h2><div class="my-race-list">${other.map((item) => renderEvent(item, labels, language)).join('')}</div></section>` : ''}`;
  mount.querySelector<HTMLButtonElement>('[data-download-upcoming-races-ics]')?.addEventListener('click', () => downloadUpcomingRacesIcs(exportableUpcoming, labels, language === 'en' ? 'my-races.ics' : 'moji-teki.ics', mount.querySelector<HTMLElement>('[data-calendar-export-status]')));
  mount.querySelectorAll<HTMLButtonElement>('[data-my-races-status-filter]').forEach((button) => button.addEventListener('click', () => { mount.dataset.activeStatusFilter = button.dataset.myRacesStatusFilter || 'all'; initMyRacesPage(root); }));
  mount.querySelectorAll<HTMLSelectElement>('[data-my-race-status-select]').forEach((select) => select.addEventListener('change', () => { const status = select.value; const race = { eventId: select.dataset.eventId || '', year: select.dataset.eventYear || '', date: select.dataset.eventDate || '', title: select.dataset.eventTitle || '' }; if (isSavedRaceStatus(status)) setSavedRaceStatusInStorage(getStorage(), race, status); else removeSavedRaceFromMyRaces(getStorage(), race, { eventName: race.title, eventDate: race.date, language }); initMyRacesPage(root); }));
  mount.querySelectorAll<HTMLButtonElement>('[data-remove-saved-race]').forEach((button) => button.addEventListener('click', () => {
    removeSavedRaceFromMyRaces(getStorage(), { eventId: button.dataset.eventId || '', year: button.dataset.eventYear || '' }, { eventName: button.dataset.eventTitle || '', eventDate: button.dataset.eventDate || '', language });
    initMyRacesPage(root);
  }));
};
