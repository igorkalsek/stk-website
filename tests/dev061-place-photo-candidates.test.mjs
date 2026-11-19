import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const catalogue = JSON.parse(read('../src/data/place-photo-candidates.json'));
const licenseTerms = {
  'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC-BY-SA-4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'CC-BY-SA-3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC0-1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'PD-self': 'https://commons.wikimedia.org/wiki/Template:PD-self'
};

function validatePublicationState(entry) {
  assert.ok(['CANDIDATE', 'PUBLISHED'].includes(entry.status), `invalid status for ${entry.place}`);
  assert.ok(['PENDING', 'APPROVED'].includes(entry.visualReview), `invalid review for ${entry.place}`);
  if (entry.status === 'PUBLISHED') {
    assert.equal(entry.visualReview, 'APPROVED', `${entry.place} was published without visual approval`);
    assert.notEqual(entry.assetPath, null, `${entry.place} was published without a local image`);
    assert.equal(entry.licenseUrl, licenseTerms[entry.license], `${entry.place} has mismatched licence terms`);
  }
  if (entry.assetPath === null) return;

  assert.match(entry.assetPath, /^\/images\/places\/[a-z0-9-]+\.(?:webp|avif)$/, `unsafe asset path for ${entry.place}`);
  const bytes = readFileSync(new URL(`../public${entry.assetPath}`, import.meta.url));
  assert.ok(bytes.length > 32 && bytes.length <= 512 * 1024, `${entry.place} image must be nonempty and at most 512 KiB`);
  const header = bytes.toString('ascii', 0, Math.min(bytes.length, 32));
  const isWebp = entry.assetPath.endsWith('.webp') && header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP';
  const isAvif = entry.assetPath.endsWith('.avif') && header.slice(4, 8) === 'ftyp' && /avif|avis/.test(header.slice(8));
  assert.ok(isWebp || isAvif, `${entry.place} image does not match its WebP/AVIF extension`);
}

test('DEV-061 catalogue has 10–15 unique, fully attributed place records', () => {
  assert.equal(catalogue.schemaVersion, 1);
  assert.match(catalogue.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(catalogue.entries.length >= 10 && catalogue.entries.length <= 15);
  const ids = new Set();
  for (const entry of catalogue.entries) {
    assert.match(entry.placeId, /^Q\d+$/);
    assert.equal(ids.has(entry.placeId), false, `duplicate place ID ${entry.placeId}`);
    ids.add(entry.placeId);
    assert.ok(entry.place && entry.file && entry.author);
    assert.equal(new URL(entry.source).host, 'commons.wikimedia.org');
    assert.equal(new URL(entry.source).pathname.startsWith('/wiki/File:'), true);
    assert.ok(Object.hasOwn(licenseTerms, entry.license));
    assert.equal(entry.licenseUrl, licenseTerms[entry.license], `incorrect licence link for ${entry.place}`);
    assert.ok(entry.altSl && entry.altEn);
    validatePublicationState(entry);
  }
});

test('DEV-061 future publication fails closed without review or a valid local asset', () => {
  const entry = catalogue.entries[0];
  assert.throws(() => validatePublicationState({ ...entry, status: 'PUBLISHED' }));
  assert.throws(() => validatePublicationState({ ...entry, status: 'PUBLISHED', visualReview: 'APPROVED' }));
  assert.throws(() => validatePublicationState({ ...entry, status: 'PUBLISHED', visualReview: 'APPROVED', assetPath: '/images/places/missing.webp' }));
  assert.throws(() => validatePublicationState({ ...entry, status: 'PUBLISHED', visualReview: 'APPROVED', assetPath: 'https://example.com/pic.webp' }));
});

test('DEV-061 photo place IDs exist in the verified geographic place catalogue', () => {
  const text = read('../src/data/nearby-geography.ts');
  const placeSection = text.split('export const NEARBY_EDITION_BINDINGS')[0];
  const known = new Set([...placeSection.matchAll(/"id":\s*"(Q\d+)"/g)].map((match) => match[1]));
  for (const entry of catalogue.entries) {
    assert.ok(known.has(entry.placeId), `unknown verified place ${entry.placeId}: ${entry.place}`);
  }
});
