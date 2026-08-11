import { formatEnglishRegion, formatEnglishSurface } from './utils-english.js';

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

export interface PlanningWeek {
  key: string;
  start: string;
  end: string;
  weekendStart: string;
  weekendEnd: string;
  weekendEvents: PlanningEvent[];
  weekdayEvents: PlanningEvent[];
  events: PlanningEvent[];
  confirmed: number;
  expected: number;
  known: number;
}

export interface PlanningMonthSection {
  month: string;
  weeks: PlanningWeek[];
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

export function allPlanningWeekends(): Array<{ key: string; start: string; end: string; month: string }> {
  const result: Array<{ key: string; start: string; end: string; month: string }> = [];
  let saturday = toDate('2027-01-02');
  while (saturday.getUTCFullYear() === 2027) {
    const start = toIso(saturday);
    result.push({ key: start, start, end: toIso(addDays(saturday, 1)), month: start.slice(5, 7) });
    saturday = addDays(saturday, 7);
  }
  return result;
}

export function planningWeekendsForMonth(month: string): Array<{ key: string; start: string; end: string; month: string }> {
  return allPlanningWeekends().filter((weekend) => weekend.start.slice(5, 7) === month || weekend.end.slice(5, 7) === month);
}

function calendarWeekStart(iso: string): string {
  const date = toDate(iso);
  const day = date.getUTCDay();
  return toIso(addDays(date, day === 0 ? -6 : 1 - day));
}

export function buildPlanningWeeks(events: PlanningEvent[]): PlanningWeek[] {
  const weeks = new Map<string, { weekend: PlanningEvent[]; weekday: PlanningEvent[] }>();
  const add = (key: string, kind: 'weekend' | 'weekday', event: PlanningEvent) => {
    const value = weeks.get(key) ?? { weekend: [], weekday: [] };
    if (!value[kind].includes(event)) value[kind].push(event);
    weeks.set(key, value);
  };
  events.forEach((event) => {
    const period = eventPeriod(event);
    if (!period) return;
    let weekStart = calendarWeekStart(period[0]);
    while (weekStart <= period[1]) {
      const saturday = toIso(addDays(toDate(weekStart), 5));
      const sunday = toIso(addDays(toDate(weekStart), 6));
      const overlapsWeekend = period[0] <= sunday && period[1] >= saturday;
      add(weekStart, overlapsWeekend ? 'weekend' : 'weekday', event);
      weekStart = toIso(addDays(toDate(weekStart), 7));
    }
  });
  return [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([start, grouped]) => {
    const eventsForWeek = [...new Set([...grouped.weekend, ...grouped.weekday])];
    const calendarWeekEnd = toIso(addDays(toDate(start), 6));
    return {
      key: start, start, end: calendarWeekEnd > '2027-12-31' ? '2027-12-31' : calendarWeekEnd, weekendStart: toIso(addDays(toDate(start), 5)), weekendEnd: calendarWeekEnd,
      weekendEvents: grouped.weekend, weekdayEvents: grouped.weekday, events: eventsForWeek,
      confirmed: eventsForWeek.filter((event) => event.status === 'potrjeno').length,
      expected: eventsForWeek.filter((event) => event.status === 'pričakovano').length,
      known: eventsForWeek.filter((event) => event.status === 'termin_znan').length
    };
  });
}

export function buildPlanningMonthSections(events: PlanningEvent[], selectedMonth = ''): PlanningMonthSection[] {
  const weeks = buildPlanningWeeks(events);
  if (selectedMonth) return weeks.length ? [{ month: selectedMonth, weeks }] : [];
  return Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((month) => ({
    month,
    weeks: weeks.filter((week) => week.weekendStart.startsWith('2028-') ? month === '12' : week.weekendStart.slice(5, 7) === month)
  })).filter((section) => section.weeks.length > 0);
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
  return `${date.getUTCDate()}. ${slMonths[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

const slMonths = ['januarja', 'februarja', 'marca', 'aprila', 'maja', 'junija', 'julija', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'];
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
  if (!period) return lang === 'en' ? 'Date not yet known' : 'Datum še ni znan';
  return period[0] === period[1] ? formatPlanningDate(period[0], lang) : formatPlanningRange(period[0], period[1], lang);
}

export function formatPlanningUpdated(value: string, lang: 'sl' | 'en'): string {
  const iso = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const date = toDate(iso);
  if (Number.isNaN(date.valueOf()) || toIso(date) !== iso) return '';
  if (lang === 'en') return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  return `${date.getUTCDate()}. ${slMonths[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function formatPlanningEventCount(count: number, lang: 'sl' | 'en', context: 'count' | 'show' = 'count'): string {
  if (lang === 'en') return `${count} ${count === 1 ? 'event' : 'events'}`;
  const noun = count === 1 ? 'dogodek' : count === 2 ? 'dogodka' : count === 3 || count === 4 ? (context === 'show' ? 'dogodke' : 'dogodki') : 'dogodkov';
  return `${count} ${noun}`;
}

export function formatPlanningWeekStatusCount(status: PlanningStatus, count: number, lang: 'sl' | 'en'): string {
  if (lang === 'en') {
    const label = status === 'potrjeno' ? 'confirmed' : status === 'pričakovano' ? 'expected' : 'date window known';
    return `${count} ${label}`;
  }
  if (status === 'termin_znan') return `${count} z znanim terminom`;
  const forms = status === 'potrjeno'
    ? ['potrjen', 'potrjena', 'potrjeni', 'potrjenih']
    : ['pričakovan', 'pričakovana', 'pričakovani', 'pričakovanih'];
  const form = count === 1 ? forms[0] : count === 2 ? forms[1] : count === 3 || count === 4 ? forms[2] : forms[3];
  return `${count} ${form}`;
}

export const formatPlanningRegion = (value: string, lang: 'sl' | 'en'): string => lang === 'en' ? formatEnglishRegion(value) : value;
export const formatPlanningSurface = (value: string, lang: 'sl' | 'en'): string => lang === 'en' ? formatEnglishSurface(value) : value;

export type PlanningSummaryKind = 'confirmed' | 'expected' | 'known';

export function formatPlanningSummaryLabel(kind: PlanningSummaryKind, count: number, lang: 'sl' | 'en'): string {
  if (lang === 'en') {
    if (kind === 'confirmed') return count === 1 ? 'confirmed date' : 'confirmed dates';
    if (kind === 'expected') return count === 1 ? 'expected event' : 'expected events';
    return count === 1 ? 'event with a known date window' : 'events with a known date window';
  }
  const form = count === 1 ? 0 : count === 2 ? 1 : count === 3 || count === 4 ? 2 : 3;
  const labels: Record<PlanningSummaryKind, string[]> = {
    confirmed: ['potrjen termin', 'potrjena termina', 'potrjeni termini', 'potrjenih terminov'],
    expected: ['pričakovan dogodek', 'pričakovana dogodka', 'pričakovani dogodki', 'pričakovanih dogodkov'],
    known: ['dogodek z znanim obdobjem', 'dogodka z znanim obdobjem', 'dogodki z znanim obdobjem', 'dogodkov z znanim obdobjem']
  };
  return labels[kind][form];
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
