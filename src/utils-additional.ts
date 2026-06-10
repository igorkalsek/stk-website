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

const formatMoney = (value: number, language: 'sl' | 'en' = 'sl') =>
  new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'sl-SI', { maximumFractionDigits: 2 }).format(value);

const formatEuro = (value: number, language: 'sl' | 'en' = 'sl') =>
  language === 'en' ? `€${formatMoney(value, language)}` : `${formatMoney(value, language)} €`;

const formatRegistrationFeeValue = (additionalData: AdditionalEventData, language: 'sl' | 'en' = 'sl') => {
  const min = parseMoney(additionalData.registrationMinEur);
  const max = parseMoney(additionalData.registrationMaxEur);

  if (min !== null && max !== null) {
    if (min === max) return formatEuro(min, language);
    return language === 'en'
      ? `€${formatMoney(min, language)}–${formatMoney(max, language)}`
      : `${formatMoney(min, language)}–${formatMoney(max, language)} €`;
  }

  if (min !== null) return language === 'en' ? `from ${formatEuro(min, language)}` : `od ${formatEuro(min, language)}`;
  if (max !== null) return language === 'en' ? `up to ${formatEuro(max, language)}` : `do ${formatEuro(max, language)}`;
  return '';
};

const formatRegistrationFee = (additionalData: AdditionalEventData, label = 'Prijavnina', language: 'sl' | 'en' = 'sl') => {
  const value = formatRegistrationFeeValue(additionalData, language);
  return value ? `${label}: ${value}` : '';
};

const ENGLISH_MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parseIsoDateParts = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  return { year, month: Number(month), day: Number(day) };
};

const formatSlovenianIsoDate = (value: string) => {
  const parts = parseIsoDateParts(value);
  if (!parts) return '';

  return `${parts.day}. ${parts.month}. ${parts.year}`;
};

const formatEnglishIsoDate = (value: string) => {
  const parts = parseIsoDateParts(value);
  if (!parts || parts.month < 1 || parts.month > 12) return '';

  return `${parts.day} ${ENGLISH_MONTH_ABBREVIATIONS[parts.month - 1]} ${parts.year}`;
};

const formatIsoDate = (value: string, language: 'sl' | 'en' = 'sl') =>
  language === 'en' ? formatEnglishIsoDate(value) : formatSlovenianIsoDate(value);

const formatSlovenianShortIsoDate = (value: string) => {
  const parts = parseIsoDateParts(value);
  if (!parts) return '';

  return `${parts.day}. ${parts.month}.`;
};

const formatCompactIsoDate = (value: string, language: 'sl' | 'en' = 'sl') => {
  const parts = parseIsoDateParts(value);
  if (!parts || parts.month < 1 || parts.month > 12) return '';

  return language === 'en'
    ? `${parts.day} ${ENGLISH_MONTH_ABBREVIATIONS[parts.month - 1]}`
    : formatSlovenianShortIsoDate(value);
};

const todayIsoDateInLjubljana = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Ljubljana',
    year: 'numeric'
  }).formatToParts(new Date());
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
};

const isTodayOrFutureIsoDate = (value: string) =>
  parseIsoDateParts(value) !== null && value >= todayIsoDateInLjubljana();

const normalizeDayOfRegistration = (value: string) => value.toLocaleLowerCase('sl-SI').trim();

const hasDayOfRegistration = (value: string) => ['da', 'yes', 'true'].includes(normalizeDayOfRegistration(value));

const formatDayOfRegistrationValue = (value: string, language: 'sl' | 'en' = 'sl') => {
  const normalized = normalizeDayOfRegistration(value);
  if (hasDayOfRegistration(value)) return language === 'en' ? 'yes' : 'da';
  if (['ne', 'no', 'false'].includes(normalized)) return language === 'en' ? 'no' : 'ne';
  return '';
};

