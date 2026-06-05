export type ApiRecord = Record<string, unknown>;

export type AdditionalEventData = {
  masterRow: string;
  masterRowNumber: number;
  reliability: string;
  date: string;
  eventTitle: string;
  registrationMinEur: string;
  registrationMaxEur: string;
  registrationDeadline: string;
  earlyRegistrationDeadline: string;
  dayOfRegistration: string;
  elevationGain: string;
  routeUrl: string;
};

export type EventWithAdditionalRow = {
  row?: string;
  id?: string;
  date?: string;
  datum?: string;
  title?: string;
  displayTitle?: string;
  naziv_prireditve?: string;
  additionalData?: AdditionalEventData | null;
};

const ADDITIONAL_API_URL = 'https://stk-master-api.igor-kalsek.workers.dev/additional';
const ARRAY_KEYS = ['data', 'events', 'items', 'rows', 'results', 'additional'];
const HIGH_RELIABILITY = 'visoka';
const TITLE_STOP_WORDS = new Set([
  'tek',
  'teki',
  'trail',
  'trails',
  'maraton',
  'polmaraton',
  'prireditev',
  'prireditve'
]);

const asRecord = (value: unknown): ApiRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as ApiRecord : null;

export const toAdditionalArray = (payload: unknown): ApiRecord[] => {
  if (Array.isArray(payload)) return payload.filter(asRecord) as ApiRecord[];

  const record = asRecord(payload);
  if (!record) return [];

  for (const key of ARRAY_KEYS) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter(asRecord) as ApiRecord[];
  }

  return [];
};

const pick = (item: ApiRecord, key: string): string => {
  const value = item[key];
  return value === undefined || value === null ? '' : String(value).trim();
};

const normalizeRow = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : Number.NaN;
};

const hasValidRowNumber = (value: number) => Number.isFinite(value);

const isDevelopment = () => import.meta.env.DEV;

const warnAdditionalDataSkipped = (reason: string, context: Record<string, unknown>) => {
  if (!isDevelopment()) return;
  console.warn(`[additional-data] Skipped additional row: ${reason}`, context);
};

const normalizeTitle = (value: string) =>
  value
    .toLocaleLowerCase('sl-SI')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const titleTokens = (value: string) =>
  normalizeTitle(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !TITLE_STOP_WORDS.has(token));

const titlesAppearUnrelated = (additionalTitle: string, eventTitle: string) => {
  const additionalTokens = titleTokens(additionalTitle);
  const eventTokens = new Set(titleTokens(eventTitle));

  if (!additionalTokens.length || !eventTokens.size) return false;
  return !additionalTokens.some((token) => eventTokens.has(token));
};

const safeUrl = (value: string) => {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};

const mapAdditionalRow = (item: ApiRecord): AdditionalEventData => {
  const masterRow = pick(item, 'master_row');

  return {
    masterRow,
    masterRowNumber: normalizeRow(masterRow),
    reliability: pick(item, 'zanesljivost'),
    date: pick(item, 'datum'),
    eventTitle: pick(item, 'naziv_prireditve'),
    registrationMinEur: pick(item, 'prijavnina_min_eur'),
    registrationMaxEur: pick(item, 'prijavnina_max_eur'),
    registrationDeadline: pick(item, 'rok_prijave'),
    earlyRegistrationDeadline: pick(item, 'rok_cenejse_prijave'),
    dayOfRegistration: pick(item, 'prijave_na_dan_dogodka'),
    elevationGain: pick(item, 'visinski_m_plus'),
    routeUrl: safeUrl(pick(item, 'trasa_url'))
  };
};

const getEventDate = (event: EventWithAdditionalRow) => event.datum ?? event.date ?? '';

const getEventRawTitle = (event: EventWithAdditionalRow) => event.naziv_prireditve ?? '';

const getEventDisplayTitle = (event: EventWithAdditionalRow) => event.displayTitle ?? event.title ?? '';

