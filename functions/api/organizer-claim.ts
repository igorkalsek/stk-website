const UPSTREAM = 'https://script.google.com/macros/s/AKfycbzn9QzNSCE1oyKDFsm0TEFIzGSaettC6ErglCLWzlmwXiOd0wcnwsQVFJglFlnFpuNR/exec?endpoint=organizer-claim';
const ALLOWED = ['year', 'event_id', 'organizer_name', 'contact_name', 'organizer_email', 'declaration', 'displayed_snapshot_hash'] as const;
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const response = (status: number, code: string, ok = false) => new Response(JSON.stringify({ ok, status: code }), { status, headers });
const MAX_BODY_BYTES = 8192;

const readBoundedBody = async (request: Request) => {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
};

export const onRequest = async ({ request, env }: { request: Request; env: Record<string, string | undefined> }) => {
  if (request.method !== 'POST') return response(405, 'METHOD_NOT_ALLOWED');
  if (env.STK_ORGANIZER_CLAIM_RELAY_ENABLED !== 'true') return response(503, 'NOT_CONFIGURED');
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return response(415, 'INVALID_REQUEST');
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return response(413, 'INVALID_REQUEST');
  const bodyBytes = await readBoundedBody(request);
  if (!bodyBytes) return response(413, 'INVALID_REQUEST');
  const bodyText = new TextDecoder().decode(bodyBytes);
  let body: Record<string, unknown>;
  try { body = JSON.parse(bodyText); } catch { return response(400, 'INVALID_REQUEST'); }
  if (!body || Array.isArray(body) || Object.keys(body).length !== ALLOWED.length || !ALLOWED.every((key) => Object.hasOwn(body, key))) return response(400, 'INVALID_REQUEST');
  if (!/^(2026|2027)$/.test(String(body.year)) || !/^R\d{6}$/.test(String(body.event_id)) || body.declaration !== true ||
      !/^[a-f0-9]{64}$/.test(String(body.displayed_snapshot_hash)) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.organizer_email)) ||
      !String(body.organizer_name).trim() || String(body.organizer_name).length > 200 || String(body.contact_name).length > 200) return response(400, 'INVALID_REQUEST');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const upstream = await fetch(UPSTREAM, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(Object.fromEntries(ALLOWED.map((key) => [key, body[key]]))), signal: controller.signal });
    let result: unknown; try { result = await upstream.json(); } catch { return response(503, 'UNAVAILABLE'); }
    const resultRecord = result && typeof result === 'object' && !Array.isArray(result) ? result as Record<string, unknown> : null;
    const successStatus = resultRecord?.ok === true ? String(resultRecord.status ?? '') : '';
    const failureCode = resultRecord?.ok === false ? String(resultRecord.code ?? '') : '';
    if (upstream.ok && successStatus === 'ACCEPTED') return response(200, 'ACCEPTED', true);
    if (failureCode === 'SNAPSHOT_CHANGED') return response(409, 'SNAPSHOT_CHANGED');
    if (['INVALID_REQUEST', 'EVENT_NOT_FOUND'].includes(failureCode)) return response(400, failureCode);
    return response(503, 'UNAVAILABLE');
  } catch { return response(503, 'UNAVAILABLE'); } finally { clearTimeout(timeout); }
};
