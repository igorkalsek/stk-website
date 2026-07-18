import type { RaceActionIcon } from './utils-action-icons';
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
export type DetailHighlightIconKey = Extract<RaceActionIcon, 'ultra' | 'elevation' | 'family' | 'cup' | 'distances' | 'free' | 'race-day-registration'>;
export type DetailHighlightCard = { key: string; label: string; value: string; iconKey: DetailHighlightIconKey };

const hasText = (value: string | undefined | null) => Boolean(value?.trim());
const normalizePublicActionUrlForComparison = (value: string | undefined | null) => {
  const normalized = safeHttpUrl(value ?? '');
  if (!normalized) return '';
  const url = new URL(normalized);
  url.hash = '';
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/, '');
  const sortedParams = [...url.searchParams.entries()].sort(([aName, aValue], [bName, bValue]) =>
    aName.localeCompare(bName) || aValue.localeCompare(bValue)
  );
  url.search = '';
  sortedParams.forEach(([name, value]) => url.searchParams.append(name, value));
  return url.href;
};

export const areEquivalentPublicActionUrls = (first: string | undefined | null, second: string | undefined | null): boolean => {
  const firstComparable = normalizePublicActionUrlForComparison(first);
  const secondComparable = normalizePublicActionUrlForComparison(second);
  return Boolean(firstComparable && secondComparable && firstComparable === secondComparable);
};

const normalizeSameResourceUrlForComparison = (value: string | undefined | null) => {
  const normalized = safeHttpUrl(value ?? '');
  if (!normalized) return '';
  const url = new URL(normalized);
  url.hash = '';
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/, '');
  return url.href;
};

const areSameDetailResources = (first: string | undefined | null, second: string | undefined | null): boolean => {
  const firstComparable = normalizeSameResourceUrlForComparison(first);
  const secondComparable = normalizeSameResourceUrlForComparison(second);
  return Boolean(firstComparable && secondComparable && firstComparable === secondComparable);
};

export const normalizeDetailUrl = (value: string | undefined | null) => safeHttpUrl(value ?? '');



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
export const formatHighlightDistanceWithUnit = (value: number, language: DetailLanguage) => {
  const locale = language === 'en' ? 'en-GB' : 'sl-SI';
  if (value < 1) {
    return `${Math.round(value * 1000).toLocaleString(locale, { maximumFractionDigits: 0 })} m`;
  }
  return `${value.toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 0 })} km`;
};

const formatHighlightDistance = (value: number, language: DetailLanguage) =>
  value.toLocaleString(language === 'en' ? 'en-GB' : 'sl-SI', { maximumFractionDigits: 1, minimumFractionDigits: 0 });

export const formatFamilyPublicNote = (value: string, language: DetailLanguage = 'sl') => {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  const isRecognizedFamilyNote = /družinam prijazno|otroški teki|vsak tretji otrok iz družine/iu.test(trimmed);
  if (!isRecognizedFamilyNote) return trimmed;

  if (language === 'en') return formatEnglishPublicNotes(trimmed);

  let formatted = trimmed
    .replace(/^družinam prijazno:/iu, 'Družinam prijazno:')
    .replace(/\b(\d+(?:\.\d+)?)\s*km\b/giu, (_match, amount: string) => `${amount.replace('.', ',')} km`)
    .replace(/\s*\/\s*/g, '/')
    .replace(/otroški teki\s+((?:\d+(?:[,.]\d+)?\s*(?:m|km)\/?)+)/iu, (_match, distances: string) => {
      const parts = distances.split('/').map((part) => part.trim()).filter(Boolean);
      if (parts.length === 0) return 'otroški teki';
      if (parts.length === 1) return `otroški teki na ${parts[0]}`;
      return `otroški teki na ${parts.slice(0, -1).join(', ')} in ${parts[parts.length - 1]}`;
    })
    .replace(/vsak tretji otrok iz družine brezplačen/iu, 'vsak tretji otrok iz iste družine nastopi brezplačno');

  return formatted.replace(/\s+([.;,])/g, '$1');
};

