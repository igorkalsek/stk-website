import { getStableEventId, type PublicRaceEvent } from './utils-event-detail.js';
import type { MinimalStorage } from './utils-saved-races.js';
import type { SavedRaceResolution } from './utils-my-races.js';
import { isCompletionAllowed } from './utils-date.js';
export const COMPLETED_RACE_SNAPSHOTS_STORAGE_KEY = 'stkCompletedRaceSnapshotsV1';
export type CompletedRaceSnapshot = { version: 1; eventId: string; year: string; date: string; title: string; place: string; region: string; surface: string };
export type CompletedRaceSnapshotsState = { version: 1; snapshots: CompletedRaceSnapshot[] };
const clean = (value: unknown, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export const getCompletedRaceSnapshotKey = (item: Pick<CompletedRaceSnapshot, 'year' | 'eventId'>) => `${item.year}:${item.eventId}`;
export const validateCompletedRaceSnapshot = (value: unknown): CompletedRaceSnapshot | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null; const item = value as Record<string, unknown>;
  const eventId = clean(item.eventId, 80), year = clean(item.year, 4), date = clean(item.date, 10), title = clean(item.title);
  if (item.version !== 1 || !eventId || !/^\d{4}$/.test(year) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) return null;
  return { version: 1, eventId, year, date, title, place: clean(item.place), region: clean(item.region), surface: clean(item.surface) };
};
export const validateCompletedRaceSnapshotsState = (value: unknown): CompletedRaceSnapshotsState | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || (value as Record<string, unknown>).version !== 1) return null;
  const snapshots: CompletedRaceSnapshot[] = [], seen = new Set<string>();
  for (const raw of Array.isArray((value as any).snapshots) ? (value as any).snapshots : []) { const item = validateCompletedRaceSnapshot(raw); if (!item) continue; const key = getCompletedRaceSnapshotKey(item); if (!seen.has(key)) { seen.add(key); snapshots.push(item); } }
  return { version: 1, snapshots };
};
export const readCompletedRaceSnapshots = (storage?: MinimalStorage | null): CompletedRaceSnapshotsState => { try { return validateCompletedRaceSnapshotsState(JSON.parse(storage?.getItem(COMPLETED_RACE_SNAPSHOTS_STORAGE_KEY) || 'null')) ?? { version: 1, snapshots: [] }; } catch { return { version: 1, snapshots: [] }; } };
export const upsertCompletedRaceSnapshot = (storage: MinimalStorage | null | undefined, event: Pick<PublicRaceEvent, 'row' | 'id' | 'date' | 'title' | 'year' | 'place' | 'region' | 'surface' | 'naziv_prireditve'>) => {
  const state = readCompletedRaceSnapshots(storage); const snapshot: CompletedRaceSnapshot = { version: 1, eventId: getStableEventId(event), year: event.year, date: event.date, title: event.title, place: event.place, region: event.region, surface: event.surface };
  const snapshots = [snapshot, ...state.snapshots.filter((item) => getCompletedRaceSnapshotKey(item) !== getCompletedRaceSnapshotKey(snapshot))];
  try { storage?.setItem(COMPLETED_RACE_SNAPSHOTS_STORAGE_KEY, JSON.stringify({ version: 1, snapshots })); return Boolean(storage); } catch { return false; }
};

/** Backfills only missing snapshots for valid, resolved historical completions. Never dispatches or overwrites. */
export const backfillCompletedRaceSnapshots = (storage: MinimalStorage | null | undefined, items: SavedRaceResolution[], todayIso: string) => {
  const state = readCompletedRaceSnapshots(storage);
  const existing = new Set(state.snapshots.map(getCompletedRaceSnapshotKey));
  const additions: CompletedRaceSnapshot[] = [];
  for (const item of items) {
    if (item.savedRace.status !== 'completed' || !item.event || !isCompletionAllowed(item.event.date, todayIso) || existing.has(item.key)) continue;
    const snapshot: CompletedRaceSnapshot = { version: 1, eventId: item.savedRace.eventId, year: item.event.year, date: item.event.date, title: item.event.title, place: item.event.place, region: item.event.region, surface: item.event.surface };
    existing.add(item.key);
    additions.push(snapshot);
  }
  if (!additions.length) return state;
  const next = { version: 1 as const, snapshots: [...additions, ...state.snapshots] };
  try { storage?.setItem(COMPLETED_RACE_SNAPSHOTS_STORAGE_KEY, JSON.stringify(next)); return storage ? next : state; } catch { return state; }
};
