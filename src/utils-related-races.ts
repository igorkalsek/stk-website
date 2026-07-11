import { buildEnglishEventDetailPath, buildEventDetailPath, getStableEventId, normalizeSloveneText, parsePublicDateValue, type PublicRaceEvent } from './utils-event-detail.js';
import { parseRaceDistancesKm } from './utils-distance-filter.js';
import { formatDetailSurface, type DetailLanguage } from './utils-race-detail-view.js';

export type RelatedRaceLanguage = 'sl' | 'en';
export type RelatedRaceReasonKey = 'same-cup' | 'same-surface' | 'similar-distance' | 'same-region' | 'family-friendly';
export type RelatedRaceResult = { event: PublicRaceEvent; score: number; reasonKeys: RelatedRaceReasonKey[] };
export type RelatedRaceCard = {
  id: string;
  title: string;
  date: string;
  place: string;
  region: string;
  surface: string;
  distances: string;
  familyFriendly: boolean;
  detailPath: string;
  reasonLabels: string[];
};

type RelatedRaceCandidate = {
  identity: string;
  event: PublicRaceEvent;
  dateValue: number;
  normalizedSurface: string;
  surfaceCategories: string[];
  normalizedRegion: string;
  normalizedCup: string;
  comparisonDistances: number[];
  titleKey: string;
};

const MINIMUM_SCORE = 6;
const DAY_MS = 24 * 60 * 60 * 1000;
const REASON_PRIORITY: RelatedRaceReasonKey[] = ['same-cup', 'similar-distance', 'same-surface', 'same-region', 'family-friendly'];

const SURFACE_CATEGORY_ALIASES: Record<string, string> = {
  cesta: 'road', cestni: 'road', road: 'road', asphalt: 'road', asfalt: 'road',
  trail: 'trail', trejl: 'trail', brezpotje: 'trail', 'cesta trail': 'trail',
  gorski: 'mountain', gorska: 'mountain', mountain: 'mountain', hribovski: 'mountain', planinski: 'mountain',
  kros: 'cross-country', cross: 'cross-country', 'cross country': 'cross-country', 'cross-country': 'cross-country',
  atletska: 'track', stadion: 'track', track: 'track', pista: 'track',
  stopnice: 'stairs', stairs: 'stairs', stair: 'stairs',
  ovire: 'obstacle', obstacle: 'obstacle', obstacles: 'obstacle', oviratlon: 'obstacle'
};