const familyNoteSentences = (notes: string) => notes
  .split(/(?<=[.!?])\s+/)
  .map((sentence) => sentence.trim())
  .filter((sentence) => sentence && /družinam prijazno|otro(?:ški|ška|ških|kom|ci|cih|ke)|kids?|children(?:’s|'s)?/iu.test(sentence));

const extractChildrenDistancesLabel = (notes: string, language: DetailLanguage) => {
  const match = notes.match(/otroški teki\s+((?:\d+(?:[,.]\d+)?\s*(?:m|km)\/?)+)/iu);
  if (!match) return language === 'en' ? 'Listed by the organizer' : 'Navedeni pri organizatorju';
  const distances = match[1]
    .replace(/\b(\d+(?:\.\d+)?)\s*km\b/giu, (_match, amount: string) => `${amount.replace('.', language === 'sl' ? ',' : '.')} km`)
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  if (distances.length === 0) return language === 'en' ? 'Listed by the organizer' : 'Navedeni pri organizatorju';
  if (distances.length === 1) return distances[0];
  return language === 'en'
    ? `${distances.slice(0, -1).join(', ')} and ${distances[distances.length - 1]}`
    : `${distances.slice(0, -1).join(', ')} in ${distances[distances.length - 1]}`;
};

const formatDistanceRangeValue = (shortestDistance: number, longestDistance: number, language: DetailLanguage) => language === 'en'
  ? `From ${formatHighlightDistanceWithUnit(shortestDistance, language)} to ${formatHighlightDistanceWithUnit(longestDistance, language)}`
  : `Od ${formatHighlightDistanceWithUnit(shortestDistance, language)} do ${formatHighlightDistanceWithUnit(longestDistance, language)}`;


export const buildPrimaryActions = (event: Pick<DetailEvent, 'registrationUrl' | 'noticeUrl'>, language: DetailLanguage): DetailAction[] => {
  const registrationUrl = normalizeDetailUrl(event.registrationUrl);
  const noticeUrl = normalizeDetailUrl(event.noticeUrl);
  const labels = language === 'en'
    ? { registration: 'Registration', notice: 'Official info', combined: 'Official info and registration' }
    : { registration: 'Prijava', notice: 'Razpis', combined: 'Razpis in prijava' };
  if (areEquivalentPublicActionUrls(registrationUrl, noticeUrl)) return [{ kind: 'registration', label: labels.combined, url: registrationUrl, analyticsType: 'prijava' }];
  return [
    registrationUrl ? { kind: 'registration', label: labels.registration, url: registrationUrl, analyticsType: 'prijava' } : null,
    noticeUrl ? { kind: 'notice', label: labels.notice, url: noticeUrl, analyticsType: 'razpis' } : null
  ].filter((item): item is DetailAction => Boolean(item));
};

export const buildKeyFacts = (_event: DetailEvent, _language: DetailLanguage): DetailRow[] => [];


export const buildRegistrationRows = (event: DetailEvent, language: DetailLanguage, formatDate: (value: string) => string): DetailRow[] => {
  const data = event.additionalData;
  if (!data) return [];
  const labels = language === 'en'
    ? { fee: 'Entry fee', deadline: 'Registration deadline', early: 'Cheaper registration until', raceDay: 'Race-day registration' }
    : { fee: 'Startnina', deadline: 'Rok prijave', early: 'Cenejša prijava do', raceDay: 'Prijava na dan dogodka' };
  const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
  const fmtDate = (value: string) => isIsoDate(value) ? formatDate(value) : value.trim();
  const day = formatYesNo(data.dayOfRegistration, language);
  return [
    { label: labels.fee, value: formatDetailMoneyRange(data.registrationMinEur, data.registrationMaxEur, language) },
    { label: labels.deadline, value: data.registrationDeadline && !isIsoDate(data.registrationDeadline) ? fmtDate(data.registrationDeadline) : '' },
    { label: labels.early, value: data.earlyRegistrationDeadline && !isIsoDate(data.earlyRegistrationDeadline) ? fmtDate(data.earlyRegistrationDeadline) : '' },
    { label: labels.raceDay, value: day }
  ].filter((item) => hasText(item.value));
};

export const buildCourseRows = (event: DetailEvent, language: DetailLanguage): DetailRow[] => {
  const data = event.additionalData;
  if (!data) return [];
  const labels = language === 'en'
    ? { route: 'Route or map', routeIncluded: 'Course is included in the race information', routeOpen: 'Open route or map', elevation: 'Elevation gain', aria: 'Open route or map', ariaIncluded: 'Open race information with course details' }
    : { route: 'Trasa ali zemljevid', routeIncluded: 'Trasa je vključena v razpis', routeOpen: 'Odpri traso ali zemljevid', elevation: 'Višinska razlika', aria: 'Odpri traso ali zemljevid', ariaIncluded: 'Odpri razpis s podatki o trasi' };
  const routeUrl = normalizeDetailUrl(data.routeUrl);
  const routeIsNotice = areSameDetailResources(data.routeUrl, event.noticeUrl);
  const rows: Array<DetailRow | null> = [
    routeUrl ? { label: labels.route, value: routeIsNotice ? labels.routeIncluded : labels.routeOpen, url: routeUrl, analyticsType: 'trasa', ariaLabel: routeIsNotice ? labels.ariaIncluded : labels.aria } : null,
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
  if (sentences.length) return sentences.map((sentence) => formatFamilyPublicNote(sentence, language));
  if (event.familyFriendly) return [language === 'en' ? 'Family-friendly race.' : 'Družinam prijazno.'];
  if (event.kidsRaces) return [language === 'en' ? 'Children’s races are listed by the organizer.' : 'Organizator navaja otroške teke.'];
  return [];
};

export const buildRaceHighlightCards = (event: DetailEvent, language: DetailLanguage): DetailHighlightCard[] => {
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
  const labels = language === 'en'
    ? {
      ultra: 'Ultra distance', steep: 'Steep course', elevation: 'Elevation gain', children: 'Children’s races', family: 'Family-friendly', cup: 'Cup', distances: 'Distances', free: 'Free option', raceDay: 'Race-day registration', yes: 'Yes'
    }
    : {
      ultra: 'Ultra razdalja', steep: 'Strm tek', elevation: 'Višinska razlika', children: 'Otroški teki', family: 'Družinam prijazno', cup: 'Pokal', distances: 'Razdalje', free: 'Brezplačna možnost', raceDay: 'Prijava na dan', yes: 'Da'
    };
  const highlights: DetailHighlightCard[] = [];
  const add = (card: DetailHighlightCard) => {
    if (highlights.length >= 4 || highlights.some((item) => item.key === card.key)) return;
    highlights.push(card);
  };

  if (hasStrongUltra && longestDistance !== null) {
    add({ key: 'ultra', label: labels.ultra, value: `${formatHighlightDistance(longestDistance, language)} km`, iconKey: 'ultra' });
  } else if (hasUltra && longestDistance !== null) {
    add({ key: 'ultra', label: labels.ultra, value: `${formatHighlightDistance(longestDistance, language)} km`, iconKey: 'ultra' });
  }
  if (hasShortSteep) {
    add({ key: 'short-steep', label: labels.steep, value: language === 'en' ? 'Short and steep' : 'Kratko in strmo', iconKey: 'elevation' });
  }
  if (!hasShortSteep && elevation !== null && elevation >= 500) {
    add({ key: 'elevation', label: labels.elevation, value: `${elevation} m+`, iconKey: 'elevation' });
  }
  if (hasChildren) {
    add({ key: 'family', label: labels.children, value: extractChildrenDistancesLabel(event.publicNotes || '', language), iconKey: 'family' });
  } else if (hasFamily) {
    add({ key: 'family', label: labels.family, value: language === 'en' ? 'Explicitly listed' : 'Izrecno navedeno', iconKey: 'family' });
  }
  if (event.cup.trim()) {
    add({ key: 'cup', label: labels.cup, value: event.cup.trim(), iconKey: 'cup' });
  }
  if (distances.length >= 3 && shortestDistance !== null && longestDistance !== null) {
    add({ key: 'distances', label: labels.distances, value: formatDistanceRangeValue(shortestDistance, longestDistance, language), iconKey: 'distances' });
  }
  if (hasFreeFee) {
    add({ key: 'free-fee', label: labels.free, value: language === 'en' ? 'Listed for part of the programme' : 'Za del programa', iconKey: 'free' });
  }
  if (hasRaceDayRegistration) {
    add({ key: 'race-day-registration', label: labels.raceDay, value: labels.yes, iconKey: 'race-day-registration' });
  }
  return highlights.length >= 2 ? highlights : [];
};

export const buildRaceHighlights = (event: DetailEvent, language: DetailLanguage): string[] => buildRaceHighlightCards(event, language).map((highlight) => `${highlight.label}: ${highlight.value}`);


export const buildPublicNotes = (event: DetailEvent, language: DetailLanguage, familyInfo: string[]): string => {
  const notes = event.publicNotes.trim();
  if (!notes) return '';
  const formattedNotes = language === 'en' ? formatEnglishPublicNotes(notes) : notes;
  const normalizedFamily = new Set(familyInfo.map(normalizeNote));
  const remaining = formattedNotes
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !normalizedFamily.has(normalizeNote(formatFamilyPublicNote(sentence, language))))
    .join(' ')
    .trim();
  return remaining === formattedNotes && familyInfo.some((family) => normalizeNote(family) === normalizeNote(formattedNotes)) ? '' : remaining;
};
