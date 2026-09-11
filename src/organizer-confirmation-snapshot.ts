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

const whitespace = (value: unknown) => value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
const date = (value: unknown) => {
  const clean = whitespace(value);
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : clean;
};
const url = (value: unknown) => {
  const clean = whitespace(value);
  return clean.replace(/^HTTPS?:\/\//, (protocol) => protocol.toLowerCase());
};
const time = (value: unknown) => {
  const clean = whitespace(value);
  const match = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return clean;
  const hours = Number(match[1]); const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : clean;
};
const yesNo = (value: unknown) => {
  const clean = whitespace(value).toLocaleUpperCase('sl-SI');
  if (clean === 'DA') return 'DA';
  if (clean === 'NE') return 'NE';
  return clean;
};

export const canonicalizeOrganizerField = (field: string, value: unknown) => {
  if (['datum', 'rok_prijave', 'rok_cenejse_prijave'].includes(field)) return date(value);
  if (field === 'cas_zacetka') return time(value);
  if (field === 'prijave_na_dan_dogodka') return yesNo(value);
  if (['povezava_razpis', 'povezava_prijava', 'trasa_url', 'organizator_url'].includes(field)) return url(value);
  return whitespace(value);
};

export const buildOrganizerSnapshotV2 = (input: OrganizerSnapshotInput) => ({
  snapshot_version: ORGANIZER_SNAPSHOT_VERSION,
  year: whitespace(input.year),
  master_row: Number(whitespace(input.master_row)),
  event_id: whitespace(input.event_id).toUpperCase(),
  ...Object.fromEntries(ORGANIZER_MASTER_FIELDS.map((key) => [key, canonicalizeOrganizerField(key, input.master[key])])),
  ...Object.fromEntries(ORGANIZER_ADDITIONAL_FIELDS.map((key) => [key, canonicalizeOrganizerField(key, input.additional?.[key])]))
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
  const strictAdditional = additionals.filter((item) => {
    const masterSheet = whitespace(item.master_sheet);
    const eventKey = whitespace(item.event_key ?? item.event_id).toUpperCase();
    const currentIdentity = masterSheet === year && eventKey === eventId;
    const legacy2026Identity = year === '2026' && !masterSheet && (!eventKey || eventKey === eventId);
    return whitespace(item.leto) === year && (currentIdentity || legacy2026Identity) &&
    whitespace(item.master_row) === row && date(item.datum) === date(master.datum) &&
    whitespace(item.naziv_prireditve) === whitespace(master.naziv_prireditve) &&
    whitespace(item.kraj) === whitespace(master.kraj) &&
    whitespace(item.zanesljivost).toLocaleLowerCase('sl-SI') === 'visoka';
  });
  if (strictAdditional.length !== 1) return null;
  return { year, master_row: row, event_id: eventId, master, additional: strictAdditional[0] };
};
