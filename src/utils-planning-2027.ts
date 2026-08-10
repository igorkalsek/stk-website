export const PLANNING_2027_API_URL = 'https://stk-master-api.igor-kalsek.workers.dev/planning-2027';

export type PlanningStatus = 'potrjeno' | 'pričakovano' | 'termin_znan';

export interface PlanningEvent {
  naziv_prireditve: string;
  datum: string;
  predvideno_od: string;
  predvideno_do: string;
  kraj: string;
  regija: string;
  tip_podlage: string;
  status: PlanningStatus;
}

export interface PlanningPayload {
  ok: true;
  type: 'planning_2027';
  source: 'tekaski-koledar-master';
  year: '2027';
  generated_at: string;
  row_count: number;
  columns: string[];
  data: PlanningEvent[];
}

export interface PlanningWeekend {
  key: string;
  start: string;
  end: string;
  events: PlanningEvent[];
  confirmed: number;
  expected: number;
  total: number;
}

export interface PlanningOverview {
  events: PlanningEvent[];
  weekends: PlanningWeekend[];
  weekday: PlanningEvent[];
  unknown: PlanningEvent[];
}

const statuses = new Set<PlanningStatus>(['potrjeno', 'pričakovano', 'termin_znan']);
const isoPattern = /^2027-\d{2}-\d{2}$/;

const validIso = (value: unknown): value is string => {
  if (typeof value !== 'string' || !isoPattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export function parsePlanningPayload(value: unknown): PlanningPayload | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Record<string, unknown>;
  if (payload.ok !== true || payload.type !== 'planning_2027' || payload.source !== 'tekaski-koledar-master' || payload.year !== '2027' || !Array.isArray(payload.data)) return null;
  const data: PlanningEvent[] = [];
  for (const raw of payload.data) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const status = clean(row.status) as PlanningStatus;
    const datum = clean(row.datum);
    const predvidenoOd = clean(row.predvideno_od);
    const predvidenoDo = clean(row.predvideno_do);
    if (!statuses.has(status) || !clean(row.naziv_prireditve)) continue;
    if ((datum && !validIso(datum)) || (predvidenoOd && !validIso(predvidenoOd)) || (predvidenoDo && !validIso(predvidenoDo))) continue;
    data.push({
      naziv_prireditve: clean(row.naziv_prireditve), datum,
      predvideno_od: predvidenoOd, predvideno_do: predvidenoDo,
      kraj: clean(row.kraj), regija: clean(row.regija), tip_podlage: clean(row.tip_podlage), status
    });
  }
  return {
    ok: true, type: 'planning_2027', source: 'tekaski-koledar-master', year: '2027',
    generated_at: clean(payload.generated_at), row_count: typeof payload.row_count === 'number' ? payload.row_count : data.length,
    columns: Array.isArray(payload.columns) ? payload.columns.filter((column): column is string => typeof column === 'string') : [], data
  };
}

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.valueOf() + days * 86400000);

function eventPeriod(event: PlanningEvent): [string, string] | null {
  if (event.status === 'potrjeno') return event.datum ? [event.datum, event.datum] : null;
  const start = event.predvideno_od || event.predvideno_do;
  const end = event.predvideno_do || event.predvideno_od;
  if (!start || !end) return null;
  return start <= end ? [start, end] : [end, start];
}

function weekendKeysForPeriod(start: string, end: string): Array<[string, string]> {
  const result: Array<[string, string]> = [];
  const startDate = toDate(start);
  const startDay = startDate.getUTCDay();
  let saturday = startDay === 6 ? startDate : addDays(startDate, startDay === 0 ? -1 : 6 - startDay);
  if (toIso(saturday) < start && toIso(addDays(saturday, 1)) < start) saturday = addDays(saturday, 7);
  while (toIso(saturday) <= end) {
    const sunday = addDays(saturday, 1);
    if (toIso(sunday) >= start) result.push([toIso(saturday), toIso(sunday)]);
    saturday = addDays(saturday, 7);
  }
  return result;
}