const isValidAdditionalMatch = (event: EventWithAdditionalRow, additionalRow: AdditionalEventData) => {
  const eventRow = normalizeRow(event.row ?? '');

  if (!hasValidRowNumber(eventRow)) {
    warnAdditionalDataSkipped('event.row is missing', { event });
    return false;
  }

  if (additionalRow.masterRowNumber !== eventRow) return false;

  if (additionalRow.reliability !== HIGH_RELIABILITY) return false;

  const eventDate = getEventDate(event).trim();
  if (!additionalRow.date || !eventDate || additionalRow.date !== eventDate) {
    warnAdditionalDataSkipped('date mismatch', {
      eventRow: event.row,
      additionalMasterRow: additionalRow.masterRow,
      eventDate,
      additionalDate: additionalRow.date
    });
    return false;
  }

  const rawTitle = getEventRawTitle(event).trim();
  const displayTitle = getEventDisplayTitle(event).trim();
  const relatedToRawTitle = rawTitle && !titlesAppearUnrelated(additionalRow.eventTitle, rawTitle);
  const relatedToDisplayTitle = displayTitle && !titlesAppearUnrelated(additionalRow.eventTitle, displayTitle);
  if (additionalRow.eventTitle && !relatedToRawTitle && !relatedToDisplayTitle) {
    warnAdditionalDataSkipped('title appears unrelated', {
      eventRow: event.row,
      additionalMasterRow: additionalRow.masterRow,
      rawTitle,
      displayTitle,
      additionalTitle: additionalRow.eventTitle
    });
    return false;
  }

  return true;
};

