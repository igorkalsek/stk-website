import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const catalogue = JSON.parse(read('../src/data/place-photo-candidates.json'));

test('DEV-061 catalogue has 10–15 unique, fully attributed candidates', () => {
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
    assert.ok(['CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-SA-3.0', 'CC0-1.0', 'PD-self'].includes(entry.license));
    assert.equal(new URL(entry.licenseUrl).protocol, 'https:');
    assert.ok(entry.altSl && entry.altEn);
    assert.equal(entry.status, 'CANDIDATE');
    assert.equal(entry.visualReview, 'PENDING');
    assert.equal(entry.assetPath, null);
  }
});

test('DEV-061 photo place IDs exist in the verified geographic place catalogue', () => {
  const text = read('../src/data/nearby-geography.ts');
  const placeSection = text.split('export const NEARBY_EDITION_BINDINGS')[0];
  const known = new Set([...placeSection.matchAll(/"id":\s*"(Q\d+)"/g)].map((match) => match[1]));
  for (const entry of catalogue.entries) {
    assert.ok(known.has(entry.placeId), `unknown verified place ${entry.placeId}: ${entry.place}`);
  }
});