const normalizeText = (value: string) => normalizeSloveneText(value).replace(/[()]/g, ' ').replace(/[\/,+&]+/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeCup = (value: string) => normalizeText(value);
const normalizeRegion = (value: string) => normalizeText(value);

const surfaceCategories = (value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const categories = new Set<string>();
  for (const token of tokens) if (SURFACE_CATEGORY_ALIASES[token]) categories.add(SURFACE_CATEGORY_ALIASES[token]);
  if (SURFACE_CATEGORY_ALIASES[normalized]) categories.add(SURFACE_CATEGORY_ALIASES[normalized]);
  return [...categories].sort();
};

export const getRelatedRaceIdentity = (event: Pick<PublicRaceEvent, 'id' | 'row' | 'year' | 'date' | 'title' | 'naziv_prireditve' | 'place'>) => {
  if (event.id?.trim()) return `id:${event.id.trim()}`;
  const stableId = getStableEventId(event);
  if (stableId) return `stable:${stableId}`;
  return `fallback:${normalizeText(`${event.year}|${event.date}|${event.title || event.naziv_prireditve}|${event.place}`)}`;
};

const comparisonDistances = (value: string) => {
  const distinct = [...new Set(parseRaceDistancesKm(value).filter((distance) => distance > 0))].sort((a, b) => a - b);
  const adult = distinct.filter((distance) => distance >= 3);
  return adult.length ? adult : distinct;
};

const toCandidate = (event: PublicRaceEvent): RelatedRaceCandidate | null => {
  const dateValue = parsePublicDateValue(event.date);
  if (!event.year || !event.date || Number.isNaN(dateValue)) return null;
  return {
    identity: getRelatedRaceIdentity(event),
    event,
    dateValue,
    normalizedSurface: normalizeText(event.surface),
    surfaceCategories: surfaceCategories(event.surface),
    normalizedRegion: normalizeRegion(event.region),
    normalizedCup: normalizeCup(event.cup),
    comparisonDistances: comparisonDistances(event.distances),
    titleKey: normalizeText(event.title)
  };
};

const scoreDistance = (current: number[], candidate: number[]) => {
  let best = Infinity;
  for (const a of current) for (const b of candidate) best = Math.min(best, Math.abs(a - b) / Math.max(a, b));
  if (!Number.isFinite(best)) return 0;
  if (best <= 0.1) return 5;
  if (best <= 0.25) return 4;
  if (best <= 0.5) return 2;
  return 0;
};

const scoreCandidate = (current: RelatedRaceCandidate, candidate: RelatedRaceCandidate) => {
  let score = 0;
  const reasonKeys: RelatedRaceReasonKey[] = [];
  const sameCup = Boolean(current.normalizedCup && current.normalizedCup === candidate.normalizedCup);
  if (sameCup) { score += 8; reasonKeys.push('same-cup'); }
  if (current.normalizedSurface && candidate.normalizedSurface && current.normalizedSurface === candidate.normalizedSurface) {
    score += 5; reasonKeys.push('same-surface');
  } else if (current.surfaceCategories.some((category) => candidate.surfaceCategories.includes(category))) {
    score += 3; reasonKeys.push('same-surface');
  }
  const distanceScore = scoreDistance(current.comparisonDistances, candidate.comparisonDistances);
  if (distanceScore) { score += distanceScore; reasonKeys.push('similar-distance'); }
  if (current.normalizedRegion && current.normalizedRegion === candidate.normalizedRegion) { score += 3; reasonKeys.push('same-region'); }
  if (current.event.familyFriendly && candidate.event.familyFriendly) { score += 2; reasonKeys.push('family-friendly'); }
  const dateDays = Math.abs(current.dateValue - candidate.dateValue) / DAY_MS;
  if (dateDays <= 30) score += 2;
  else if (dateDays <= 90) score += 1;
  return { score, reasonKeys, sameCup, dateDistance: Math.abs(current.dateValue - candidate.dateValue) };
};

export const buildRelatedRaces = ({ currentEvent, candidates, todayIso, limit = 3 }: { currentEvent: PublicRaceEvent; candidates: PublicRaceEvent[]; todayIso: string; limit?: number }): RelatedRaceResult[] => {
  const current = toCandidate(currentEvent);
  const todayValue = parsePublicDateValue(todayIso);
  if (!current || Number.isNaN(todayValue) || limit <= 0) return [];
  const seen = new Set<string>([current.identity]);
  return candidates
    .map(toCandidate)
    .filter((candidate): candidate is RelatedRaceCandidate => Boolean(candidate))
    .filter((candidate) => {
      if (candidate.event.year !== current.event.year || candidate.dateValue < todayValue || seen.has(candidate.identity) || !buildEventDetailPath(candidate.event)) return false;
      seen.add(candidate.identity);
      return true;
    })
    .map((candidate) => ({ candidate, scored: scoreCandidate(current, candidate) }))
    .filter(({ scored }) => scored.score >= MINIMUM_SCORE)
    .sort((a, b) => b.scored.score - a.scored.score
      || Number(b.scored.sameCup) - Number(a.scored.sameCup)
      || a.scored.dateDistance - b.scored.dateDistance
      || a.candidate.dateValue - b.candidate.dateValue
      || a.candidate.titleKey.localeCompare(b.candidate.titleKey, 'sl-SI')
      || a.candidate.identity.localeCompare(b.candidate.identity, 'sl-SI'))
    .slice(0, limit)
    .map(({ candidate, scored }) => ({ event: candidate.event, score: scored.score, reasonKeys: REASON_PRIORITY.filter((key) => scored.reasonKeys.includes(key)) }));
};

export const getTodayIsoInLjubljana = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Ljubljana', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export const getRelatedRaceReasonLabels = (reasonKeys: RelatedRaceReasonKey[], language: RelatedRaceLanguage) => {
  const labels: Record<RelatedRaceLanguage, Record<RelatedRaceReasonKey, string>> = {
    sl: { 'same-cup': 'Isti pokal ali serija', 'similar-distance': 'Podobna razdalja', 'same-surface': 'Ista podlaga', 'same-region': 'Ista regija', 'family-friendly': 'Družinam prijazno' },
    en: { 'same-cup': 'Same cup or series', 'similar-distance': 'Similar distance', 'same-surface': 'Same surface', 'same-region': 'Same region', 'family-friendly': 'Family-friendly' }
  };
  return REASON_PRIORITY.filter((key) => reasonKeys.includes(key)).slice(0, 2).map((key) => labels[language][key]);
};

export const buildRelatedRaceCards = (results: RelatedRaceResult[], language: RelatedRaceLanguage): RelatedRaceCard[] => results.map(({ event, reasonKeys }) => ({
  id: event.id || getStableEventId(event),
  title: event.title,
  date: event.date,
  place: event.place,
  region: event.region,
  surface: event.surface ? formatDetailSurface(event.surface, language as DetailLanguage) : '',
  distances: event.distances,
  familyFriendly: event.familyFriendly,
  detailPath: language === 'en' ? buildEnglishEventDetailPath(event) : buildEventDetailPath(event),
  reasonLabels: getRelatedRaceReasonLabels(reasonKeys, language)
}));
