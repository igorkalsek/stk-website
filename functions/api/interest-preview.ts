/**
 * DEV-047 safety hold. The verified production interest-preview ranks legacy
 * totals (including passive views) from July 2026 aggregates. Its limited
 * response has neither v2 scores nor enough 30-day buckets to safely rerank.
 *
 * Resume only after a separately reviewed, fresh v2 read contract is verified.
 * Do not fall back to legacy totals, votes, or a locally invented score.
 */
export async function onRequestGet() {
  return new Response(JSON.stringify({
    ok: false,
    endpoint: 'site-analytics',
    type: 'interest_preview',
    error: 'interest_preview_temporarily_unavailable',
    items: []
  }), {
    status: 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}