export function buildPlanningOverview(events: PlanningEvent[]): PlanningOverview {
  const weekendMap = new Map<string, PlanningEvent[]>();
  const weekday: PlanningEvent[] = [];
  const unknown: PlanningEvent[] = [];
  events.forEach((event) => {
    const period = eventPeriod(event);
    if (!period) { unknown.push(event); return; }
    const weekendKeys = weekendKeysForPeriod(...period);
    if (weekendKeys.length === 0) { weekday.push(event); return; }
    const seen = new Set<string>();
    weekendKeys.forEach(([start]) => {
      if (seen.has(start)) return;
      seen.add(start);
      weekendMap.set(start, [...(weekendMap.get(start) ?? []), event]);
    });
  });
  const weekends = [...weekendMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([start, weekendEvents]) => ({
    key: start, start, end: toIso(addDays(toDate(start), 1)), events: weekendEvents,
    confirmed: weekendEvents.filter((event) => event.status === 'potrjeno').length,
    expected: weekendEvents.filter((event) => event.status !== 'potrjeno').length,
    total: weekendEvents.length
  }));
  return { events, weekends, weekday, unknown };
}

export interface PlanningFilters { month: string; region: string; surface: string; }

export function filterPlanningEvents(events: PlanningEvent[], filters: PlanningFilters): PlanningEvent[] {
  return events.filter((event) => {
    const period = eventPeriod(event);
    const monthStart = filters.month ? `2027-${filters.month}-01` : '';
    const followingMonth = filters.month ? new Date(Date.UTC(2027, Number(filters.month), 1)) : null;
    const monthEnd = followingMonth ? toIso(addDays(followingMonth, -1)) : '';
    const monthMatches = filters.month === '' || (period !== null && period[0] <= monthEnd && period[1] >= monthStart);
    return monthMatches && (!filters.region || event.regija === filters.region) && (!filters.surface || event.tip_podlage === filters.surface);
  });
}

export function formatPlanningDate(iso: string, lang: 'sl' | 'en'): string {
  const date = toDate(iso);
  if (lang === 'en') return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  return `${date.getUTCDate()}. ${date.getUTCMonth() + 1}. ${date.getUTCFullYear()}`;
}

const slMonths = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december'];
export function formatPlanningRange(start: string, end: string, lang: 'sl' | 'en', includeYear = true): string {
  const from = toDate(start); const to = toDate(end);
  const sameMonth = from.getUTCMonth() === to.getUTCMonth();
  if (lang === 'en') {
    const month = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(to);
    const prefix = sameMonth ? `${from.getUTCDate()}–${to.getUTCDate()} ${month}` : `${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(from)}–${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(to)}`;
    return includeYear ? `${prefix} ${to.getUTCFullYear()}` : prefix;
  }
  const prefix = sameMonth ? `${from.getUTCDate()}.–${to.getUTCDate()}. ${slMonths[to.getUTCMonth()]}` : `${from.getUTCDate()}. ${slMonths[from.getUTCMonth()]}–${to.getUTCDate()}. ${slMonths[to.getUTCMonth()]}`;
  return includeYear ? `${prefix} ${to.getUTCFullYear()}` : prefix;
}

export function formatEventPlanningDate(event: PlanningEvent, lang: 'sl' | 'en'): string {
  if (event.status === 'potrjeno' && event.datum) return formatPlanningDate(event.datum, lang);
  const period = eventPeriod(event);
  if (!period) return lang === 'en' ? 'Date not yet known' : 'Termin še ni znan';
  return period[0] === period[1] ? formatPlanningDate(period[0], lang) : formatPlanningRange(period[0], period[1], lang);
}

export async function fetchPlanning2027(fetchImpl: typeof fetch = fetch): Promise<PlanningPayload | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetchImpl(PLANNING_2027_API_URL, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) return null;
    return parsePlanningPayload(await response.json());
  } catch { return null; }
  finally { clearTimeout(timeout); }
}
