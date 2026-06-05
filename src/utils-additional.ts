export type ApiRecord = Record<string, unknown>;

export type AdditionalEventData = {
  masterRow: string;
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
  additionalData?: AdditionalEventData | null;
};

const ADDITIONAL_API_URL = 'https://stk-master-api.igor-kalsek.workers.dev/additional';
const ARRAY_KEYS = ['data', 'events', 'items', 'rows', 'results', 'additional'];
const HIGH_RELIABILITY = 'visoka';

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

const normalizeRow = (value: string) => value.trim();

const normalizeReliability = (value: string) =>
  value.toLocaleLowerCase('sl-SI').normalize('NFKC').trim();

const safeUrl = (value: string) => {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};

const mapAdditionalRow = (item: ApiRecord): AdditionalEventData | null => {
  if (normalizeReliability(pick(item, 'zanesljivost')) !== HIGH_RELIABILITY) return null;

  const masterRow = normalizeRow(pick(item, 'master_row'));
  if (!masterRow) return null;

  return {
    masterRow,
    registrationMinEur: pick(item, 'prijavnina_min_eur'),
    registrationMaxEur: pick(item, 'prijavnina_max_eur'),
    registrationDeadline: pick(item, 'rok_prijave'),
    earlyRegistrationDeadline: pick(item, 'rok_cenejse_prijave'),
    dayOfRegistration: pick(item, 'prijave_na_dan_dogodka'),
    elevationGain: pick(item, 'visinski_m_plus'),
    routeUrl: safeUrl(pick(item, 'trasa_url'))
  };
};

export const fetchAdditionalEventData = async () => {
  const response = await fetch(ADDITIONAL_API_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Additional API status ${response.status}`);
  return toAdditionalArray(await response.json())
    .map(mapAdditionalRow)
    .filter((item): item is AdditionalEventData => Boolean(item));
};

export const attachAdditionalDataByMasterRow = <TEvent extends EventWithAdditionalRow>(
  events: TEvent[],
  additionalRows: AdditionalEventData[]
): TEvent[] => {
  const byMasterRow = new Map<string, AdditionalEventData>();

  for (const additionalRow of additionalRows) {
    if (!byMasterRow.has(additionalRow.masterRow)) byMasterRow.set(additionalRow.masterRow, additionalRow);
  }

  return events.map((event) => {
    const row = normalizeRow(event.row ?? '');
    return row ? { ...event, additionalData: byMasterRow.get(row) ?? null } : event;
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

const formatRegistrationFee = (additionalData: AdditionalEventData) => {
  const min = parseMoney(additionalData.registrationMinEur);
  const max = parseMoney(additionalData.registrationMaxEur);

  if (min !== null && max !== null) {
    if (min === max) return `Prijavnina: ${formatMoney(min)} €`;
    return `Prijavnina: ${formatMoney(min)}–${formatMoney(max)} €`;
  }

  if (min !== null) return `Prijavnina: od ${formatMoney(min)} €`;
  if (max !== null) return `Prijavnina: do ${formatMoney(max)} €`;
  return '';
};

const formatSlovenianIsoDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';

  const [, year, month, day] = match;
  return `${Number(day)}. ${Number(month)}. ${year}`;
};

const formatDayOfRegistration = (value: string) => {
  const normalized = value.toLocaleUpperCase('sl-SI').trim();
  if (normalized === 'DA') return 'Prijave na dan: da';
  if (normalized === 'NE') return 'Prijave na dan: ne';
  return '';
};

const formatElevationGain = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return `Višinski metri: ${trimmed} m+`;
};

export const hasRenderableAdditionalData = (additionalData?: AdditionalEventData | null) => {
  if (!additionalData) return false;
  return Boolean(
    formatRegistrationFee(additionalData) ||
    formatSlovenianIsoDate(additionalData.registrationDeadline) ||
    formatSlovenianIsoDate(additionalData.earlyRegistrationDeadline) ||
    formatDayOfRegistration(additionalData.dayOfRegistration) ||
    formatElevationGain(additionalData.elevationGain) ||
    additionalData.routeUrl
  );
};

export const renderAdditionalDataBlock = (
  additionalData: AdditionalEventData | null | undefined,
  escapeHtml: (value: string | number) => string
) => {
  if (!additionalData) return '';

  const registrationDeadline = formatSlovenianIsoDate(additionalData.registrationDeadline);
  const earlyRegistrationDeadline = formatSlovenianIsoDate(additionalData.earlyRegistrationDeadline);
  const textItems = [
    formatRegistrationFee(additionalData),
    registrationDeadline && `Rok prijave: ${registrationDeadline}`,
    earlyRegistrationDeadline && `Cenejša prijava do: ${earlyRegistrationDeadline}`,
    formatDayOfRegistration(additionalData.dayOfRegistration),
    formatElevationGain(additionalData.elevationGain)
  ].filter(Boolean).map((item) => escapeHtml(String(item)));
  const routeItem = additionalData.routeUrl
    ? `Trasa: <a href="${escapeHtml(additionalData.routeUrl)}" target="_blank" rel="noopener noreferrer">Odprite traso</a>`
    : '';
  const items = [...textItems, routeItem].filter(Boolean);

  if (!items.length) return '';

  return `
    <details class="additional-data-block">
      <summary>ℹ️ Dodatni podatki</summary>
      <ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>
    </details>
  `;
};
