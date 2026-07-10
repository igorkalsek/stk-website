const UPSTREAM_INTEREST_PREVIEW_URL = 'https://script.google.com/macros/s/AKfycbzn9QzNSCE1oyKDFsm0TEFIzGSaettC6ErglCLWzlmwXiOd0wcnwsQVFJglFlnFpuNR/exec?endpoint=site-analytics&scope=interest-preview&year=2026&include_past=false&include_fallback=false&min_interest=1&limit=20';
const UPSTREAM_TIMEOUT_MS = 8000;

const jsonResponse = (payload: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(payload), {
  ...init,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=300, s-maxage=300',
    ...init.headers
  }
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const recordItems = (value: unknown) =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const textValue = (value: unknown) => {
  const text = String(value ?? '').trim();
  return text || undefined;
};

const numberValue = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const sanitizeInterestItem = (item: Record<string, unknown>) => ({
  event_id: textValue(item.event_id),
  event_name: textValue(item.event_name),
  event_date: textValue(item.event_date),
  last_event_at: textValue(item.last_event_at),
  rank: numberValue(item.rank)
});

export async function onRequestGet() {
  const upstreamAbort = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);

  try {
    const upstreamResponse = await fetch(UPSTREAM_INTEREST_PREVIEW_URL, {
      headers: {
        accept: 'application/json',
        'user-agent': 'stk-website-interest-preview/1.0'
      },
      signal: upstreamAbort
    });

    if (!upstreamResponse.ok) {
      return jsonResponse({
        ok: false,
        error: 'interest_preview_upstream_http_error',
        upstream_status: upstreamResponse.status
      }, { status: 502, headers: { 'cache-control': 'no-store' } });
    }

    const payload = await upstreamResponse.json();
    if (!isRecord(payload) || payload.ok !== true || payload.type !== 'interest_preview') {
      return jsonResponse({ ok: false, error: 'interest_preview_invalid_payload' }, { status: 502, headers: { 'cache-control': 'no-store' } });
    }

    return jsonResponse({
      ok: true,
      endpoint: payload.endpoint === 'site-analytics' ? payload.endpoint : 'site-analytics',
      type: 'interest_preview',
      filters: isRecord(payload.filters) ? payload.filters : undefined,
      items: recordItems(payload.items).map(sanitizeInterestItem)
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError'
      ? 'interest_preview_upstream_timeout'
      : 'interest_preview_unavailable';
    return jsonResponse({ ok: false, error: reason }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
