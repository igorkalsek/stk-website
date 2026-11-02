import { parseInterestPreview, type InterestYear } from '../../src/utils-interest-preview.js';

type Context = { request: Request; env?: { STK_INTEREST_PREVIEW_ENABLED?: string } };
type Diagnostic = 'disabled' | 'invalid_year' | 'request_config_error' | 'fetch_error'
  | 'upstream_redirect' | 'upstream_status' | 'timeout' | 'invalid_json' | 'contract_rejected';
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
// Only fixed codes leave the relay; never forward upstream headers, errors or payloads on failure.
const unavailable = (diagnostic: Diagnostic) => new Response(JSON.stringify({
    ok: false,
    endpoint: 'site-analytics',
    type: 'interest_preview',
    error: 'interest_preview_temporarily_unavailable',
    items: []
  }), { status: 503, headers: { ...headers, 'X-STK-Interest-Diagnostic': diagnostic } });

/** Remains 503 by default; enabling requires separately approved production configuration. */
export async function onRequestGet(context?: Context) {
  if (context?.env?.STK_INTEREST_PREVIEW_ENABLED !== 'true') return unavailable('disabled');
  const year = new URL(context.request.url).searchParams.get('year') || '2026';
  if (!['2026', '2027'].includes(year)) return unavailable('invalid_year');
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 55000);
  let diagnostic: Diagnostic = 'request_config_error';
  try {
    // Fixed existing Worker only. Caller cannot supply an upstream, scope or time window.
    const url = `https://stk-master-api.igor-kalsek.workers.dev/site-analytics?scope=recent-interest&year=${year}&limit=20`;
    const init: RequestInit = {
      headers: { accept: 'application/json' }, signal: controller.signal, redirect: 'manual', cache: 'no-store'
    };
    // Validate the supported request configuration before the network call.
    new Request(url, init);
    diagnostic = 'fetch_error';
    // Observe redirects without following them or exposing their Location header.
    const response = await fetch(url, init);
    if (response.status >= 300 && response.status < 400) return unavailable('upstream_redirect');
    if (!response.ok) return unavailable('upstream_status');
    let payload: unknown;
    try { payload = await response.json(); }
    catch (error) {
      if (controller.signal.aborted) return unavailable('timeout');
      return unavailable(error instanceof SyntaxError ? 'invalid_json' : 'fetch_error');
    }
    diagnostic = 'contract_rejected';
    parseInterestPreview(payload, year as InterestYear);
    return new Response(JSON.stringify(payload), { status: 200, headers });
  } catch { return unavailable(controller.signal.aborted ? 'timeout' : diagnostic); }
  finally { clearTimeout(timeout); }
}
