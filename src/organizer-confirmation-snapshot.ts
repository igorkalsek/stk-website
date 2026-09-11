export const ORGANIZER_SNAPSHOT_VERSION = 2 as const;

export const ORGANIZER_MASTER_FIELDS = [
  'datum', 'naziv_prireditve', 'kraj', 'regija', 'tip_podlage', 'razdalje_km',
  'cas_zacetka', 'povezava_razpis', 'povezava_prijava', 'pokal_serija', 'opombe_javne'
] as const;

export const ORGANIZER_ADDITIONAL_FIELDS = [
  'prijavnina_min_eur', 'prijavnina_max_eur', 'prijavnina_opis', 'rok_prijave',
  'rok_cenejse_prijave', 'prijave_na_dan_dogodka', 'visinski_m_plus', 'trasa_url',
  'organizator_naziv', 'organizator_url'
] as const;

type RecordLike = Record<string, unknown>;
export type OrganizerSnapshotInput = { year: unknown; master_row: unknown; event_id: unknown; master: RecordLike; additional?: RecordLike | null };

const whitespace = (value: unknown) => value == null ? '' : String(value).normalize('NFC').replace(/\s+/g, ' ').trim();
const date = (value: unknown) => {
  const clean = whitespace(value);
  const iso = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const sl = clean.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  return sl ? `${sl[3]}-${sl[2].padStart(2, '0')}-${sl[1].padStart(2, '0')}` : clean;
};
const number = (value: unknown) => {
  const clean = whitespace(value).replace(',', '.');
  if (!clean) return '';
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? String(parsed) : clean;
};
const url = (value: unknown) => {
  const clean = whitespace(value);
  if (!clean) return '';
  try {
    const parsed = new URL(clean);
    if (!/^https?:$/.test(parsed.protocol)) return clean;
    parsed.protocol = parsed.protocol.toLowerCase();
    return parsed.href;
  } catch { return clean; }
};
const time = (value: unknown) => {
  const clean = whitespace(value);
  const match = clean.match(/^(\d{1,2})(?:[:.]|\s*h\s*)(\d{1,2})$/i);
  if (!match) return clean;
  const hours = Number(match[1]); const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : clean;
};
const yesNo = (value: unknown) => {
  const clean = whitespace(value).toLocaleUpperCase('sl-SI');
  if (['DA', 'YES', 'TRUE', '1'].includes(clean)) return 'DA';
  if (['NE', 'NO', 'FALSE', '0'].includes(clean)) return 'NE';
  return clean;
};

export const canonicalizeOrganizerField = (field: string, value: unknown) => {
  if (['datum', 'rok_prijave', 'rok_cenejse_prijave'].includes(field)) return date(value);
  if (field === 'cas_zacetka') return time(value);
  if (field === 'prijave_na_dan_dogodka') return yesNo(value);
  if (['povezava_razpis', 'povezava_prijava', 'trasa_url', 'organizator_url'].includes(field)) return url(value);
  if (['prijavnina_min_eur', 'prijavnina_max_eur', 'visinski_m_plus'].includes(field)) return number(value);
  return whitespace(value);
};

export const buildOrganizerSnapshotV2 = (input: OrganizerSnapshotInput) => ({
  snapshot_version: ORGANIZER_SNAPSHOT_VERSION,
  year: whitespace(input.year),
  master_row: number(input.master_row),
  event_id: whitespace(input.event_id).toUpperCase(),
  master: Object.fromEntries(ORGANIZER_MASTER_FIELDS.map((key) => [key, canonicalizeOrganizerField(key, input.master[key])])),
  additional: Object.fromEntries(ORGANIZER_ADDITIONAL_FIELDS.map((key) => [key, canonicalizeOrganizerField(key, input.additional?.[key])]))
});

export const serializeOrganizerSnapshotV2 = (input: OrganizerSnapshotInput) => JSON.stringify(buildOrganizerSnapshotV2(input));

export const hashOrganizerSnapshotV2 = async (input: OrganizerSnapshotInput) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serializeOrganizerSnapshotV2(input)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const resolveOrganizerSnapshotInput = (year: string, eventId: string, masters: RecordLike[], additionals: RecordLike[]): OrganizerSnapshotInput | null => {
  if (!/^(2026|2027)$/.test(year) || !/^R\d{6}$/.test(eventId)) return null;
  const row = String(Number(eventId.slice(1)));
  const candidates = masters.filter((item) => whitespace(item.row ?? item.master_row) === row && date(item.datum).startsWith(`${year}-`));
  if (candidates.length !== 1) return null;
  const master = candidates[0];
  const strictAdditional = additionals.filter((item) =>
    whitespace(item.leto) === year && whitespace(item.master_sheet) === year &&
    whitespace(item.master_row) === row && date(item.datum) === date(master.datum) &&
    whitespace(item.naziv_prireditve) === whitespace(master.naziv_prireditve) &&
    whitespace(item.zanesljivost).toLocaleLowerCase('sl-SI') === 'visoka' &&
    (!item.event_id || whitespace(item.event_id).toUpperCase() === eventId)
  );
  if (strictAdditional.length > 1) return null;
  return { year, master_row: row, event_id: eventId, master, additional: strictAdditional[0] ?? null };
};
