const UPSTREAM_INTEREST_PREVIEW_URL = 'https://script.google.com/macros/s/AKfycbwjCQ14kRPm0Iu3goO7aiX50j_JWbw5g_E25O7JV1I/exec?endpoint=site-analytics&scope=interest-preview&limit=5';

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
  try {
    const upstreamResponse = await fetch(UPSTREAM_INTEREST_PREVIEW_URL, {
      headers: { accept: 'application/json' }
    });

    if (!upstreamResponse.ok) {
      return jsonResponse({ ok: false, error: 'interest_preview_upstream_failed' }, { status: 502, headers: { 'cache-control': 'no-store' } });
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
    return jsonResponse({ ok: false, error: 'interest_preview_unavailable' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
