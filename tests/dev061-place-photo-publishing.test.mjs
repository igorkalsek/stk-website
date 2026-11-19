import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { selectPublicPlacePhoto } from '../.cache/dist-test/utils-place-photo.js';

const catalogue = JSON.parse(readFileSync(new URL('../src/data/place-photo-candidates.json', import.meta.url), 'utf8'));
const approved = {
  ...catalogue.entries[0],
  status: 'PUBLISHED', visualReview: 'APPROVED', assetPath: '/images/places/velenje.webp'
};

test('only the three owner-approved pilot photos are published', () => {
  const published = catalogue.entries.filter((entry) => entry.status === 'PUBLISHED');
  assert.deepEqual(published.map((entry) => entry.placeId).sort(), ['Q1012', 'Q1021', 'Q392333']);
  for (const entry of published) {
    assert.equal(entry.visualReview, 'APPROVED');
    assert.ok(selectPublicPlacePhoto(entry.placeId, catalogue.entries, 'sl'));
    assert.ok(selectPublicPlacePhoto(entry.placeId, catalogue.entries, 'en'));
  }
  for (const entry of catalogue.entries.filter((item) => item.status !== 'PUBLISHED')) {
    assert.equal(selectPublicPlacePhoto(entry.placeId, catalogue.entries, 'sl'), null);
    assert.equal(selectPublicPlacePhoto(entry.placeId, catalogue.entries, 'en'), null);
  }
  assert.equal(catalogue.entries.find((entry) => entry.placeId === 'Q437')?.status, 'CANDIDATE');
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

test('verified PD-self is supported, but licence markers cannot be swapped', () => {
  const candidate = catalogue.entries.find((entry) => entry.license === 'PD-self');
  assert.ok(candidate, 'expected a curated PD-self candidate');
  const publicDomain = {
    ...candidate, status: 'PUBLISHED', visualReview: 'APPROVED',
    assetPath: '/images/places/zagorje-ob-savi.webp'
  };
  assert.equal(selectPublicPlacePhoto(publicDomain.placeId, [publicDomain], 'sl')?.src, publicDomain.assetPath);
  assert.equal(selectPublicPlacePhoto(publicDomain.placeId, [{ ...publicDomain, licenseUrl: approved.licenseUrl }], 'sl'), null);
  assert.equal(selectPublicPlacePhoto(publicDomain.placeId, [{ ...publicDomain, license: 'CC-BY-4.0' }], 'sl'), null);
  assert.equal(selectPublicPlacePhoto(publicDomain.placeId, [{ ...publicDomain, license: 'unknown' }], 'sl'), null);
  assert.equal(selectPublicPlacePhoto(approved.placeId, [{ ...approved, licenseUrl: publicDomain.licenseUrl }], 'sl'), null);
});
