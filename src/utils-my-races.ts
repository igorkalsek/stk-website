import { buildEnglishEventDetailPath, buildEventDetailPath, getStableEventId, mapPublicRaceEvent, toApiRecords, type PublicRaceEvent } from './utils-event-detail.js';
import { getSavedRaceKey, SAVED_RACE_STATUSES, type SavedRace, type SavedRaceStatus } from './utils-saved-races.js';
import type { CompletedRaceSnapshot } from './utils-completed-snapshots.js';

export type SavedRaceResolution = {
  savedRace: SavedRace;
  event: PublicRaceEvent | null;
  key: string;
  status: 'upcoming' | 'past-or-unresolved';
  snapshot?: CompletedRaceSnapshot | null;
};

export const resolveSavedRaces = (savedRaces: SavedRace[], payloadsByYear: Record<string, unknown>, todayIso: string): SavedRaceResolution[] => {
  const todayValue = new Date(`${todayIso}T00:00:00`).getTime();
  const eventByKey = new Map<string, PublicRaceEvent>();

  Object.entries(payloadsByYear).forEach(([year, payload]) => {
    toApiRecords(payload).forEach((record) => {
      const event = mapPublicRaceEvent(record, year, 0);
      if (!event) return;
      eventByKey.set(`${year}:${getStableEventId(event)}`, event);
    });
  });

  return savedRaces.map((savedRace) => {
    const key = getSavedRaceKey(savedRace);
    const event = eventByKey.get(key) ?? null;
    const status = event && event.dateValue >= todayValue ? 'upcoming' : 'past-or-unresolved';
    return { savedRace, event, key, status };
  });
};

export const sortResolvedSavedRaces = (items: SavedRaceResolution[]) => [...items].sort((a, b) => {
  const aDate = a.event?.date || a.savedRace.date || '9999-12-31';
  const bDate = b.event?.date || b.savedRace.date || '9999-12-31';
  return aDate.localeCompare(bDate) || (a.event?.title || a.savedRace.title).localeCompare(b.event?.title || b.savedRace.title, 'sl-SI');
});

export const getSavedRaceDetailPath = (event: PublicRaceEvent, language: 'sl' | 'en') =>
  language === 'en' ? buildEnglishEventDetailPath(event) : buildEventDetailPath(event);

export type MyRacesStatusFilter = SavedRaceStatus | 'all';
export const countSavedRaceStatuses = (items: { savedRace: SavedRace }[] | SavedRace[]) => {
  const counts = Object.fromEntries(SAVED_RACE_STATUSES.map((status) => [status, 0])) as Record<SavedRaceStatus, number>;
  items.forEach((item) => { const race = 'savedRace' in item ? item.savedRace : item; counts[race.status] += 1; });
  return counts;
};
export const filterSavedRaceResolutionsByStatus = <T extends { savedRace: SavedRace }>(items: T[], filter: MyRacesStatusFilter): T[] => filter === 'all' ? items : items.filter((item) => item.savedRace.status === filter);

export type MyRacesView = 'plan' | 'season';
export const getInitialMyRacesView = (search: string): MyRacesView => {
  try { return new URLSearchParams(search).get('view') === 'season' ? 'season' : 'plan'; }
  catch { return 'plan'; }
};

import { buildRegistrationDeadlineViews, type RegistrationDeadlineView } from './utils-registration-deadlines.js';
import type { AdditionalEventData } from './utils-additional.js';

export type SavedRaceDeadlineItem = SavedRaceResolution & {
  event: PublicRaceEvent & { additionalData?: AdditionalEventData | null };
  deadline: RegistrationDeadlineView;
};

export type SavedRaceDeadlineGroup = {
  key: string;
  event: SavedRaceDeadlineItem['event'];
  items: SavedRaceDeadlineItem[];
};

const ACTIVE_DEADLINE_STATUSES = new Set<SavedRaceStatus>(['following', 'planning', 'registered']);

export const getUpcomingSavedRaceDeadlines = ({
  items,
  todayIso,
  windowDays = 30,
  limit = 6
}: {
  items: Array<SavedRaceResolution & { event: (PublicRaceEvent & { additionalData?: AdditionalEventData | null }) | null }>;
  todayIso: string;
  windowDays?: number;
  limit?: number;
}): SavedRaceDeadlineItem[] => items
  .filter((item): item is SavedRaceDeadlineItem => Boolean(item.event?.additionalData && ACTIVE_DEADLINE_STATUSES.has(item.savedRace.status)))
  .flatMap((item) => buildRegistrationDeadlineViews({
    todayIso,
    eventDate: item.event.date,
    registrationDeadline: item.event.additionalData?.registrationDeadline,
    earlyRegistrationDeadline: item.event.additionalData?.earlyRegistrationDeadline
  }).map((deadline) => ({ ...item, event: item.event, deadline })))
  .filter((item) => item.deadline.daysRemaining >= 0 && item.deadline.daysRemaining <= windowDays)
  .sort((a, b) => a.deadline.date.localeCompare(b.deadline.date) || a.event.date.localeCompare(b.event.date) || a.event.title.localeCompare(b.event.title, 'sl-SI'))
  .slice(0, limit);


export const groupUpcomingDeadlinesByRace = (items: SavedRaceDeadlineItem[]): SavedRaceDeadlineGroup[] => {
  const groups = new Map<string, SavedRaceDeadlineGroup>();
  items.forEach((item) => {
    const key = item.key || `${item.event.year}:${getStableEventId(item.event)}`;
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, { key, event: item.event, items: [item] });
  });
  return [...groups.values()].map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => a.deadline.date.localeCompare(b.deadline.date) || a.deadline.kind.localeCompare(b.deadline.kind))
  })).sort((a, b) => a.items[0].deadline.date.localeCompare(b.items[0].deadline.date) || a.event.date.localeCompare(b.event.date) || a.event.title.localeCompare(b.event.title, 'sl-SI'));
};
