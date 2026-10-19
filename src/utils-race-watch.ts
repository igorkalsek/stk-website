import { asRecord, getStableEventId, mapPublicRaceEvent, toApiRecords, type PublicRaceEvent } from './utils-event-detail.js';
import { getProfileDeadlineEdition, getVerifiedProfileDeadline } from './profile-deadline-v2.js';
import { buildRegistrationDeadlineViews, getDaysBetweenIsoDates, parseRegistrationDeadlineDate, type RegistrationDeadlineView } from './utils-registration-deadlines.js';
import { getSavedRaceKey, type SavedRace } from './utils-saved-races.js';

// Reviewed DEV-031 anchors, not an identity registry. No inference from rNNNNNN to RNNNNNN.
const reviewedAnchors: Record<string, string> = {
  '2026:254': 'R000217|2026-11-07',
  '2026:256': 'R000211|2026-11-07',
  '2026:265': 'R000218|2026-12-05'
};
const rowNumber = (value: unknown): string | null => {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) return null;
  return String(value);
};
const has = (record: Record<string, unknown>, key: string) => record[key] !== undefined;
const consistentLocator = (record: Record<string, unknown>, year: string, row: string, eventId: string) =>
  ['year', 'leto', 'master_sheet'].every(key => !has(record, key) || record[key] === year) &&
  ['row', 'master_row'].every(key => !has(record, key) || rowNumber(record[key]) === row) &&
  ['eventId', 'event_id'].every(key => !has(record, key) || record[key] === eventId);
const validFamily = (value: unknown) => typeof value === 'string' && /^R\d{6}$/.test(value);

export type WatchIdentity = { key: string; year: string; row: string; event: PublicRaceEvent; raceId?: string; deadlineEdition?: string };

/** A bounded locator for this visit. It cannot follow a moved/reused Master row. */
export const resolveRaceWatchIdentity = (saved: SavedRace, payload: unknown): WatchIdentity | null => {
  if (!['2026', '2027'].includes(saved.year) || !/^r\d{6,}$/.test(saved.eventId)) return null;
  const envelope = asRecord(payload);
  if (envelope?.ok !== true || envelope.sheet !== saved.year || !Array.isArray(envelope.data) ||
    !envelope.data.every(asRecord) || envelope.row_count !== envelope.data.length) return null;
  const rows = toApiRecords(payload).filter(record => `r${String(record.row).padStart(6, '0')}` === saved.eventId);
  if (rows.length !== 1) return null;
  const record = rows[0];
  const row = rowNumber(record.row);
  const event = mapPublicRaceEvent(record, saved.year);
  if (!row || !event || getStableEventId(event) !== saved.eventId || saved.date !== event.date ||
    !consistentLocator(record, saved.year, row, saved.eventId)) return null;
  const anchor = reviewedAnchors[`${saved.year}:${row}`];
  // The reviewed exact profile is an additional guard, never fuzzy matching.
  const deadlineEdition = anchor && getProfileDeadlineEdition(event) === anchor ? anchor : undefined;
  const expectedFamily = deadlineEdition?.split('|')[0];
  if (has(record, 'race_id') && (!validFamily(record.race_id) || (expectedFamily && record.race_id !== expectedFamily))) return null;
  return { key: getSavedRaceKey(saved), year: saved.year, row, event, raceId: record.race_id as string | undefined, deadlineEdition };
};

export type RaceWatchUpdate = { key: string; signalId: string; event: PublicRaceEvent; type: 'NEW' | 'CONFIRMED' | 'UPDATED'; date: string };
export type VerifiedWatchDeadline = { key: string; event: PublicRaceEvent; deadline: RegistrationDeadlineView; label: string; relative: string; source: string; deadlineId: string };
export type RaceWatchResult = { updates: RaceWatchUpdate[]; deadlines: VerifiedWatchDeadline[]; recentAvailable: boolean; recentComplete: boolean; period: { from: string; to: string } | null; unresolved: boolean; deadlinesAvailable: boolean };

