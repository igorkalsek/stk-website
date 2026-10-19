// Executable B0 specification only. Never imported by src/, functions/ or a writer.
import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
const root = new URL('../../../docs/contracts/race-watch/v1/', import.meta.url);
const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
ajv.addFormat('date', validDate);
ajv.addFormat('date-time', value => /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.test(value) && validDate(value.slice(0, 10)));
ajv.addFormat('uri', value => { try { const u = new URL(value); return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password; } catch { return false; } });
for (const name of ['common', 'edition-identity', 'verified-change', 'race-watch-response']) {
  const schema = JSON.parse(readFileSync(new URL(`${name}.schema.json`, root)));
  if (!ajv.validateSchema(schema)) throw new Error(JSON.stringify(ajv.errors));
  ajv.addSchema(schema);
}
export const validateSchema = (kind, value) => {
  const validate = ajv.getSchema(`urn:stk:race-watch:v1:${kind}`);
  return validate(value) ? [] : validate.errors.map(error => ({ code: 'SCHEMA', detail: `${error.instancePath} ${error.message}` }));
};
const t = value => Date.parse(value);
const stable = value => JSON.stringify(value, Object.keys(value).sort());
const aliasKey = a => JSON.stringify([a.namespace, a.year, a.key, a.saved_date]);
const locatorKey = l => `${l.sheet}:${l.row}`;
const bindingsOverlap = (a, b) => Math.max(t(a.valid_from), t(b.valid_from)) < Math.min(a.valid_to ? t(a.valid_to) : Infinity, b.valid_to ? t(b.valid_to) : Infinity);
const ljDate = timestamp => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Ljubljana', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp));
const civilDays = (date, today) => (t(`${date}T00:00:00Z`) - t(`${today}T00:00:00Z`)) / 86400000;
export function proofMaxAgeMs(revision, edition, now) {
  const dates = revision.change_type === 'rescheduled' ? [revision.before, revision.after].filter(Boolean) : [edition.public_snapshot.date].filter(Boolean);
  if (!dates.length) return 7 * 86400000;
  const days = Math.min(...dates.map(date => civilDays(date, ljDate(now))));
  return (days <= 7 ? 1 : days <= 30 ? 7 : 14) * 86400000;
}
export function validateContract(payload) {
  const structural = validateSchema('response', payload);
  if (structural.length) return { errors: structural, active: [], revisions: [] };
  const errors = [];
  const fail = (code, detail) => errors.push({ code, detail });
  const editions = new Map(), bindings = new Map(), aliases = new Map(), locations = new Map();
  const now = t(payload.generated_at);
  for (const e of payload.editions) {
    if (editions.has(e.edition_id)) fail('EDITION_COLLISION', e.edition_id);
    editions.set(e.edition_id, e);
    const allBindings = [...e.previous_master, ...(e.current_master ? [e.current_master] : [])];
    for (const [index, b] of allBindings.entries()) {
      if (allBindings.slice(0, index).some(prev => bindingsOverlap(prev, b))) fail('EDITION_BINDING_OVERLAP', e.edition_id);
      if (bindings.has(b.binding_id)) fail('BINDING_COLLISION', b.binding_id);
      bindings.set(b.binding_id, { edition: e, binding: b });
      if (t(b.valid_from) > now || t(b.proof.verified_at) > now || (b.valid_to && (t(b.valid_to) <= t(b.valid_from) || t(b.valid_to) > now))) fail('BINDING_TIME', b.binding_id);
      if (e.previous_master.includes(b) && b.valid_to === null || b === e.current_master && b.valid_to !== null) fail('BINDING_TIME', b.binding_id);
      const key = locatorKey(b.locator), prior = locations.get(key) ?? [];
      for (const prev of prior) {
        if (bindingsOverlap(prev, b) || prev.locator.generation === b.locator.generation) fail('LOCATOR_COLLISION', key);
        const earlier = t(prev.valid_from) < t(b.valid_from) ? prev : b;
        const later = earlier === b ? prev : b;
        if (earlier.locator.generation >= later.locator.generation) fail('LOCATOR_GENERATION', key);
      }
      locations.set(key, [...prior, b]);
    }
    for (const a of e.aliases) {
      const b = allBindings.find(item => item.binding_id === a.binding_id);
      if (!b || b.locator.sheet !== a.year) { fail('ALIAS_BINDING', a.key); continue; }
      const row = b.locator.row;
      const expected = { master_locator: String(row), website_event_id: `r${String(row).padStart(6, '0')}`, organizer_event_id: `R${String(row).padStart(6, '0')}` };
      if (a.namespace in expected && a.key !== expected[a.namespace] || a.namespace === 'legacy_edition_key' && !/^R\d{6}\|\d{4}-\d{2}-\d{2}$/.test(a.key)) fail('ALIAS_NAMESPACE', a.key);
      if (a.namespace === 'legacy_edition_key' && (a.key.split('|')[1] !== a.saved_date || e.race_id && a.key.split('|')[0] !== e.race_id)) fail('ALIAS_NAMESPACE', a.key);
      if (a.proof && t(a.proof.verified_at) > now) fail('ALIAS_TIME', a.key);
      const key = aliasKey(a), candidates = aliases.get(key) ?? [];
      aliases.set(key, [...candidates, { edition: e, alias: a }]);
    }
  }
  for (const [key, group] of aliases) {
    // V2 has no saved_at or generation. Disjoint binding dates do not disambiguate it.
    if (new Set(group.map(item => item.edition.edition_id)).size > 1 && group.some(item => item.alias.resolution === 'unique')) fail('ALIAS_COLLISION', key);
  }
  const revisions = new Map(), operationKeys = new Set(), sequences = new Map();
  for (const r of payload.revisions) {
    if (revisions.has(r.revision_id)) {
      if (!isDeepStrictEqual(revisions.get(r.revision_id), r)) fail('REVISION_COLLISION', r.revision_id);
      continue; // byte-equivalent object replay, ignoring object-property order, has one identity.
    }
    revisions.set(r.revision_id, r);
    const e = editions.get(r.edition_id);
    if (!e) { fail('REVISION_EDITION', r.revision_id); continue; }
    const op = JSON.stringify([r.edition_id, r.change_set_id, r.field, stable(r.scope)]);
    if (operationKeys.has(op)) fail('DUPLICATE_OPERATION', r.revision_id);
    operationKeys.add(op);
    const seq = sequences.get(r.edition_id) ?? [];
    if (seq.length && r.sequence !== seq.at(-1) + 1) fail('SEQUENCE', r.revision_id);
    sequences.set(r.edition_id, [...seq, r.sequence]);
    if (isDeepStrictEqual(r.before, r.after)) fail('NO_CHANGE', r.revision_id);
    if (['cancelled', 'rescheduled'].includes(r.change_type) && r.scope.kind !== 'event') fail('SCOPE', r.revision_id);
    if (t(r.confirmed_at) > t(r.recorded_at) || t(r.recorded_at) > t(r.published_at) || t(r.published_at) > now || t(r.verified_at) < t(r.confirmed_at) || t(r.verified_at) > now || t(r.valid_until) <= t(r.verified_at) || r.source_published_at && t(r.source_published_at) > t(r.confirmed_at) || r.retracted_at && (t(r.retracted_at) < t(r.published_at) || t(r.retracted_at) > now)) fail('REVISION_TIME', r.revision_id);
    if (r.evidence_state === 'active') {
      if (e.identity_status !== 'verified' || e.aliases.some(a => a.resolution !== 'unique')) fail('IDENTITY_UNVERIFIED', r.revision_id);
      if (now >= t(r.valid_until) || now - t(r.verified_at) >= proofMaxAgeMs(r, e, payload.generated_at)) fail('PROOF_EXPIRED', r.revision_id);
      const maxAtVerification = proofMaxAgeMs(r, e, r.verified_at);
      if (t(r.valid_until) - t(r.verified_at) > maxAtVerification) fail('PROOF_TTL', r.revision_id);
      if (r.supersedes_revision_id === r.revision_id) fail('SUPERSEDES', r.revision_id);
    }
    if (r.evidence_state === 'expired' && now < t(r.valid_until) && now - t(r.verified_at) < proofMaxAgeMs(r, e, payload.generated_at)) fail('FALSE_EXPIRY', r.revision_id);
  }
  const sorted = [...revisions.values()].sort((a, b) => a.edition_id.localeCompare(b.edition_id) || a.sequence - b.sequence);
  if (!isDeepStrictEqual(sorted.map(r => r.revision_id), [...revisions.keys()])) fail('ORDER', 'edition_id, sequence');
  for (const r of revisions.values()) {
    if (r.supersedes_revision_id) {
      const target = revisions.get(r.supersedes_revision_id);
      if (!target || target.edition_id !== r.edition_id || target.field !== r.field || !isDeepStrictEqual(target.scope, r.scope) || target.sequence >= r.sequence || !['superseded', 'conflict', 'retracted'].includes(target.evidence_state)) fail('SUPERSEDES', r.revision_id);
    }
    if (r.evidence_state === 'active') {
      const e = editions.get(r.edition_id);
      if (e) {
        const value = r.field === 'status' ? e.canonical_status : e.public_snapshot[r.field];
        if (r.scope.kind === 'event' && value !== r.after) fail('SNAPSHOT', r.revision_id);
        if ([...revisions.values()].some(next => next.edition_id === r.edition_id && next.field === r.field && isDeepStrictEqual(next.scope, r.scope) && next.sequence > r.sequence)) fail('ACTIVE_HEAD', r.revision_id);
      }
    }
    if (r.evidence_state === 'superseded' && ![...revisions.values()].some(next => next.supersedes_revision_id === r.revision_id)) fail('SUPERSEDES', r.revision_id);
  }
  const c = payload.coverage, ys = c.years;
  if (!isDeepStrictEqual(payload.years, [...payload.years].sort()) || !isDeepStrictEqual(ys.map(y => y.year), payload.years)) fail('COVERAGE', 'requested years must match coverage exactly');
  const fullyAvailable = ys.length > 0 && ys.every(y => y.availability === 'available');
  const fullyComplete = ys.length > 0 && ys.every(y => y.completeness === 'complete');
  const allUnavailable = ys.every(y => y.availability === 'unavailable');
  const boundary = !ys.length || ys.some(y => y.history_complete_since === null) ? null : ys.map(y => y.history_complete_since).sort().at(-1);
  if (c.availability !== (fullyAvailable ? 'available' : allUnavailable ? 'unavailable' : 'partial') || c.completeness === 'complete' && (!fullyComplete || !fullyAvailable || c.reasons.length || payload.editions.some(e => e.identity_status !== 'verified' || e.history_complete_since === null || e.aliases.some(a => a.resolution !== 'unique'))) || c.history_complete_since !== boundary || payload.period.from !== boundary || payload.period.to !== payload.generated_at || boundary && t(boundary) > now || ys.some(y => y.history_complete_since && t(y.history_complete_since) > now) || (c.completeness !== 'complete' || c.availability !== 'available') && !c.reasons.length) fail('COVERAGE', 'inconsistent aggregate or history boundary');
  if (payload.ok === allUnavailable || payload.ok && payload.error !== null || !payload.ok && payload.error === null || !payload.ok && (c.completeness !== 'unknown' || payload.editions.length || payload.revisions.length)) fail('AVAILABILITY', 'invalid error envelope');
  for (const e of payload.editions) {
    const years = [e.edition_year, ...e.aliases.map(a => a.year), ...(e.current_master ? [e.current_master.locator.sheet] : [])];
    if (!years.some(y => payload.years.includes(y))) fail('YEAR_SELECTION', e.edition_id);
    if (e.history_complete_since && t(e.history_complete_since) > now) fail('COVERAGE', e.edition_id);
  }
  return { errors, revisions: [...revisions.values()], active: errors.length ? [] : [...revisions.values()].filter(r => r.evidence_state === 'active') };
}
// A valid old response is still history, but cannot retain an active label past expiry.
export function activeAtUse(payload, now) {
  const result = validateContract(payload);
  if (result.errors.length || !Number.isFinite(t(now)) || t(now) < t(payload.generated_at)) return [];
  const editions = new Map(payload.editions.map(e => [e.edition_id, e]));
  return result.active.filter(r => t(now) < t(r.valid_until) && t(now) - t(r.verified_at) < proofMaxAgeMs(r, editions.get(r.edition_id), now));
}
