export function interestContract(items = [], { year = '2026', now = new Date(), candidates = items.length * 2 } = {}) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Ljubljana', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(x => [x.type, x.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`, date = new Date(day + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() - 1); const to = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() - 6); const from = date.toISOString().slice(0, 10);
  const captured = new Date(now.getTime() - 1000).toISOString();
  return { ok: true, endpoint: 'site-analytics', type: 'interest_preview', contract: 'recent-interest-v1', score_version: 'v2', year,
    period: { from, to, timezone: 'Europe/Ljubljana', final_day_complete: true },
    generated_at: captured, captured_at: captured, master_captured_at: captured, expires_at: new Date(now.getTime() + 299000).toISOString(),
    quality: { candidates, valid: candidates, excluded: 0, verified_percent: candidates ? 100 : null },
    items: items.map((item, i) => ({ rank: i + 1, event_year: year, event_key_source: 'event_id',
      community_interest_score_7d: 10 - i, active_actions_7d: 2, ...item })) };
}
