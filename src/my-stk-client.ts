import { trackStkEvent, trackStkPageLoadEventOnce } from './lib/stkAnalytics.js';
import { getSavedRaceDetailPath, resolveSavedRaces, sortResolvedSavedRaces } from './utils-my-races.js';
import { formatSloveneCount, getNextSavedRace, getSeasonAchievements, getSeasonRegionProgress, getSeasonSummary } from './utils-my-season.js';
import { readSavedRaces } from './utils-saved-races.js';
import { buildMasterApiPath, DEFAULT_PUBLIC_YEAR, isSupportedPublicYear, type PublicYear } from './utils-public-year.js';
import { getTodayIsoInLjubljana } from './utils-date.js';
import { mapPublicRaceEvent, toApiRecords } from './utils-event-detail.js';

const API_BASE = 'https://stk-master-api.igor-kalsek.workers.dev';
const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);
const statusLabel = (status: string, language: 'sl' | 'en') => language === 'en'
  ? ({ following: 'Following', planning: 'Planning', registered: 'Registered' }[status] ?? status)
  : ({ following: 'Spremljam', planning: 'Planiram', registered: 'Prijavljen' }[status] ?? status);

export const initMyStk = async (root = document) => {
  const mount = root.querySelector<HTMLElement>('[data-my-stk]');
  const content = mount?.querySelector<HTMLElement>('[data-my-stk-content]');
  if (!mount || !content) return;
  const language = mount.dataset.language === 'en' ? 'en' : 'sl';
  let storage: Storage | null = null;
  try { storage = window.localStorage; } catch { /* onboarding is the graceful fallback */ }
  const saved = readSavedRaces(storage).state.races;
  trackStkPageLoadEventOnce(`my_stk_viewed:${language}`, { event_type: 'my_stk_viewed', language, placement: 'home_my_stk', results_count: saved.length });
  const finder = language === 'en' ? '/en/find-races/' : '/iskalnik-tekov/';
  if (!saved.length) {
    content.innerHTML = `<div class="my-stk-heading"><h2>${language === 'en' ? 'My STK' : 'Moj STK'}</h2><h3>${language === 'en' ? 'Build your running season' : 'Ustvarite svojo tekaško sezono'}</h3><p>${language === 'en' ? 'Save interesting races, follow registration deadlines and discover Slovenia through running.' : 'Shranjujte zanimive teke, spremljajte prijavne roke in skozi tek odkrivajte Slovenijo.'}</p><a class="button" href="${finder}">${language === 'en' ? 'Find your first race' : 'Poiščite prvi tek'}</a></div>`;
    return;
  }
  const years = [...new Set([DEFAULT_PUBLIC_YEAR, ...saved.map((race) => race.year).filter(isSupportedPublicYear)])] as PublicYear[];
  const payloads: Record<string, unknown> = {};
  await Promise.all(years.map(async (year) => { try { const response = await fetch(`${API_BASE}${buildMasterApiPath(year)}`); if (response.ok) payloads[year] = await response.json(); } catch { /* unresolved references remain safe */ } }));
  const items = sortResolvedSavedRaces(resolveSavedRaces(saved, payloads, getTodayIsoInLjubljana()));
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
  const nextCard = nextRace ? `<h3><a href="${escapeHtml(getSavedRaceDetailPath(nextRace.event!, language))}">${escapeHtml(nextRace.event!.title)}</a></h3><p>${escapeHtml(new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'sl-SI', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${nextRace.event!.date}T00:00:00`)))} · ${escapeHtml(statusLabel(nextRace.savedRace.status, language))}</p>` : `<p>${language === 'en' ? 'You do not have a next race yet.' : 'Nimate še naslednjega teka.'}</p><a href="${finder}">${language === 'en' ? 'Find your next race' : 'Poiščite naslednji tek'}</a>`;
  content.innerHTML = `<div class="my-stk-heading"><h2>${language === 'en' ? 'My STK' : 'Moj STK'}</h2></div><div class="my-stk-dashboard"><article><span class="eyebrow">${language === 'en' ? 'My next race' : 'Naslednji moj tek'}</span>${nextCard}</article><article><span class="eyebrow">${language === 'en' ? `My ${DEFAULT_PUBLIC_YEAR} season` : `Moja sezona ${DEFAULT_PUBLIC_YEAR}`}</span><div class="my-stk-season-summary"><strong>${escapeHtml(completedCopy)}</strong><span>${summary.regionCount} / ${totalRegions} ${language === 'en' ? 'regions' : 'regij'}</span><span>${escapeHtml(distinctCopy)}</span></div><a href="${language === 'en' ? '/en/my-races/' : '/moji-teki/'}">${language === 'en' ? 'Open my season' : 'Odpri mojo sezono'}</a></article><article><span class="eyebrow">${language === 'en' ? 'Exploring Slovenia' : 'Odkrivam Slovenijo'}</span><h3>${summary.regionCount} / ${totalRegions} ${language === 'en' ? 'regions' : 'regij'}</h3><progress max="${Math.max(totalRegions, 1)}" value="${summary.regionCount}" aria-label="${language === 'en' ? 'Regions explored' : 'Obiskane regije'}"></progress><p>${regionalCopy}</p><a href="${finder}" data-region-discovery>${language === 'en' ? 'Discover a race in a new region' : 'Odkrij tek v novi regiji'}</a></article></div>`;
  content.querySelector('[data-region-discovery]')?.addEventListener('click', () => trackStkEvent({ event_type: 'region_discovery_clicked', language, placement: 'home_my_stk' }));
};
