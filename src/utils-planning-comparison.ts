import { safeHttpUrl } from './utils-event-detail.js';
import { formatPlanningDate, formatPlanningRange, type PlanningEvent } from './utils-planning-2027.js';

export type ComparisonMode = 'day' | 'weekend';
export type ComparisonGroup = 'confirmed' | 'nearby' | 'expected' | 'known';
export type PlanningLink = { key: string; officialUrl: string; profilePath: string };
export type ComparisonRange = { start: string; end: string; nearbyStart: string; nearbyEnd: string };
export type PlanningComparison = {
  range: ComparisonRange;
  groups: Record<ComparisonGroup, PlanningEvent[]>;
  undated: number;
  outsideYear: boolean;
};

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const shift = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const valid2027 = (value: string) => value.startsWith('2027-') && validDate(value);

export function comparisonRange(date: string, mode: ComparisonMode): ComparisonRange | null {
  if (!valid2027(date)) return null;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  // Sunday belongs to the preceding Saturday; Monday–Friday to this week's weekend.
  const start = mode === 'weekend' ? shift(date, weekday === 0 ? -1 : 6 - weekday) : date;
  const end = mode === 'weekend' ? shift(start, 1) : start;
  return { start, end, nearbyStart: shift(start, -7), nearbyEnd: shift(end, 7) };
}

/** Comparison never fills a missing endpoint or reverses an unreliable window. */
function comparisonPeriod(event: PlanningEvent): [string, string] | null {
  if (event.status === 'potrjeno') return valid2027(event.datum) ? [event.datum, event.datum] : null;
  if (event.status !== 'pričakovano' && event.status !== 'termin_znan') return null;
  const { predvideno_od: start, predvideno_do: end } = event;
  return valid2027(start) && valid2027(end) && start <= end ? [start, end] : null;
}

export function comparePlanningEvents(events: PlanningEvent[], date: string, mode: ComparisonMode, filters: { region: string; surface: string }): PlanningComparison | null {
  const range = comparisonRange(date, mode);
  if (!range) return null;
  const groups: PlanningComparison['groups'] = { confirmed: [], nearby: [], expected: [], known: [] };
  let undated = 0;
  const seen = new Set<string>();
  for (const event of events) {
    if ((filters.region && event.regija !== filters.region) || (filters.surface && event.tip_podlage !== filters.surface)) continue;
    const signature = JSON.stringify([event.naziv_prireditve, event.datum, event.predvideno_od, event.predvideno_do, event.kraj, event.regija, event.tip_podlage, event.status]);
    if (seen.has(signature)) continue;
    seen.add(signature);
    const period = comparisonPeriod(event);
    if (!period) { undated++; continue; }
    const overlaps = period[0] <= range.end && period[1] >= range.start;
    if (event.status === 'potrjeno') {
      if (overlaps) groups.confirmed.push(event);
      else if (period[0] >= range.nearbyStart && period[0] <= range.nearbyEnd) groups.nearby.push(event);
    } else if (overlaps) groups[event.status === 'pričakovano' ? 'expected' : 'known'].push(event);
  }
  for (const group of Object.values(groups)) group.sort((a, b) => comparisonPeriod(a)![0].localeCompare(comparisonPeriod(b)![0]) || a.naziv_prireditve.localeCompare(b.naziv_prireditve, 'sl'));
  return { range, groups, undated, outsideYear: range.nearbyStart < '2027-01-01' || range.nearbyEnd > '2027-12-31' };
}

/** Exact raw fields only: no title cleanup, fuzzy matching, or inferred identity. */
export function planningLinkKey(event: Pick<PlanningEvent, 'naziv_prireditve' | 'datum' | 'kraj' | 'regija' | 'tip_podlage'>): string {
  return JSON.stringify([event.naziv_prireditve, event.datum, event.kraj, event.regija, event.tip_podlage]);
}

export function matchPlanningLinks(events: PlanningEvent[], candidates: PlanningLink[]): Map<PlanningEvent, PlanningLink> {
  const counts = new Map<string, number>();
  for (const event of events) if (event.status === 'potrjeno') {
    const key = planningLinkKey(event);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const matches = new Map<PlanningEvent, PlanningLink>();
  for (const event of events) {
    if (event.status !== 'potrjeno' || !valid2027(event.datum) || !event.naziv_prireditve || !event.kraj) continue;
    const key = planningLinkKey(event);
    const found = candidates.filter(candidate => candidate.key === key);
    if (counts.get(key) !== 1 || found.length !== 1) continue;
    const link = found[0];
    matches.set(event, {
      key, officialUrl: safeHttpUrl(link.officialUrl),
      // Paths originate from the same build's generated profiles, never from a guessed slug.
      profilePath: /^\/(?:tek|en\/races)\/2027\/[a-z0-9-]+\/$/.test(link.profilePath) ? link.profilePath : ''
    });
  }
  return matches;
}

export function formatComparisonRange(start: string, end: string, lang: 'sl' | 'en'): string {
  if (start === end) return formatPlanningDate(start, lang);
  if (start.slice(0, 4) !== end.slice(0, 4)) return `${formatPlanningDate(start, lang)} – ${formatPlanningDate(end, lang)}`;
  return formatPlanningRange(start, end, lang);
}
