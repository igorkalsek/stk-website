import { trackStkEvent, trackStkPageLoadEventOnce } from './lib/stkAnalytics.js';
import { getSavedRaceDetailPath, resolveSavedRaces, sortResolvedSavedRaces } from './utils-my-races.js';
import { formatSeasonRegionLabel, formatSloveneCount, getNextSavedRace, getSeasonAchievements, getSeasonRegionProgress, getSeasonSummary } from './utils-my-season.js';
import { readSavedRaces } from './utils-saved-races.js';
import { buildMasterApiPath, DEFAULT_PUBLIC_YEAR, isSupportedPublicYear, type PublicYear } from './utils-public-year.js';
import { getTodayIsoInLjubljana } from './utils-date.js';
import { getStableEventId, mapPublicRaceEvent, toApiRecords } from './utils-event-detail.js';
import { SAVED_RACES_CHANGED_EVENT } from './saved-races-events.js';
import { backfillCompletedRaceSnapshots, getCompletedRaceSnapshotKey } from './utils-completed-snapshots.js';
import { attachAdditionalDataByMasterRow, fetchAdditionalEventData } from './utils-additional.js';
import { buildRegistrationDeadlineViews } from './utils-registration-deadlines.js';
import { renderActionIcon } from './utils-action-icons.js';

const API_BASE = 'https://stk-master-api.igor-kalsek.workers.dev';
const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);
const statusLabel = (status: string, language: 'sl' | 'en') => language === 'en'
  ? ({ following: 'Following', planning: 'Planning', registered: 'Registered' }[status] ?? status)
  : ({ following: 'Spremljam', planning: 'Planiram', registered: 'Prijavljen' }[status] ?? status);

type MyStkRuntime = { renderVersion: number; listening: boolean; viewed: boolean };
const runtimes = new WeakMap<HTMLElement, MyStkRuntime>();

export const attachMyStkAdditionalData = (items: ReturnType<typeof resolveSavedRaces>, rowsByYear: Map<PublicYear, Awaited<ReturnType<typeof fetchAdditionalEventData>>>, years: PublicYear[]) => {
  const enriched = years.flatMap((year) => attachAdditionalDataByMasterRow(items.filter((item) => item.event?.year === year).map((item) => item.event!), rowsByYear.get(year) ?? [], year));
  const enrichedByKey = new Map(enriched.map((event) => [`${event.year}:${getStableEventId(event)}`, event]));
  return items.map((item) => enrichedByKey.has(item.key) ? { ...item, event: enrichedByKey.get(item.key)! } : item);
};

export const enrichMyStkWhenReady = async (
  items: ReturnType<typeof resolveSavedRaces>,
  requests: Map<PublicYear, Promise<Awaited<ReturnType<typeof fetchAdditionalEventData>>>>,
  years: PublicYear[],
  isCurrent: () => boolean,
  apply: (items: ReturnType<typeof attachMyStkAdditionalData>) => void
) => {
  const rowsByYear = new Map<PublicYear, Awaited<ReturnType<typeof fetchAdditionalEventData>>>();
  await Promise.all(years.map(async (year) => rowsByYear.set(year, await requests.get(year)!)));
  if (!isCurrent()) return;
  apply(attachMyStkAdditionalData(items, rowsByYear, years));
};

