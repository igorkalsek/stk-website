import { parseInterestPreview, type InterestYear } from '../../src/utils-interest-preview.js';

type Context = { request: Request; env?: { STK_INTEREST_PREVIEW_ENABLED?: string } };
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const unavailable = () => new Response(JSON.stringify({
    ok: false,
    endpoint: 'site-analytics',
    type: 'interest_preview',
    error: 'interest_preview_temporarily_unavailable',
    items: []
  }), { status: 503, headers });

/** Remains 503 by default; enabling requires separately approved production configuration. */
export async function onRequestGet(context?: Context) {
  if (context?.env?.STK_INTEREST_PREVIEW_ENABLED !== 'true') return unavailable();
  const year = new URL(context.request.url).searchParams.get('year') || '2026';
  if (!['2026', '2027'].includes(year)) return unavailable();
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000);
  try {
    // Fixed existing Worker only. Caller cannot supply an upstream, scope or time window.
    const response = await fetch(`https://stk-master-api.igor-kalsek.workers.dev/site-analytics?scope=recent-interest&year=${year}&limit=20`, {
      headers: { accept: 'application/json' }, signal: controller.signal, redirect: 'error', cache: 'no-store'
    });
    if (!response.ok) return unavailable();
    const payload = await response.json();
    parseInterestPreview(payload, year as InterestYear);
    return new Response(JSON.stringify(payload), { status: 200, headers });
  } catch { return unavailable(); }
  finally { clearTimeout(timeout); }
}
