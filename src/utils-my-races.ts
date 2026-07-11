import { buildEnglishEventDetailPath, buildEventDetailPath, getStableEventId, mapPublicRaceEvent, toApiRecords, type PublicRaceEvent } from './utils-event-detail.js';
import { getSavedRaceKey, type SavedRace } from './utils-saved-races.js';

export type SavedRaceResolution = {
  savedRace: SavedRace;
  event: PublicRaceEvent | null;
  key: string;
  status: 'upcoming' | 'past-or-unresolved';
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
