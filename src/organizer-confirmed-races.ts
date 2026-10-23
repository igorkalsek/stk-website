import { hasConfirmedOrganizerData } from './organizer-confirmation-status.js';
import { asRecord, mapPublicRaceEventForDetail, toApiRecords, type PublicRaceEvent } from './utils-event-detail.js';

const YEAR = '2027';
const API = 'https://stk-master-api.igor-kalsek.workers.dev';

/** The public projection checks explicit confirmation and the current snapshot upstream.
 * It deliberately exposes neither access records nor snapshot hashes to this page. */
export const selectOrganizerConfirmedRaces = (master: unknown, confirmations: unknown): PublicRaceEvent[] => {
  const source = asRecord(master);
  const projection = asRecord(confirmations);
  if (source?.ok !== true || source.sheet !== YEAR || !Array.isArray(source.data) ||
      projection?.ok !== true || projection.type !== 'organizer_confirmations' ||
      projection.year !== YEAR || !Array.isArray(projection.events)) return [];

  const counts = new Map<string, number>();
  const records = toApiRecords(source);
  const rowKey = (row: unknown) => /^\d{1,6}$/.test(String(row)) && Number(row) > 0 ? String(Number(row)) : '';
  for (const record of records) {
    const key = rowKey(record.row);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const confirmationIds = new Set<string>();
  for (const item of projection.events) {
    const record = asRecord(item);
    if (!record || typeof record.event_id !== 'string' || !/^R\d{6}$/.test(record.event_id) ||
        typeof record.data_confirmed !== 'boolean' || confirmationIds.has(record.event_id)) return [];
    confirmationIds.add(record.event_id);
  }
  return records.flatMap((record) => {
    const row = rowKey(record.row);
    if (!row || counts.get(row) !== 1) return [];
    const eventId = `R${row.padStart(6, '0')}`;
    if (!hasConfirmedOrganizerData(confirmations, YEAR, eventId)) return [];
    const event = mapPublicRaceEventForDetail(record, YEAR);
    return event && event.place ? [event] : [];
  }).sort((a, b) => a.dateValue - b.dateValue || a.title.localeCompare(b.title, 'sl-SI'));
};

export const fetchOrganizerConfirmedRaces = async (fetchImpl: typeof fetch = fetch): Promise<PublicRaceEvent[]> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const read = async (path: string) => {
      const response = await fetchImpl(`${API}${path}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error('Public organizer data unavailable');
      return response.json();
    };
    const [master, confirmations] = await Promise.all([read('/?year=2027'), read('/organizer-confirmations?year=2027')]);
    return selectOrganizerConfirmedRaces(master, confirmations);
  } catch {
    return [];
  } finally {
    controller.abort();
    clearTimeout(timeout);
  }
};
