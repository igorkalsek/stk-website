import { getTodayIsoInLjubljana } from './utils-date.js';

type RecordValue = Record<string, unknown>;
export type InterestYear = '2026' | '2027';
export type InterestItem = {
  rank: number; event_year: InterestYear; event_id: string; event_name: string; event_date: string;
  community_interest_score_7d: number; active_actions_7d: number;
};
const record = (v: unknown): RecordValue | null => v && typeof v === 'object' && !Array.isArray(v) ? v as RecordValue : null;
const invalid = (): never => { throw new Error('Interest data is unavailable.'); };
const finiteTime = (v: unknown) => typeof v === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) ? Date.parse(v) : NaN;

/** Shared by the Pages relay and both browsers. No legacy-score fallback. */
export function parseInterestPreview(value: unknown, year: InterestYear, now = new Date()): InterestItem[] {
  const p = record(value), period = record(p?.period), quality = record(p?.quality);
  if (!p || p.ok !== true || p.type !== 'interest_preview' || p.endpoint !== 'site-analytics' ||
      p.contract !== 'recent-interest-v1' || p.score_version !== 'v2' || p.year !== year ||
      !period || period.timezone !== 'Europe/Ljubljana' || period.final_day_complete !== true ||
      !quality || !Array.isArray(p.items) || p.items.length > 50) return invalid();
  const today = getTodayIsoInLjubljana(now), end = new Date(today + 'T12:00:00Z');
  end.setUTCDate(end.getUTCDate() - 1); const to = end.toISOString().slice(0, 10);
  end.setUTCDate(end.getUTCDate() - 6); const from = end.toISOString().slice(0, 10);
  if (period.from !== from || period.to !== to) return invalid();
  const captured = finiteTime(p.captured_at), master = finiteTime(p.master_captured_at);
  const generated = finiteTime(p.generated_at), expires = finiteTime(p.expires_at), current = now.getTime();
  if ([captured, master, generated, expires].some(t => !Number.isFinite(t)) ||
      captured > generated || master > generated || generated > current || current >= expires ||
      current - captured >= 300000 || current - master >= 300000 || expires > Math.min(captured, master) + 300000) return invalid();
  const candidates = quality.candidates, valid = quality.valid, excluded = quality.excluded;
  if (![candidates, valid, excluded].every(n => Number.isInteger(n) && Number(n) >= 0) ||
      Number(valid) + Number(excluded) !== candidates ||
      (Number(candidates) > 0 && Number(valid) / Number(candidates) < 0.95)) return invalid();
  const seen = new Set<string>(); let previous: InterestItem | null = null;
  const items = p.items.map((v, i) => {
    const a = record(v);
    if (!a || a.rank !== i + 1 || a.event_year !== year || a.event_key_source !== 'event_id' ||
        typeof a.event_id !== 'string' || !/^R\d{6}$/.test(a.event_id) || seen.has(a.event_id) ||
        typeof a.event_name !== 'string' || !a.event_name.trim() ||
        typeof a.event_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.event_date) ||
        !a.event_date.startsWith(year + '-') || a.event_date < today ||
        !Number.isFinite(Date.parse(a.event_date)) || new Date(a.event_date).toISOString().slice(0, 10) !== a.event_date ||
        !Number.isInteger(a.community_interest_score_7d) || Number(a.community_interest_score_7d) < 1 ||
        !Number.isInteger(a.active_actions_7d) || Number(a.active_actions_7d) < 1 ||
        Number(a.active_actions_7d) > Number(a.community_interest_score_7d) ||
        Number(a.community_interest_score_7d) > Number(a.active_actions_7d) * 5) return invalid();
    const item = a as unknown as InterestItem;
    if (previous && (previous.community_interest_score_7d < item.community_interest_score_7d ||
        previous.community_interest_score_7d === item.community_interest_score_7d &&
        (previous.event_date > item.event_date || previous.event_date === item.event_date && previous.event_id > item.event_id))) return invalid();
    previous = item; seen.add(item.event_id);
    return { rank: item.rank, event_year: item.event_year, event_id: item.event_id,
      event_name: item.event_name, event_date: item.event_date,
      community_interest_score_7d: item.community_interest_score_7d, active_actions_7d: item.active_actions_7d };
  });
  if (items.reduce((n, a) => n + a.active_actions_7d, 0) > Number(valid)) return invalid();
  return items;
}

const nameKey = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();
/** Match exact target year/physical row/date/name against current public Master data. */
export function matchInterestMasters(items: InterestItem[], masters: RecordValue[], year: InterestYear): RecordValue[] {
  const index = new Map<string, RecordValue[]>();
  for (const m of masters) {
    const row = String(m.row ?? '');
    if (!/^[1-9]\d{0,5}$/.test(row)) continue;
    const id = 'R' + row.padStart(6, '0');
    index.set(id, [...(index.get(id) ?? []), m]);
  }
  return items.map(item => {
    const matches = index.get(item.event_id);
    const m = matches?.length === 1 ? matches[0] : null;
    if (!m || m.datum !== item.event_date || !String(m.datum).startsWith(year + '-') ||
        ['year', 'leto', 'event_year'].some(k => m[k] !== undefined && String(m[k]) !== year) ||
        nameKey(m.naziv_prireditve) !== nameKey(item.event_name) ||
        String(m.status_dogodka).trim().toLowerCase() !== 'potrjeno' ||
        String(m.vidno_v_javnem_koledarju).trim().toUpperCase() !== 'DA') return invalid();
    return { ...m, __interest_preview_ranked: true };
  });
}
