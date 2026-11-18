import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { selectPublicPlacePhoto } from '../src/utils-place-photo.ts';

const catalogue = JSON.parse(readFileSync(new URL('../src/data/place-photo-candidates.json', import.meta.url), 'utf8'));
const approved = {
  ...catalogue.entries[0],
  status: 'PUBLISHED', visualReview: 'APPROVED', assetPath: '/images/places/velenje.webp'
};

test('all unreviewed catalogue candidates are invisible', () => {
  for (const entry of catalogue.entries) {
    assert.equal(selectPublicPlacePhoto(entry.placeId, catalogue.entries, 'sl'), null);
  }
});

test('publishing needs visual approval, a local raster asset and clear attribution', () => {
  assert.equal(selectPublicPlacePhoto(approved.placeId, [approved], 'en')?.src, '/images/places/velenje.webp');
  assert.equal(selectPublicPlacePhoto(approved.placeId, [approved], 'sl')?.alt, approved.altSl);
  assert.equal(selectPublicPlacePhoto(approved.placeId, [{ ...approved, status: 'CANDIDATE' }], 'sl'), null);
  assert.equal(selectPublicPlacePhoto(approved.placeId, [{ ...approved, visualReview: 'PENDING' }], 'sl'), null);
  assert.equal(selectPublicPlacePhoto(approved.placeId, [{ ...approved, assetPath: 'https://example.com/pic.webp' }], 'sl'), null);
  assert.equal(selectPublicPlacePhoto(approved.placeId, [{ ...approved, assetPath: '/images/places/../../x.webp' }], 'sl'), null);
  assert.equal(selectPublicPlacePhoto(approved.placeId, [approved, approved], 'sl'), null);
  assert.equal(selectPublicPlacePhoto('Q999999', [approved], 'sl'), null);
});
