import { trackStkPageLoadEventOnce } from './lib/stkAnalytics.js';
import { getSavedRaceDetailPath, resolveSavedRaces, sortResolvedSavedRaces } from './utils-my-races.js';
import { getNextAchievement, getSeasonAchievements, getSeasonSummary, type AchievementKey, type BasicSurface } from './utils-my-season.js';
import { readSavedRaces } from './utils-saved-races.js';
import { buildMasterApiPath } from './utils-public-year.js';
import { getTodayIsoInLjubljana } from './utils-date.js';

const API_BASE = 'https://stk-master-api.igor-kalsek.workers.dev';
const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);
const NAMES: Record<'sl' | 'en', Record<AchievementKey, string>> = {
  sl: { debut: 'Debi', five: 'Petica', ten: 'Desetka', nomad: 'Nomad', 'all-terrain': 'Terenec', veteran: 'Veteran' },
  en: { debut: 'Debut', five: 'Five', ten: 'Ten', nomad: 'Nomad', 'all-terrain': 'All-terrain', veteran: 'Veteran' }
};

export const initMyStk = async (root = document) => {
  const mount = root.querySelector<HTMLElement>('[data-my-stk]');
  if (!mount) return;
  const language = mount.dataset.language === 'en' ? 'en' : 'sl';
  let storage: Storage | null = null;
  try { storage = window.localStorage; } catch { /* onboarding is the graceful fallback */ }
  const saved = readSavedRaces(storage).state.races;
  trackStkPageLoadEventOnce(`my_stk_viewed:${language}`, { event_type: 'my_stk_viewed', language, placement: 'home_my_stk', results_count: saved.length });
  const stats = mount.querySelector<HTMLElement>('[data-my-stk-global-stats]')?.outerHTML ?? '';
  const finder = language === 'en' ? '/en/find-races/' : '/iskalnik-tekov/';
  if (!saved.length) {
    mount.innerHTML = `<div class="my-stk-heading"><h2>${language === 'en' ? 'My STK' : 'Moj STK'}</h2><h3>${language === 'en' ? 'Build your running season' : 'Ustvarite svojo tekaško sezono'}</h3><p>${language === 'en' ? 'Save interesting races, follow registration deadlines and collect completed races and achievements throughout the season.' : 'Shranjujte zanimive teke, spremljajte prijavne roke in skozi sezono zbirajte opravljene teke ter dosežke.'}</p><a class="button" href="${finder}">${language === 'en' ? 'Find your first race' : 'Poiščite prvi tek'}</a></div>${stats}`;
    return;
  }
  const years = [...new Set(saved.map((race) => race.year))];
  const payloads: Record<string, unknown> = {};
  await Promise.all(years.map(async (year) => { try { const response = await fetch(`${API_BASE}${buildMasterApiPath(year as any)}`); if (response.ok) payloads[year] = await response.json(); } catch { /* unresolved references remain safe */ } }));
  const items = sortResolvedSavedRaces(resolveSavedRaces(saved, payloads, getTodayIsoInLjubljana()));
  const summary = getSeasonSummary(items);
  const achievements = getSeasonAchievements(items);
  const next = getNextAchievement(items);
  const nextRace = items.find((item) => item.status === 'upcoming' && item.event);
  const achievedCount = achievements.filter((item) => item.achieved).length;
  const year = items.map((item) => item.event?.year || item.savedRace.year).sort().at(-1) || String(new Date().getFullYear());
  const terrain = summary.surfaces;
  const nextProgress = next?.key === 'all-terrain'
    ? (['road', 'trail', 'mountain'] as BasicSurface[]).map((surface) => `${language === 'en' ? { road: 'Road', trail: 'Trail', mountain: 'Mountain' }[surface] : { road: 'Cesta', trail: 'Trail', mountain: 'Gorski' }[surface]} ${terrain.has(surface) ? '✓' : '○'}`).join(' · ')
    : next ? `${next.current} / ${next.target}${next.key === 'nomad' ? (language === 'en' ? ' regions' : ' regij') : ''}` : '';
  mount.innerHTML = `<div class="my-stk-heading"><h2>${language === 'en' ? 'My STK' : 'Moj STK'}</h2></div><div class="my-stk-dashboard">${nextRace ? `<article><span class="eyebrow">${language === 'en' ? 'My next race' : 'Naslednji moj tek'}</span><h3><a href="${escapeHtml(getSavedRaceDetailPath(nextRace.event!, language))}">${escapeHtml(nextRace.event!.title)}</a></h3><p>${escapeHtml(new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'sl-SI', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${nextRace.event!.date}T00:00:00`)))} · ${escapeHtml(language === 'en' ? { following: 'Following', planning: 'Planning', registered: 'Registered', completed: 'Completed' }[nextRace.savedRace.status] : { following: 'Spremljam', planning: 'Planiram', registered: 'Prijavljen', completed: 'Opravljen' }[nextRace.savedRace.status])}</p></article>` : ''}<article><span class="eyebrow">${language === 'en' ? `My ${year} season` : `Moja sezona ${year}`}</span><div class="my-stk-numbers"><strong>${summary.completedCount}<span>${language === 'en' ? 'completed' : 'opravljenih'}</span></strong><strong>${summary.regionCount}<span>${language === 'en' ? 'regions' : 'regij'}</span></strong><strong>${achievedCount}<span>${language === 'en' ? 'achievements' : 'dosežkov'}</span></strong></div><a href="${language === 'en' ? '/en/my-races/' : '/moji-teki/'}">${language === 'en' ? 'Open my season' : 'Odpri mojo sezono'}</a></article><article><span class="eyebrow">${language === 'en' ? 'Next achievement' : 'Naslednji dosežek'}</span>${next ? `<h3>${NAMES[language][next.key]}</h3><p>${nextProgress}</p><progress max="${next.target}" value="${next.current}"></progress>` : `<h3>${language === 'en' ? 'All current STK achievements completed' : 'Vsi trenutni STK dosežki doseženi'}</h3><a href="${language === 'en' ? '/en/my-races/' : '/moji-teki/'}">${language === 'en' ? 'View my season' : 'Odpri mojo sezono'}</a>`}</article></div>${stats}`;
  if (next) trackStkPageLoadEventOnce(`achievement_viewed:${language}:${next.key}`, { event_type: 'achievement_viewed', language, placement: 'home_my_stk', action_type: next.key });
};
