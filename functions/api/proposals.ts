import { stkValidateProposal } from '../../src/proposal-form/proposal-validation.js';

type Env = Record<string, string | undefined>;
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (http: number, status: string, receipt?: string) => new Response(JSON.stringify({ ok: http === 200, status, ...(receipt ? { receipt } : {}) }), { status: http, headers: { ...headers, ...(http === 429 ? { 'Retry-After': '600' } : {}) } });
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
async function hmac(secret: string, text: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
}
async function readBody(request: Request) {
  if (!request.body) return null;
  const reader = request.body.getReader(); let size = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 16_384) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { return null; }
}
async function post(url: string, body: unknown, timeout: number) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    return res.ok ? await res.json() : null;
  } finally { clearTimeout(timer); }
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const onRequest = async ({ request, env }: { request: Request; env: Env }) => {
  if (request.method !== 'POST') return reply(405, 'METHOD_NOT_ALLOWED');
  if (env.STK_PROPOSALS_ENABLED !== 'true') return reply(503, 'UNAVAILABLE');
  const url = new URL(request.url);
  const hosts = (env.STK_PROPOSALS_HOSTNAMES ?? '').split(',').map(v => v.trim()).filter(Boolean);
  const upstream = env.STK_PROPOSALS_UPSTREAM_URL ?? '';
  if (!hosts.length || hosts.some(h => !/^[a-z0-9.-]+$/.test(h)) ||
      !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,200}\/exec$/.test(upstream) ||
      (env.STK_PROPOSALS_HMAC_SECRET?.length ?? 0) < 32 || (env.STK_PROPOSALS_RATE_SECRET?.length ?? 0) < 32 || (!env.STK_TURNSTILE_SECRET_KEY || ['1x0000000000000000000000000000000AA', '2x0000000000000000000000000000000AA', '3x0000000000000000000000000000000AA'].includes(env.STK_TURNSTILE_SECRET_KEY))) return reply(503, 'UNAVAILABLE');
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || request.headers.get('Origin') !== url.origin ||
      ['cross-site', 'none'].includes(request.headers.get('Sec-Fetch-Site') ?? '')) return reply(403, 'INVALID_ORIGIN');
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) return reply(415, 'INVALID_REQUEST');
  if (Number(request.headers.get('Content-Length') ?? 0) > 16_384) return reply(413, 'INVALID_REQUEST');
  let body;
  try { body = await readBody(request); } catch { return reply(400, 'INVALID_REQUEST'); }
  if (!body || Object.keys(body).length !== 4 || !['requestId', 'lang', 'turnstileToken', 'proposal'].every(k => Object.hasOwn(body, k)) ||
      typeof body.requestId !== 'string' || !uuid.test(body.requestId) || !['sl', 'en'].includes(body.lang)) return reply(400, 'INVALID_REQUEST');
  const proposal = stkValidateProposal(body.proposal);
  if (!proposal) return reply(400, 'INVALID_REQUEST');
  if (typeof body.turnstileToken !== 'string' || !body.turnstileToken.trim() || body.turnstileToken.length > 2048) return reply(400, 'CHALLENGE_FAILED');
  // Only Cloudflare's trusted header is used; never X-Forwarded-For or a client-supplied IP.
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip || ip.length > 45 || !/^[a-fA-F0-9:.]+$/.test(ip)) return reply(503, 'UNAVAILABLE');
  try {
    const verified = await post('https://challenges.cloudflare.com/turnstile/v0/siteverify', { secret: env.STK_TURNSTILE_SECRET_KEY, response: body.turnstileToken }, 5000);
    if (!verified || ['internal-error', 'missing-input-secret', 'invalid-input-secret'].some(code => (verified['error-codes'] ?? []).includes(code))) return reply(503, 'UNAVAILABLE');
    const age = Date.now() - Date.parse(verified.challenge_ts);
    if (verified.success !== true || verified.hostname !== url.hostname || verified.action !== 'race-proposal' || !Number.isFinite(age) || age < -30_000 || age > 300_000) return reply(400, 'CHALLENGE_FAILED');
    const payload = JSON.stringify({ requestId: body.requestId, lang: body.lang, proposal, rateKey: await hmac(env.STK_PROPOSALS_RATE_SECRET!, Math.floor(Date.now() / 600_000) + '\n' + ip) });
    const timestamp = String(Math.floor(Date.now() / 1000)); const nonce = crypto.randomUUID();
    const digest = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)));
    const signature = await hmac(env.STK_PROPOSALS_HMAC_SECRET!, 'stk-proposal-v1\n' + timestamp + '\n' + nonce + '\n' + digest);
    const result = await post(upstream, { version: 1, timestamp, nonce, payload, signature }, 12_000);
    if (result?.ok === true && ['ACCEPTED', 'DUPLICATE'].includes(result.status) && typeof result.receipt === 'string' && uuid.test(result.receipt)) return reply(200, result.status, result.receipt);
    if (result?.ok === false && result.status === 'RATE_LIMITED') return reply(429, 'RATE_LIMITED');
    if (result?.ok === false && result.status === 'REQUEST_CONFLICT') return reply(409, 'REQUEST_CONFLICT');
    return reply(503, 'UNAVAILABLE');
  } catch { return reply(503, 'UNAVAILABLE'); }
};