export const buildRaceWatch = ({ saved, masters, recent, deadlines, todayIso, language }: {
  saved: SavedRace[]; masters: Record<string, unknown>; recent: unknown; deadlines: unknown; todayIso: string; language: 'sl' | 'en';
}): RaceWatchResult => {
  const identities = saved.map(race => resolveRaceWatchIdentity(race, masters[race.year]));
  const result: RaceWatchResult = { updates: [], deadlines: [], recentAvailable: false, recentComplete: false, period: null, unresolved: identities.some(identity => !identity), deadlinesAvailable: false };
  if (!parseRegistrationDeadlineDate(todayIso)) return result;
  const root = asRecord(recent);
  const block = asRecord(root?.recent_updates_last_days);
  const period = asRecord(block?.period);
  const from = parseRegistrationDeadlineDate(period?.from);
  const to = parseRegistrationDeadlineDate(period?.to);
  const years = block?.years;
  if (root?.ok === true && root.type === 'recent_updates' && Array.isArray(years) && years.length === 2 && years[0] === '2026' && years[1] === '2027' &&
    from && to === todayIso && from <= to && getDaysBetweenIsoDates(from, to) < 60 && Array.isArray(block?.events)) {
    result.recentAvailable = true;
    result.period = { from, to };
    const stats = asRecord(block.stats);
    const counts = ['updated_events_total', 'new_events_total', 'confirmed_events_total'].map(key => stats?.[key]);
    result.recentComplete = counts.every(value => Number.isInteger(value) && Number(value) >= 0) && counts.reduce<number>((sum, value) => sum + Number(value), 0) === block.events.length && block.events.length < 100;
    const byLocator = new Map<string, Array<Record<string, unknown>>>();
    for (const raw of block.events) {
      const update = asRecord(raw);
      if (!update || !rowNumber(update.master_row) || !['2026', '2027'].includes(String(update.year))) { result.recentComplete = false; continue; }
      const key = `${update.year}:${update.master_row}`;
      byLocator.set(key, [...(byLocator.get(key) ?? []), update]);
    }
    for (const identity of identities) {
      if (!identity) continue;
      const candidates = byLocator.get(`${identity.year}:${identity.row}`) ?? [];
      const accepted: RaceWatchUpdate[] = [];
      for (const update of candidates) {
        const type = typeof update.update_type === 'string' ? update.update_type.toUpperCase() : '';
        const date = parseRegistrationDeadlineDate(update.recent_update_date);
        const expectedFamily = identity.raceId ?? identity.deadlineEdition?.split('|')[0];
        if (!consistentLocator(update, identity.year, identity.row, getStableEventId(identity.event)) || update.datum !== identity.event.date ||
          !date || date < from || date > to || !['NEW', 'CONFIRMED', 'UPDATED'].includes(type) ||
          (has(update, 'race_id') && (!validFamily(update.race_id) || !expectedFamily || update.race_id !== expectedFamily))) break;
        accepted.push({ key: identity.key, event: identity.event, signalId: `${identity.year}:${identity.row}|${date}|${type}`, type: type as RaceWatchUpdate['type'], date });
      }
      const unique = new Map(accepted.map(item => [item.signalId, item]));
      // Exact repeats collapse; conflicting signals for an edition are suppressed.
      if (accepted.length === candidates.length && unique.size === 1) result.updates.push([...unique.values()][0]);
      else if (candidates.length) result.unresolved = true;
    }
  }
  const deadlineRoot = asRecord(deadlines);
  if (deadlineRoot?.ok === true && deadlineRoot.type === 'deadlines' && deadlineRoot.contract_version === 2 && Array.isArray(deadlineRoot.items) && deadlineRoot.items.every(asRecord)) {
    const deadlinePeriod = asRecord(deadlineRoot.period);
    const deadlineStats = asRecord(deadlineRoot.stats);
    result.deadlinesAvailable = deadlinePeriod?.from === todayIso && Boolean(parseRegistrationDeadlineDate(deadlinePeriod?.to)) && String(deadlinePeriod?.to) >= todayIso &&
      deadlineStats?.returned_total === deadlineRoot.items.length && deadlineStats?.eligible_total === deadlineRoot.items.length;
    for (const [index, identity] of identities.entries()) {
      if (!identity?.deadlineEdition || saved[index].status === 'completed') continue;
      const items = deadlineRoot.items.map(asRecord).filter(item => item?.edition_id === identity.deadlineEdition || (item?.master_sheet === identity.year && rowNumber(item?.master_row) === identity.row));
      // Validate optional locators as a group; never overlook a conflicting duplicate.
      if (items.some(item => item!.edition_id !== identity.deadlineEdition || item!.race_id !== identity.deadlineEdition!.split('|')[0] || item!.datum !== identity.event.date || item!.master_sheet !== identity.year || rowNumber(item!.master_row) !== identity.row || !consistentLocator(item!, identity.year, identity.row, getStableEventId(identity.event)))) continue;
      for (const item of items) {
        const date = parseRegistrationDeadlineDate(item?.deadline_date);
        if (!date || getDaysBetweenIsoDates(todayIso, date) > 30) continue;
        const verified = getVerifiedProfileDeadline(deadlines, identity.deadlineEdition, date, todayIso, language);
        if (!verified) continue;
        const deadline = buildRegistrationDeadlineViews({ todayIso, eventDate: identity.event.date, ...(item?.deadline_type === 'cheaper' ? { earlyRegistrationDeadline: date } : { registrationDeadline: date }) })[0];
        if (deadline) result.deadlines.push({ ...verified, key: identity.key, event: identity.event, deadline });
      }
    }
  }
  result.updates.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
  result.deadlines.sort((a, b) => a.deadline.date.localeCompare(b.deadline.date) || a.key.localeCompare(b.key));
  return result;
};

/** Replace the same legacy date once; keep existing neutral calendar exports. */
export const mergeMyRaceDeadlines = (event: { date: string; additionalData?: { registrationDeadline?: string; earlyRegistrationDeadline?: string } | null; verifiedDeadlines?: VerifiedWatchDeadline[] }, todayIso: string) => {
  const legacy = buildRegistrationDeadlineViews({ todayIso, eventDate: event.date, registrationDeadline: event.additionalData?.registrationDeadline, earlyRegistrationDeadline: event.additionalData?.earlyRegistrationDeadline });
  const verified = event.verifiedDeadlines ?? [];
  return [...legacy.filter(deadline => !verified.some(item => item.deadline.date === deadline.date)), ...verified.map(item => item.deadline)]
    .sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
};
