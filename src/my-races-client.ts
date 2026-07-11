import { buildGoogleCalendarEventUrl, buildIcsDataUrl, buildIcsFilename, buildOutlookCalendarEventUrl } from './utils-calendar';
import { getSavedRaceDetailPath, resolveSavedRaces, sortResolvedSavedRaces } from './utils-my-races';
import { getSavedRaceKey, readSavedRaces, removeSavedRaceFromStorage, type SavedRace } from './utils-saved-races';
import { buildMasterApiPath, SUPPORTED_PUBLIC_YEARS, type PublicYear } from './utils-public-year';

const API_BASE = 'https://stk-master-api.igor-kalsek.workers.dev';
const todayIso = () => new Date().toISOString().slice(0, 10);
const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);
const formatDate = (value: string, language: 'sl' | 'en') => value ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'sl-SI', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : '';

type Labels = Record<'loading' | 'empty' | 'search' | 'upcoming' | 'other' | 'unresolved' | 'remove' | 'details' | 'notice' | 'registration' | 'google' | 'apple' | 'outlook' | 'apiError' | 'local', string>;
const LABELS: Record<'sl' | 'en', Labels> = {
  sl: { loading: 'Nalagamo shranjene teke …', empty: 'Nimate še shranjenih tekov.', search: 'Odprite iskalnik tekov', upcoming: 'Prihodnji teki', other: 'Pretekli ali trenutno nerazrešeni teki', unresolved: 'Shranjena referenca', remove: 'Odstrani', details: 'Podrobnosti', notice: 'Razpis', registration: 'Prijava', google: 'Google', apple: 'Apple/iCal', outlook: 'Outlook', apiError: 'API trenutno ni dosegljiv. Prikazane so osnovne shranjene reference.', local: 'Seznam je shranjen samo v tem brskalniku in se ne sinhronizira med napravami.' },
  en: { loading: 'Loading saved races …', empty: 'You have not saved any races yet.', search: 'Open race finder', upcoming: 'Upcoming races', other: 'Past or currently unresolved races', unresolved: 'Saved reference', remove: 'Remove', details: 'Details', notice: 'Official info', registration: 'Registration', google: 'Google', apple: 'Apple/iCal', outlook: 'Outlook', apiError: 'The API is currently unavailable. Basic saved references are shown below.', local: 'This list is saved only in this browser and does not sync between devices.' }
};

const renderFallback = (race: SavedRace, labels: Labels) => `<article class="my-race-card is-muted" data-key="${escapeHtml(getSavedRaceKey(race))}"><h3>${escapeHtml(race.title || labels.unresolved)}</h3><p>${escapeHtml([race.year, race.eventId, race.date].filter(Boolean).join(' · '))}</p><button class="button button-small button-secondary-light" type="button" data-remove-saved-race data-event-id="${escapeHtml(race.eventId)}" data-event-year="${escapeHtml(race.year)}">${labels.remove}</button></article>`;

const renderEvent = (item: ReturnType<typeof resolveSavedRaces>[number], labels: Labels, language: 'sl' | 'en') => {
  if (!item.event) return renderFallback(item.savedRace, labels);
  const event = item.event;
  const location = [event.place, event.region].filter(Boolean).join(', ');
  const cal = { title: event.title, date: event.date, location, noticeUrl: event.noticeUrl, registrationUrl: event.registrationUrl, language };
  const google = buildGoogleCalendarEventUrl(cal);
  const ics = buildIcsDataUrl(cal);
  const outlook = buildOutlookCalendarEventUrl(cal);
  return `<article class="my-race-card" data-key="${escapeHtml(item.key)}"><div><p class="eyebrow">${escapeHtml(formatDate(event.date, language))}</p><h3><a href="${escapeHtml(getSavedRaceDetailPath(event, language))}">${escapeHtml(event.title)}</a></h3><p>${escapeHtml(location)}</p></div><div class="my-race-actions"><a class="button button-small" href="${escapeHtml(getSavedRaceDetailPath(event, language))}">${labels.details}</a>${event.noticeUrl ? `<a class="button button-small button-secondary-light" href="${escapeHtml(event.noticeUrl)}" target="_blank" rel="noopener">${labels.notice}</a>` : ''}${event.registrationUrl ? `<a class="button button-small button-secondary-light" href="${escapeHtml(event.registrationUrl)}" target="_blank" rel="noopener">${labels.registration}</a>` : ''}${google ? `<a class="button button-small button-secondary-light" href="${escapeHtml(google)}" target="_blank" rel="noopener">${labels.google}</a>` : ''}${ics ? `<a class="button button-small button-secondary-light" href="${escapeHtml(ics)}" download="${escapeHtml(buildIcsFilename(cal))}">${labels.apple}</a>` : ''}${outlook ? `<a class="button button-small button-secondary-light" href="${escapeHtml(outlook)}" target="_blank" rel="noopener">${labels.outlook}</a>` : ''}<button class="button button-small button-secondary-light" type="button" data-remove-saved-race data-event-id="${escapeHtml(item.savedRace.eventId)}" data-event-year="${escapeHtml(item.savedRace.year)}">${labels.remove}</button></div></article>`;
};

export const initMyRacesPage = async (root = document) => {
  const mount = root.querySelector<HTMLElement>('[data-my-races-app]');
  if (!mount) return;
  const language = mount.dataset.language === 'en' ? 'en' : 'sl';
  const labels = LABELS[language];
  const storage = readSavedRaces(window.localStorage);
  const saved = storage.state.races;
  if (!saved.length) { mount.innerHTML = `<p>${labels.empty}</p><a class="button" href="${language === 'en' ? '/en/find-races/' : '/iskalnik-tekov/'}">${labels.search}</a><p class="muted-note">${labels.local}</p>`; return; }
  mount.textContent = labels.loading;
  const payloads: Record<string, unknown> = {};
  let apiOk = true;
  await Promise.all(SUPPORTED_PUBLIC_YEARS.map(async (year: PublicYear) => {
    try { const response = await fetch(`${API_BASE}${buildMasterApiPath(year)}`, { headers: { Accept: 'application/json' } }); if (!response.ok) throw new Error(String(response.status)); payloads[year] = await response.json(); }
    catch { apiOk = false; }
  }));
  const resolved = sortResolvedSavedRaces(resolveSavedRaces(saved, payloads, todayIso()));
  const upcoming = resolved.filter((item) => item.status === 'upcoming');
  const other = resolved.filter((item) => item.status !== 'upcoming');
  mount.innerHTML = `${apiOk ? '' : `<p class="notice warning">${labels.apiError}</p>`}<p class="muted-note">${labels.local}</p>${upcoming.length ? `<section><h2>${labels.upcoming}</h2><div class="my-race-list">${upcoming.map((item) => renderEvent(item, labels, language)).join('')}</div></section>` : `<p>${labels.empty} <a href="${language === 'en' ? '/en/find-races/' : '/iskalnik-tekov/'}">${labels.search}</a>.</p>`}${other.length ? `<section class="my-races-secondary"><h2>${labels.other}</h2><div class="my-race-list">${other.map((item) => renderEvent(item, labels, language)).join('')}</div></section>` : ''}`;
  mount.querySelectorAll<HTMLButtonElement>('[data-remove-saved-race]').forEach((button) => button.addEventListener('click', () => { removeSavedRaceFromStorage(window.localStorage, { eventId: button.dataset.eventId || '', year: button.dataset.eventYear || '' }); initMyRacesPage(root); }));
};