const formatDayOfRegistration = (value: string, language: 'sl' | 'en' = 'sl') => {
  const displayValue = formatDayOfRegistrationValue(value, language);
  if (!displayValue) return '';
  return `${language === 'en' ? 'Race-day registration' : 'Prijave na dan'}: ${displayValue}`;
};

const formatElevationGainValue = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? `${trimmed} m+` : '';
};

const formatElevationGain = (value: string, language: 'sl' | 'en' = 'sl') => {
  const displayValue = formatElevationGainValue(value);
  if (!displayValue) return '';
  return `${language === 'en' ? 'Elevation gain' : 'Višinski metri'}: ${displayValue}`;
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
  kidsRaces?: boolean;
  eventId?: string;
  eventName?: string;
};

export const renderAdditionalDataChips = (
  additionalData: AdditionalEventData | null | undefined,
  escapeHtml: (value: string | number) => string,
  options: AdditionalDataRenderOptions = {}
) => {
  const language = options.language ?? 'sl';
  const eventDate = options.eventDate ?? '';
  const todayIsoDate = todayIsoDateInLjubljana();
  const chips: string[] = [];
  const chip = (label: string, variant: 'price' | 'route' | 'family' | 'neutral' = 'neutral') =>
    `<span class="event-chip event-chip-additional event-chip-additional-${variant}">${escapeHtml(label)}</span>`;

  const deadlineLabel = (value: string, todayLabel: string, futurePrefix: string) => {
    if (!isTodayOrFutureIsoDate(value)) return '';
    if (value === todayIsoDate) return todayLabel;

    const formattedDate = formatCompactIsoDate(value, language);
    return formattedDate ? `${futurePrefix} ${formattedDate}` : '';
  };

  if (additionalData) {
    const registrationFee = formatRegistrationFeeValue(additionalData, language);
    if (registrationFee) {
      chips.push(chip(language === 'en' ? `Entry fee ${registrationFee}` : `Startnina ${registrationFee}`, 'price'));
    }

    const registrationDeadline = deadlineLabel(
      additionalData.registrationDeadline,
      language === 'en' ? 'Deadline today' : 'Rok danes',
      language === 'en' ? 'Deadline' : 'Rok'
    );
    const showRegistrationDeadline = Boolean(
      registrationDeadline &&
      !(additionalData.registrationDeadline === eventDate && hasDayOfRegistration(additionalData.dayOfRegistration))
    );

    const earlyRegistrationDeadline = deadlineLabel(
      additionalData.earlyRegistrationDeadline,
      language === 'en' ? 'Cheaper today' : 'Ceneje danes',
      language === 'en' ? 'Cheaper' : 'Ceneje'
    );
    const hasDistinctEarlyRegistrationDeadline = Boolean(
      earlyRegistrationDeadline &&
      (
        !isTodayOrFutureIsoDate(additionalData.registrationDeadline) ||
        additionalData.earlyRegistrationDeadline < additionalData.registrationDeadline
      )
    );
    if (hasDistinctEarlyRegistrationDeadline) {
      chips.push(chip(earlyRegistrationDeadline, 'price'));
    }

    if (showRegistrationDeadline) {
      chips.push(chip(registrationDeadline, 'price'));
    }

    if (hasDayOfRegistration(additionalData.dayOfRegistration)) {
      chips.push(chip(language === 'en' ? 'On race day' : 'Na dan tekme', 'price'));
    }

    const elevationGain = additionalData.elevationGain.trim();
    if (elevationGain) {
      chips.push(chip(`+${elevationGain} m`, 'route'));
    }

    if (additionalData.routeUrl) {
      const routeTrackingAttributes = [
        'data-stk-track="external-link"',
        'data-stk-action="trasa"',
        options.eventId ? `data-stk-event-id="${escapeHtml(options.eventId)}"` : '',
        options.eventName ? `data-stk-event-name="${escapeHtml(options.eventName)}"` : '',
        eventDate ? `data-stk-event-date="${escapeHtml(eventDate)}"` : '',
        'data-analytics-link-type="trasa"'
      ].filter(Boolean).join(' ');
      chips.push(`<a class="event-chip event-chip-additional event-chip-additional-route" href="${escapeHtml(additionalData.routeUrl)}" target="_blank" rel="noopener noreferrer" ${routeTrackingAttributes}>${escapeHtml(language === 'en' ? 'Route ↗' : 'Trasa ↗')}</a>`);
    }
  }

  if (options.kidsRaces) {
    chips.push(chip(language === 'en' ? 'Kids’ races' : 'Otroški teki', 'family'));
  }

  return chips.length ? `<div class="event-additional-chips" aria-label="${escapeHtml(language === 'en' ? 'Additional race details' : 'Dodatni podatki o teku')}">${chips.join('')}</div>` : '';
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
    ? formatIsoDate(additionalData.registrationDeadline, language)
    : '';
  const earlyRegistrationDeadline = isTodayOrFutureIsoDate(additionalData.earlyRegistrationDeadline)
    ? formatIsoDate(additionalData.earlyRegistrationDeadline, language)
    : '';
  const showRegistrationDeadline = Boolean(
    registrationDeadline &&
    !(additionalData.registrationDeadline === eventDate && hasDayOfRegistration(additionalData.dayOfRegistration))
  );
  const routeLabel = additionalData.routeUrl ? getRouteUrlLabel(additionalData.routeUrl) : null;

  if (language === 'en') {
    const englishItems = [
      { label: registrationFeeLabel, value: formatRegistrationFeeValue(additionalData, language) },
      { label: 'Registration deadline', value: showRegistrationDeadline ? registrationDeadline : '' },
      { label: 'Early registration deadline', value: earlyRegistrationDeadline },
      { label: 'Race-day registration', value: formatDayOfRegistrationValue(additionalData.dayOfRegistration, language) },
      { label: 'Elevation gain', value: formatElevationGainValue(additionalData.elevationGain) },
      {
        label: 'Route',
        value: routeLabel
          ? `<a href="${escapeHtml(additionalData.routeUrl)}" target="_blank" rel="noopener noreferrer" data-analytics-link-type="trasa">Open route</a>`
          : ''
      }
    ].filter((item) => item.value);

    if (!englishItems.length) return '';

    return `
      <details class="additional-data-block">
        <summary>ℹ️ Additional info</summary>
        <ul class="additional-data-list additional-data-list-vertical">${englishItems.map((item) => `<li class="additional-data-item additional-data-item-vertical"><span class="additional-data-label">${escapeHtml(item.label)}:</span> <span class="additional-data-value">${typeof item.value === 'string' && item.value.includes('<a ') ? item.value : escapeHtml(item.value)}</span></li>`).join('')}</ul>
      </details>
    `;
  }

  const textItems = [
    formatRegistrationFee(additionalData, registrationFeeLabel, language),
    showRegistrationDeadline && `Rok prijave: ${registrationDeadline}`,
    earlyRegistrationDeadline && `Cenejša prijava do: ${earlyRegistrationDeadline}`,
    formatDayOfRegistration(additionalData.dayOfRegistration, language),
    formatElevationGain(additionalData.elevationGain, language)
  ].filter(Boolean).map((item) => escapeHtml(String(item)));
  const routeItem = routeLabel
    ? `${routeLabel.label}: <a href="${escapeHtml(additionalData.routeUrl)}" target="_blank" rel="noopener noreferrer" data-analytics-link-type="trasa">${routeLabel.text}</a>`
    : '';
  const items = [...textItems, routeItem].filter(Boolean);

  if (!items.length) return '';

  return `
    <details class="additional-data-block">
      <summary>ℹ️ Dodatni podatki</summary>
      <ul class="additional-data-list">${items.map((item) => `<li class="additional-data-item">${item}</li>`).join('')}</ul>
    </details>
  `;
};
