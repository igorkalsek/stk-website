import { asRecord, mapPublicRaceEventForDetail, normalizeSloveneText, toApiRecords } from './utils-event-detail.js';
import { buildMasterApiPath, type PublicYear } from './utils-public-year.js';

export type PublicYearStats = { confirmed: number; family: number };

/** Explicit public family offers only; price or short distances alone are insufficient.
 * Keep this scoped to homepage stats: the existing finder contract is unchanged.
 */
export const hasExplicitFamilyOffer = (publicNotes: string): boolean => {
  const text = normalizeSloveneText(publicNotes).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return text.split(/[.!?;|\n]+/).some((clause) => {
    // Do not turn an adult-only restriction or an explicitly absent offer into a badge.
    if (/\b(?:samo|izkljucno|le)\s+za\s+(?:polnoletne|odrasle)\b/.test(clause)) return false;
    if (/\b(?:brez|ni|niso|ne bo|ne bodo)\s+(?:organiziran\w*\s+)?(?:otrosk\w*|druz\w*|predsolsk\w*|cici)\b/.test(clause)) return false;
    if (/\b(?:tek\w*|popust\w*|ugodnost\w*|varstv\w*)\s+(?:ni|niso|ne bo|ne bodo)\b/.test(clause)) return false;
    return /\bdruzinam prijazno\b/.test(clause)
      || /\b(?:otrosk\w*\s+(?:[a-z]+\s+)?(?:tek\w*|trail|delavnic\w*|aktivnost\w*|varstvo|program|popust\w*)|predsolsk\w*\s+tek\w*|cici\s*tek\w*|tek\w*\s+za\s+(?:otroke|najmlajse))\b/.test(clause)
      || /\bdruzinsk\w*\s+(?:prijav\w*|popust\w*|ugodnost\w*|kategorij\w*|tek\w*|trail|pohod\w*)\b/.test(clause)
      || /\b(?:popust\w*|ugodnost\w*)\s+za\s+(?:otroke|druzine)\b/.test(clause)
      || /\bbrezplacn\w*\s+(?:prijav\w*|udelezb\w*|varstv\w*)\s+(?:za\s+)?otrok\w*\b/.test(clause)
      || /\bvsak\s+(?:tretji|drugi)\s+otrok(?:\s+iz\s+druzine)?\s+(?:je\s+)?brezplac\w*\b/.test(clause)
      || /\botroci(?:,\s*mlajsi od \d+ let,)?\s+(?:lahko\s+)?sodelujejo\s+v\s+spremstvu\b/.test(clause);
  });
};

/** Annual public eligibility reuses the year-aware mapper, without an upcoming cutoff. */
export const countPublicYearStats = (payload: unknown, year: PublicYear): PublicYearStats | null => {
  if (asRecord(payload)?.ok === false) return null;
  const records = toApiRecords(payload);
  if (!records.length) return null;
  const events = records.map((record) => mapPublicRaceEventForDetail(record, year))
    .filter((event) => event !== null);
  if (!events.length) return null;
  return { confirmed: events.length, family: events.filter((event) => hasExplicitFamilyOffer(event.publicNotes)).length };
};

export const loadPublicYearStats = async (year: PublicYear, loadJson: (path: string) => Promise<unknown>): Promise<PublicYearStats | null> => {
  try {
    return countPublicYearStats(await loadJson(buildMasterApiPath(year)), year);
  } catch {
    return null;
  }
};
