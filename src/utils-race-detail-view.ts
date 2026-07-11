import type { PublicRaceEvent } from './utils-event-detail';
import { parseRaceDistancesKm } from './utils-distance-filter.js';

const safeHttpUrl = (value: string) => {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};

const formatSloveneDistancePart = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withoutKm = trimmed.replace(/\s*km\b/gi, '').trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(withoutKm)) return trimmed.replace(/\./g, ',');
  return `${withoutKm.replace('.', ',')} km`;
};

const formatSloveneDistances = (value: string) => value
  .trim()
  .split(';')
  .map(formatSloveneDistancePart)
  .filter(Boolean)
  .join(' · ');

const formatEnglishPublicNotes = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const hasFamilyFriendlyContext = /družinam prijazno|family-friendly|otroški teki|children(?:’s|'s)? races/iu.test(trimmed);
  let formatted = trimmed
    .replace(/družinam prijazno:/giu, 'Family-friendly:')
    .replace(/vsak tretji otrok iz družine brezplačen/giu, 'every third child from the same family participates free of charge')
    .replace(/otroški teki brezplačni/giu, 'children’s races are free')
    .replace(/otroški teki/giu, 'children’s races');
  if (hasFamilyFriendlyContext) {
    formatted = formatted
      .replace(/\botroci\b/giu, 'children')
      .replace(/\bbrezplačno\b/giu, 'free of charge');
  }
  return formatted;
};

const formatEnglishSurface = (value: string) => {
  const normalized = value.trim().toLocaleLowerCase('sl-SI');
  const labels: Record<string, string> = { cesta: 'Road', trail: 'Trail', gorski: 'Mountain', kros: 'Cross-country', atletska: 'Track' };
  return labels[normalized] ?? value.trim().replace(/^./, (letter) => letter.toLocaleUpperCase('en-GB'));
};

export type DetailLanguage = 'sl' | 'en';

export type DetailAdditionalData = {
  registrationMinEur: string;
  registrationMaxEur: string;
  registrationDeadline: string;
  earlyRegistrationDeadline: string;
  dayOfRegistration: string;
  elevationGain: string;
  routeUrl: string;
};
export type DetailEvent = PublicRaceEvent & { additionalData?: DetailAdditionalData | null };

export type DetailAction = { kind: 'registration' | 'notice'; label: string; url: string; analyticsType: 'prijava' | 'razpis' };
export type DetailRow = { label: string; value: string; url?: string; analyticsType?: string; ariaLabel?: string };

const hasText = (value: string | undefined | null) => Boolean(value?.trim());
const sameUrl = (a: string, b: string) => a && b && a === b;

export const normalizeDetailUrl = (value: string | undefined | null) => safeHttpUrl(value ?? '');