export const fetchAdditionalEventData = async () => {
  const response = await fetch(ADDITIONAL_API_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Additional API status ${response.status}`);
  return toAdditionalArray(await response.json()).map(mapAdditionalRow);
};

export const attachAdditionalDataByMasterRow = <TEvent extends EventWithAdditionalRow>(
  events: TEvent[],
  additionalRows: AdditionalEventData[]
): TEvent[] => {
  const byMasterRow = new Map<number, AdditionalEventData>();

  for (const additionalRow of additionalRows) {
    if (!hasValidRowNumber(additionalRow.masterRowNumber)) {
      warnAdditionalDataSkipped('master_row is missing', { additionalRow });
      continue;
    }

    if (additionalRow.reliability !== HIGH_RELIABILITY) continue;

    if (!byMasterRow.has(additionalRow.masterRowNumber)) {
      byMasterRow.set(additionalRow.masterRowNumber, additionalRow);
    }
  }

  return events.map((event) => {
    const eventRow = normalizeRow(event.row ?? '');

    if (!hasValidRowNumber(eventRow)) {
      warnAdditionalDataSkipped('event.row is missing', { event });
      return { ...event, additionalData: null };
    }

    const additionalData = byMasterRow.get(eventRow) ?? null;
    if (!additionalData || !isValidAdditionalMatch(event, additionalData)) {
      return { ...event, additionalData: null };
    }

    return { ...event, additionalData };
  });
};

const parseMoney = (value: string) => {
  if (!value) return null;
  const normalized = value.replace(',', '.').replace(/[^\d.-]/g, '');
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat('sl-SI', { maximumFractionDigits: 2 }).format(value);

const formatRegistrationFee = (additionalData: AdditionalEventData, label = 'Prijavnina', language: 'sl' | 'en' = 'sl') => {
  const min = parseMoney(additionalData.registrationMinEur);
  const max = parseMoney(additionalData.registrationMaxEur);

  if (min !== null && max !== null) {
    if (min === max) return `${label}: ${formatMoney(min)} €`;
    return `${label}: ${formatMoney(min)}–${formatMoney(max)} €`;
  }

  if (min !== null) return language === 'en' ? `${label}: from ${formatMoney(min)} €` : `${label}: od ${formatMoney(min)} €`;
  if (max !== null) return language === 'en' ? `${label}: up to ${formatMoney(max)} €` : `${label}: do ${formatMoney(max)} €`;
  return '';
};

const formatSlovenianIsoDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';

  const [, year, month, day] = match;
  return `${Number(day)}. ${Number(month)}. ${year}`;
};

const todayStartValue = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
};

const parseIsoDateValue = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return Number.NaN;

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
};

const isTodayOrFutureIsoDate = (value: string) => {
  const dateValue = parseIsoDateValue(value);
  return Number.isFinite(dateValue) && dateValue >= todayStartValue();
};

const normalizeDayOfRegistration = (value: string) => value.toLocaleUpperCase('sl-SI').trim();

const hasDayOfRegistration = (value: string) => normalizeDayOfRegistration(value) === 'DA';

const formatDayOfRegistration = (value: string, language: 'sl' | 'en' = 'sl') => {
  const normalized = normalizeDayOfRegistration(value);
  if (normalized === 'DA') return language === 'en' ? 'Race-day registration: yes' : 'Prijave na dan: da';
  if (normalized === 'NE') return language === 'en' ? 'Race-day registration: no' : 'Prijave na dan: ne';
  return '';
};

const formatElevationGain = (value: string, language: 'sl' | 'en' = 'sl') => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return `${language === 'en' ? 'Elevation gain' : 'Višinski metri'}: ${trimmed} m+`;
};

const ROUTE_URL_HINTS = ['trasa', 'trase', 'route', 'routes', 'gpx', 'strava', 'maps'];

const getRouteUrlLabel = (value: string) => {
  try {
    const url = new URL(value);
    const searchableUrl = decodeURIComponent(`${url.hostname} ${url.pathname} ${url.search}`)
      .toLocaleLowerCase('sl-SI')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (/\.pdf(?:$|[?#])/.test(url.pathname.toLocaleLowerCase('sl-SI'))) {
      return { label: 'Več informacij', text: 'Odprite povezavo' };
    }

    return ROUTE_URL_HINTS.some((hint) => searchableUrl.includes(hint))
      ? { label: 'Trasa', text: 'Odprite traso' }
      : { label: 'Več informacij', text: 'Odprite povezavo' };
  } catch {
    return { label: 'Več informacij', text: 'Odprite povezavo' };
  }
};

export const hasRenderableAdditionalData = (additionalData?: AdditionalEventData | null) => {
  if (!additionalData) return false;
  return Boolean(
    formatRegistrationFee(additionalData) ||
    (isTodayOrFutureIsoDate(additionalData.registrationDeadline) &&
      formatSlovenianIsoDate(additionalData.registrationDeadline)) ||
    (isTodayOrFutureIsoDate(additionalData.earlyRegistrationDeadline) &&
      formatSlovenianIsoDate(additionalData.earlyRegistrationDeadline)) ||
    formatDayOfRegistration(additionalData.dayOfRegistration) ||
    formatElevationGain(additionalData.elevationGain) ||
    additionalData.routeUrl
  );
};

type AdditionalDataRenderOptions = {
  eventDate?: string;
  registrationFeeLabel?: string;
  language?: 'sl' | 'en';
};

export const renderAdditionalDataBlock = (
  additionalData: AdditionalEventData | null | undefined,
  escapeHtml: (value: string | number) => string,
  options: string | AdditionalDataRenderOptions = ''
) => {
  if (!additionalData) return '';

  const eventDate = typeof options === 'string' ? options : options.eventDate ?? '';
  const language = typeof options === 'string' ? 'sl' : options.language ?? 'sl';
  const registrationFeeLabel = typeof options === 'string' ? 'Prijavnina' : options.registrationFeeLabel ?? (language === 'en' ? 'Entry fees' : 'Prijavnina');

  const registrationDeadline = isTodayOrFutureIsoDate(additionalData.registrationDeadline)
    ? formatSlovenianIsoDate(additionalData.registrationDeadline)
    : '';
  const earlyRegistrationDeadline = isTodayOrFutureIsoDate(additionalData.earlyRegistrationDeadline)
    ? formatSlovenianIsoDate(additionalData.earlyRegistrationDeadline)
    : '';
  const showRegistrationDeadline = Boolean(
    registrationDeadline &&
    !(additionalData.registrationDeadline === eventDate && hasDayOfRegistration(additionalData.dayOfRegistration))
  );
  const textItems = [
    formatRegistrationFee(additionalData, registrationFeeLabel, language),
    showRegistrationDeadline && `${language === 'en' ? 'Registration deadline' : 'Rok prijave'}: ${registrationDeadline}`,
    earlyRegistrationDeadline && `${language === 'en' ? 'Early registration deadline' : 'Cenejša prijava do'}: ${earlyRegistrationDeadline}`,
    formatDayOfRegistration(additionalData.dayOfRegistration, language),
    formatElevationGain(additionalData.elevationGain, language)
  ].filter(Boolean).map((item) => escapeHtml(String(item)));
  const routeLabel = additionalData.routeUrl ? getRouteUrlLabel(additionalData.routeUrl) : null;
  const routeItem = routeLabel
    ? `${language === 'en' ? 'Route' : routeLabel.label}: <a href="${escapeHtml(additionalData.routeUrl)}" target="_blank" rel="noopener noreferrer">${language === 'en' ? 'Open route' : routeLabel.text}</a>`
    : '';
  const items = [...textItems, routeItem].filter(Boolean);

  if (!items.length) return '';

  return `
    <details class="additional-data-block">
      <summary>ℹ️ ${language === 'en' ? 'Additional info' : 'Dodatni podatki'}</summary>
      <ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>
    </details>
  `;
};
