import { asRecord, mapPublicRaceEventForDetail, toApiRecords } from './utils-event-detail.js';
import { buildMasterApiPath, type PublicYear } from './utils-public-year.js';

export type PublicYearStats = { confirmed: number; family: number };

/** Use the same public eligibility and explicit family marker as the year-aware finder.
 * No upcoming cutoff: annual totals include the whole season. Empty data is neutral.
 */
export const countPublicYearStats = (payload: unknown, year: PublicYear): PublicYearStats | null => {
  if (asRecord(payload)?.ok === false) return null;
  const records = toApiRecords(payload);
  if (!records.length) return null;
  const events = records.map((record) => mapPublicRaceEventForDetail(record, year))
    .filter((event) => event !== null);
  if (!events.length) return null;
  return { confirmed: events.length, family: events.filter((event) => event.familyFriendly).length };
};

export const loadPublicYearStats = async (year: PublicYear, loadJson: (path: string) => Promise<unknown>): Promise<PublicYearStats | null> => {
  try {
    return countPublicYearStats(await loadJson(buildMasterApiPath(year)), year);
  } catch {
    return null;
  }
};