const formatStartTime = (value: string) => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(.*)$/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}${match[3] ?? ''}` : value.trim();
};

export const formatDetailSurface = (value: string, language: DetailLanguage) =>
  language === 'en' ? formatEnglishSurface(value) : value.trim().toLocaleLowerCase('sl-SI').replace(/^./, (letter) => letter.toLocaleUpperCase('sl-SI'));

export const formatDetailMoneyRange = (minValue = '', maxValue = '', language: DetailLanguage = 'sl') => {
  const normalizeAmount = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(',', '.').replace(/\s*(€|eur)\s*$/iu, '').trim();
    if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : null;
  };
  const formatAmount = (amount: number) => amount.toLocaleString(language === 'en' ? 'en-GB' : 'sl-SI', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2 });
  const min = normalizeAmount(minValue);
  const max = normalizeAmount(maxValue);
  if (min === null && max === null) return '';
  if (min !== null && max !== null && min !== max) return `${formatAmount(min)}–${formatAmount(max)} €`;
  return `${formatAmount(min ?? max ?? 0)} €`;
};

const formatYesNo = (value: string, language: DetailLanguage) => {
  const normalized = value.trim().toLocaleLowerCase('sl-SI');
  if (['da', 'yes', 'true'].includes(normalized)) return language === 'en' ? 'Yes' : 'Da';
  if (['ne', 'no', 'false'].includes(normalized)) return language === 'en' ? 'No' : 'Ne';
  return value.trim();
};

const normalizeNote = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('sl-SI');
const uniqueDistances = (value: string) => [...new Set(parseRaceDistancesKm(value))].sort((a, b) => a - b);
const parseElevationGain = (value: string | undefined | null) => {
  const trimmed = value?.trim() ?? '';
  if (!/^\d+$/.test(trimmed)) return null;
  const elevation = Number(trimmed);
  return Number.isFinite(elevation) && elevation > 0 ? elevation : null;
};
const parseRegistrationFeeAmount = (value: string | undefined | null) => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  const normalized = trimmed.replace(',', '.').replace(/\s*(€|eur)\s*$/iu, '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
};
const isExplicitYes = (value: string | undefined | null) => ['da', 'yes', 'true'].includes((value ?? '').trim().toLocaleLowerCase('sl-SI'));
const hasTrailOrMountainSurface = (value: string) => /trail|gorsk|hrib|planin|mountain/iu.test(value.trim());
const formatHighlightDistance = (value: number, language: DetailLanguage) =>
  value.toLocaleString(language === 'en' ? 'en-GB' : 'sl-SI', { maximumFractionDigits: 1, minimumFractionDigits: 0 });

const familyNoteSentences = (notes: string) => notes
  .split(/(?<=[.!?])\s+/)
  .map((sentence) => sentence.trim())
  .filter((sentence) => sentence && /družinam prijazno|otro(?:ški|ška|ških|kom|ci|cih|ke)|kids?|children(?:’s|'s)?/iu.test(sentence));

export const buildPrimaryActions = (event: Pick<DetailEvent, 'registrationUrl' | 'noticeUrl'>, language: DetailLanguage): DetailAction[] => {
  const registrationUrl = normalizeDetailUrl(event.registrationUrl);
  const noticeUrl = normalizeDetailUrl(event.noticeUrl);
  const labels = language === 'en'
    ? { registration: 'Registration', notice: 'Official info' }
    : { registration: 'Prijava', notice: 'Razpis' };
  if (registrationUrl && sameUrl(registrationUrl, noticeUrl)) return [{ kind: 'registration', label: labels.registration, url: registrationUrl, analyticsType: 'prijava' }];
  return [
    registrationUrl ? { kind: 'registration', label: labels.registration, url: registrationUrl, analyticsType: 'prijava' } : null,
    noticeUrl ? { kind: 'notice', label: labels.notice, url: noticeUrl, analyticsType: 'razpis' } : null
  ].filter((item): item is DetailAction => Boolean(item));
};

export const buildKeyFacts = (event: DetailEvent, language: DetailLanguage): DetailRow[] => {
  const labels = language === 'en'
    ? { distances: 'Distances', start: 'Start time', surface: 'Surface', location: 'Location', region: 'Region', cup: 'Cup or series' }
    : { distances: 'Razdalje', start: 'Čas začetka', surface: 'Podlaga', location: 'Kraj', region: 'Regija', cup: 'Pokal ali serija' };
  return [
    event.distances ? { label: labels.distances, value: formatSloveneDistances(event.distances) } : null,
    event.startTime ? { label: labels.start, value: formatStartTime(event.startTime) } : null,
    event.surface ? { label: labels.surface, value: formatDetailSurface(event.surface, language) } : null,
    event.place ? { label: labels.location, value: event.place } : null,
    event.region ? { label: labels.region, value: event.region } : null,
    event.cup ? { label: labels.cup, value: event.cup } : null
  ].filter((item): item is DetailRow => Boolean(item && hasText(item.value)));
};

export const buildRegistrationRows = (event: DetailEvent, language: DetailLanguage, formatDate: (value: string) => string): DetailRow[] => {
  const data = event.additionalData;
  if (!data) return [];
  const labels = language === 'en'
    ? { fee: 'Entry fee', deadline: 'Registration deadline', early: 'Cheaper registration until', raceDay: 'Race-day registration' }
    : { fee: 'Startnina', deadline: 'Rok prijave', early: 'Cenejša prijava do', raceDay: 'Prijava na dan dogodka' };
  const fmtDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : value.trim();
  const day = formatYesNo(data.dayOfRegistration, language);
  return [
    { label: labels.fee, value: formatDetailMoneyRange(data.registrationMinEur, data.registrationMaxEur, language) },
    { label: labels.deadline, value: data.registrationDeadline ? fmtDate(data.registrationDeadline) : '' },
    { label: labels.early, value: data.earlyRegistrationDeadline ? fmtDate(data.earlyRegistrationDeadline) : '' },
    { label: labels.raceDay, value: day }
  ].filter((item) => hasText(item.value));
};

export const buildCourseRows = (event: DetailEvent, language: DetailLanguage): DetailRow[] => {
  const data = event.additionalData;
  if (!data) return [];
  const labels = language === 'en'
    ? { route: 'Route or map', elevation: 'Elevation gain', aria: 'Open route or map' }
    : { route: 'Trasa ali zemljevid', elevation: 'Višinska razlika', aria: 'Odpri traso ali zemljevid' };
  const routeUrl = normalizeDetailUrl(data.routeUrl);
  const rows: Array<DetailRow | null> = [
    routeUrl ? { label: labels.route, value: labels.route, url: routeUrl, analyticsType: 'trasa', ariaLabel: labels.aria } : null,
    data.elevationGain ? { label: labels.elevation, value: `${data.elevationGain.trim()} m+` } : null
  ];
  return rows.filter((item): item is DetailRow => Boolean(item && hasText(item.value)));
};


export const buildCourseHeading = (event: DetailEvent, language: DetailLanguage): string => {
  const data = event.additionalData;
  if (!data) return '';
  const hasRoute = Boolean(normalizeDetailUrl(data.routeUrl));
  const hasElevation = hasText(data.elevationGain);
  if (language === 'en') {
    if (hasRoute && hasElevation) return 'Course and elevation';
    if (hasRoute) return 'Course';
    if (hasElevation) return 'Elevation';
    return '';
  }
  if (hasRoute && hasElevation) return 'Trasa in višinski podatki';
  if (hasRoute) return 'Trasa';
  if (hasElevation) return 'Višinski podatki';
  return '';
};

export const buildFamilyInfo = (event: DetailEvent, language: DetailLanguage): string[] => {
  const notes = event.publicNotes || '';
  if (!event.familyFriendly && !event.kidsRaces) return [];
  const sentences = familyNoteSentences(notes);
  if (sentences.length) return sentences.map((sentence) => language === 'en' ? formatEnglishPublicNotes(sentence) : sentence);
  if (event.familyFriendly) return [language === 'en' ? 'Family-friendly race.' : 'Družinam prijazno.'];
  if (event.kidsRaces) return [language === 'en' ? 'Children’s races are listed by the organizer.' : 'Organizator navaja otroške teke.'];
  return [];
};

export const buildRaceHighlights = (event: DetailEvent, language: DetailLanguage): string[] => {
  const distances = uniqueDistances(event.distances);
  const longestDistance = distances.length ? distances[distances.length - 1] : null;
  const shortestDistance = distances.length ? distances[0] : null;
  const elevation = parseElevationGain(event.additionalData?.elevationGain);
  const hasStrongUltra = longestDistance !== null && longestDistance >= 80;
  const hasUltra = longestDistance !== null && longestDistance > 42.2;
  const hasShortSteep = longestDistance !== null && longestDistance <= 12 && elevation !== null && elevation >= 800 && hasTrailOrMountainSurface(event.surface);
  const hasChildren = event.kidsRaces;
  const hasFamily = event.familyFriendly;
  const hasFreeFee = [event.additionalData?.registrationMinEur, event.additionalData?.registrationMaxEur].some((value) => parseRegistrationFeeAmount(value) === 0);
  const hasRaceDayRegistration = isExplicitYes(event.additionalData?.dayOfRegistration);
  const hasRoute = Boolean(normalizeDetailUrl(event.additionalData?.routeUrl));
  const highlights: Array<{ key: string; text: string }> = [];
  const add = (key: string, text: string) => {
    if (highlights.length >= 3 || highlights.some((item) => item.key === key)) return;
    highlights.push({ key, text });
  };

  if (hasStrongUltra && longestDistance !== null) {
    add('ultra', language === 'en'
      ? `The longest course is ${formatHighlightDistance(longestDistance, language)} km, offering a substantial ultra challenge.`
      : `Najdaljša trasa meri ${formatHighlightDistance(longestDistance, language)} km in predstavlja izrazit ultra izziv.`);
  } else if (hasUltra) {
    add('ultra', language === 'en' ? 'The event also includes an ultra-distance race.' : 'Dogodek vključuje tudi ultra razdaljo.');
  }
  if (hasShortSteep) {
    add('short-steep', language === 'en' ? 'A short distance is combined with substantial climbing.' : 'Kratka razdalja je združena z izrazitim vzponom.');
  }
  if (!hasShortSteep && elevation !== null && elevation >= 500) {
    if (elevation >= 1000) {
      add('elevation', language === 'en' ? `${elevation} m of elevation gain is listed for the event.` : `Za dogodek je navedenih ${elevation} m+ vzpona.`);
    } else {
      add('elevation', language === 'en' ? `Around ${elevation} m of elevation gain is listed for the event.` : `Za dogodek je navedenih približno ${elevation} m+ vzpona.`);
    }
  }
  if (distances.length >= 3 && shortestDistance !== null && longestDistance !== null) {
    add('distances', language === 'en'
      ? `Several distances are available, from ${formatHighlightDistance(shortestDistance, language)} to ${formatHighlightDistance(longestDistance, language)} km.`
      : `Na voljo je več razdalj: od ${formatHighlightDistance(shortestDistance, language)} do ${formatHighlightDistance(longestDistance, language)} km.`);
  }
  if (hasChildren) {
    add('family', language === 'en' ? 'The organizer lists children’s races or categories.' : 'Organizator navaja otroške teke ali kategorije.');
  } else if (hasFamily) {
    add('family', language === 'en' ? 'The event is explicitly marked as family-friendly.' : 'Dogodek je izrecno označen kot družinam prijazen.');
  }
  if (event.cup.trim()) {
    add('cup', language === 'en' ? `The race is part of the ${event.cup.trim()} series or cup.` : `Tek je del serije oziroma pokala ${event.cup.trim()}.`);
  }
  if (hasFreeFee) {
    add('free-fee', language === 'en' ? 'A free participation option is listed for part of the programme.' : 'Za del programa je navedena brezplačna udeležba.');
  }
  if (hasRaceDayRegistration) {
    add('race-day-registration', language === 'en' ? 'Race-day registration is listed as available.' : 'Prijava je predvidena tudi na dan dogodka.');
  }
  if (hasRoute) {
    add('route', language === 'en' ? 'A route or map link is available.' : 'Na voljo je povezava do trase ali zemljevida.');
  }
  return highlights.map((item) => item.text);
};

export const buildPublicNotes = (event: DetailEvent, language: DetailLanguage, familyInfo: string[]): string => {
  const notes = event.publicNotes.trim();
  if (!notes) return '';
  const formattedNotes = language === 'en' ? formatEnglishPublicNotes(notes) : notes;
  const normalizedFamily = new Set(familyInfo.map(normalizeNote));
  const remaining = formattedNotes.split(/(?<=[.!?])\s+/).filter((sentence) => !normalizedFamily.has(normalizeNote(sentence))).join(' ').trim();
  return remaining === formattedNotes && familyInfo.some((family) => normalizeNote(family) === normalizeNote(formattedNotes)) ? '' : remaining;
};