export const renderMyStkNextRace = (nextRace: ReturnType<typeof getNextSavedRace>, language: 'sl' | 'en', todayIso: string, finder: string) => {
  if (!nextRace?.event) return `<p>${language === 'en' ? 'You do not have a next race yet.' : 'Nimate še naslednjega teka.'}</p><a href="${finder}">${language === 'en' ? 'Find your next race' : 'Poiščite naslednji tek'}</a>`;
  const event = nextRace.event;
  const additionalData = 'additionalData' in event ? event.additionalData as { registrationDeadline?: string; earlyRegistrationDeadline?: string } : undefined;
  const days = Math.max(0, Math.round((new Date(`${event.date}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime()) / 86400000));
  const deadline = buildRegistrationDeadlineViews({ todayIso, eventDate: event.date, registrationDeadline: additionalData?.registrationDeadline, earlyRegistrationDeadline: additionalData?.earlyRegistrationDeadline }).filter((item) => item.daysRemaining >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
  return `<div class="my-stk-next-title"><span class="action-icon">${renderActionIcon('calendar')}</span><h3><a href="${escapeHtml(getSavedRaceDetailPath(event, language))}">${escapeHtml(event.title)}</a></h3></div><p class="my-stk-next-meta">${escapeHtml(new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'sl-SI', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${event.date}T00:00:00`)))} · <span class="my-stk-status">${escapeHtml(statusLabel(nextRace.savedRace.status, language))}</span></p><strong class="my-stk-countdown">${days === 0 ? (language === 'en' ? 'Today' : 'Danes') : language === 'en' ? `${days} days to go` : `Še ${days} dni`}</strong>${deadline ? `<p class="my-stk-deadline">${language === 'en' ? 'Next registration deadline' : 'Naslednji prijavni rok'}: <time datetime="${deadline.date}">${escapeHtml(new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'sl-SI', { day: 'numeric', month: 'short' }).format(new Date(`${deadline.date}T00:00:00`)))}</time></p>` : ''}<a class="button button-small" href="${language === 'en' ? '/en/my-races/' : '/moji-teki/'}">${language === 'en' ? 'Open plan' : 'Odpri načrt'}</a>`;
};

export const initMyStk = async (root = document) => {
  const mount = root.querySelector<HTMLElement>('[data-my-stk]');
  const content = mount?.querySelector<HTMLElement>('[data-my-stk-content]');
  if (!mount || !content) return;
  const runtime = runtimes.get(mount) ?? { renderVersion: 0, listening: false, viewed: false };
  runtimes.set(mount, runtime);
  const renderVersion = ++runtime.renderVersion;
  if (!runtime.listening && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener(SAVED_RACES_CHANGED_EVENT, () => { void initMyStk(root); });
    runtime.listening = true;
  }
  const language = mount.dataset.language === 'en' ? 'en' : 'sl';
  let storage: Storage | null = null;
  try { storage = window.localStorage; } catch { /* onboarding is the graceful fallback */ }
  const saved = readSavedRaces(storage).state.races;
  if (!runtime.viewed) {
    trackStkPageLoadEventOnce(`my_stk_viewed:${language}`, { event_type: 'my_stk_viewed', language, placement: 'home_my_stk', results_count: saved.length });
    runtime.viewed = true;
  }
  const finder = language === 'en' ? '/en/find-races/' : '/iskalnik-tekov/';
  if (!saved.length) {
    content.innerHTML = `<div class="my-stk-heading"><h2 id="my-stk-title">${language === 'en' ? 'My STK' : 'Moj STK'}</h2><h3>${language === 'en' ? 'Build your running season' : 'Ustvarite svojo tekaško sezono'}</h3><p>${language === 'en' ? 'Save interesting races, follow registration deadlines and discover Slovenia through running.' : 'Shranjujte zanimive teke, spremljajte prijavne roke in skozi tek odkrivajte Slovenijo.'}</p><a class="button" href="${finder}">${language === 'en' ? 'Find your first race' : 'Poiščite prvi tek'}</a></div>`;
    return;
  }
  const years = [...new Set([DEFAULT_PUBLIC_YEAR, ...saved.map((race) => race.year).filter(isSupportedPublicYear)])] as PublicYear[];
  const payloads: Record<string, unknown> = {};
  const additionalRequests = new Map(years.map((year) => [year, fetchAdditionalEventData(year).catch(() => [])]));
  await Promise.all(years.map(async (year) => { try { const response = await fetch(`${API_BASE}${buildMasterApiPath(year)}`); if (response.ok) payloads[year] = await response.json(); } catch { /* unresolved references remain safe */ } }));
  if (runtime.renderVersion !== renderVersion) return;
  const todayIso = getTodayIsoInLjubljana();
  const resolved = sortResolvedSavedRaces(resolveSavedRaces(saved, payloads, todayIso));
  const snapshotState = backfillCompletedRaceSnapshots(storage, resolved, todayIso);
  const snapshotByKey = new Map(snapshotState.snapshots.map((item) => [getCompletedRaceSnapshotKey(item), item]));
  const items = resolved.map((item) => ({ ...item, snapshot: snapshotByKey.get(item.key) ?? null }));
  const activeEvents = toApiRecords(payloads[DEFAULT_PUBLIC_YEAR]).map((record, index) => mapPublicRaceEvent(record, DEFAULT_PUBLIC_YEAR, index)).filter(Boolean);
  const availableRegions = activeEvents.map((event) => event!.region).filter(Boolean);
  const regions = getSeasonRegionProgress(items, availableRegions, DEFAULT_PUBLIC_YEAR);
  const summary = getSeasonSummary(items, DEFAULT_PUBLIC_YEAR);
  const achievements = getSeasonAchievements(items, DEFAULT_PUBLIC_YEAR);
  const nextRace = getNextSavedRace(items);
  const nomad = achievements.find((item) => item.key === 'nomad')!;
  const totalRegions = regions.length;
  const regionalCopy = summary.regionCount === 0
    ? (language === 'en' ? 'Choose your first region to explore.' : 'Izberite prvo regijo za odkrivanje.')
    : nomad.achieved
      ? `${language === 'en' ? 'Nomad ✓' : 'Nomad ✓'}${summary.regionCount < totalRegions ? ` · ${language === 'en' ? `${totalRegions - summary.regionCount} regions to all of Slovenia.` : `Še ${formatSloveneCount(totalRegions - summary.regionCount, 'region')} do cele Slovenije.`}` : ''}`
      : language === 'en' ? `${6 - summary.regionCount} regions to the Nomad achievement.` : `Še ${formatSloveneCount(6 - summary.regionCount, 'region')} do dosežka Nomad.`;
  const completedCopy = language === 'en' ? `${summary.completedCount} completed races` : formatSloveneCount(summary.completedCount, 'completed-race');
  const distinctCopy = language === 'en' ? `${summary.distinctEventCount} different events` : formatSloveneCount(summary.distinctEventCount, 'distinct-event');
  const completedLabel = completedCopy.replace(/^\d+\s+/, '');
  const distinctLabel = distinctCopy.replace(/^\d+\s+/, '');
  const nextCard = renderMyStkNextRace(nextRace, language, todayIso, finder);
  const regionGrid = regions.map((region) => `<span class="my-stk-region${region.visited ? ' is-visited' : ''}"><span aria-hidden="true">${region.visited ? '✓' : '○'}</span>${escapeHtml(formatSeasonRegionLabel(region.label, language))}</span>`).join('');
  content.innerHTML = `<div class="my-stk-heading"><h2 id="my-stk-title">${language === 'en' ? 'My STK' : 'Moj STK'}</h2></div><div class="my-stk-dashboard"><article class="my-stk-next-card"><span class="eyebrow">${language === 'en' ? 'My next race' : 'Naslednji moj tek'}</span>${nextCard}</article><article><span class="eyebrow">${language === 'en' ? `My ${DEFAULT_PUBLIC_YEAR} season` : `Moja sezona ${DEFAULT_PUBLIC_YEAR}`}</span><div class="my-stk-season-summary"><span class="season-metric season-metric-primary"><strong>${summary.completedCount}</strong><span>${escapeHtml(completedLabel)}</span></span><span class="season-metric"><strong>${summary.regionCount} / ${totalRegions}</strong><span>${language === 'en' ? 'regions' : 'regij'}</span></span><span class="season-metric"><strong>${summary.distinctEventCount}</strong><span>${escapeHtml(distinctLabel)}</span></span></div><progress max="${Math.max(nomad.target, 1)}" value="${nomad.current}" aria-label="${language === 'en' ? 'Progress to Nomad achievement' : 'Napredek do dosežka Nomad'}"></progress><a class="button button-small button-secondary-light" href="${language === 'en' ? '/en/my-races/?view=season' : '/moji-teki/?view=season'}">${language === 'en' ? 'Open my season' : 'Odpri mojo sezono'}</a></article><article class="my-stk-discovery-card"><span class="eyebrow">${language === 'en' ? 'Exploring Slovenia' : 'Odkrivam Slovenijo'}</span><h3>${summary.regionCount} / ${totalRegions} ${language === 'en' ? 'regions' : 'regij'}</h3><div class="my-stk-region-grid" aria-label="${language === 'en' ? 'Regional progress' : 'Napredek po regijah'}">${regionGrid}</div><p>${regionalCopy}</p><a class="button button-small button-secondary-light" href="${finder}" data-region-discovery>${language === 'en' ? 'Discover a race in a new region' : 'Odkrij tek v novi regiji'}</a></article></div>`;
  content.querySelector('[data-region-discovery]')?.addEventListener('click', () => trackStkEvent({ event_type: 'region_discovery_clicked', language, placement: 'home_my_stk' }));
  await enrichMyStkWhenReady(items, additionalRequests, years, () => runtime.renderVersion === renderVersion, (enrichedItems) => {
    const enrichedNextRace = getNextSavedRace(enrichedItems);
    const nextCardMount = content.querySelector<HTMLElement>('.my-stk-next-card');
    if (nextCardMount && enrichedNextRace?.event && 'additionalData' in enrichedNextRace.event && enrichedNextRace.event.additionalData) nextCardMount.innerHTML = `<span class="eyebrow">${language === 'en' ? 'My next race' : 'Naslednji moj tek'}</span>${renderMyStkNextRace(enrichedNextRace, language, todayIso, finder)}`;
  });
};
