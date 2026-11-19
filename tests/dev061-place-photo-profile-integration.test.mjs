import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('both language profiles resolve edition identity and render only approved photos', () => {
  const cases = [
    ['../src/pages/tek/[year]/[slug].astro', 'sl'],
    ['../src/pages/en/races/[year]/[slug].astro', 'en']
  ];
  for (const [path, lang] of cases) {
    const source = read(path);
    assert.match(source, /resolveNearbyEditionLocation\(event, NEARBY_EDITION_LOCATIONS\)/);
    assert.match(source, /NEARBY_EDITION_BINDINGS\.find/);
    assert.match(source, /binding\.expectedDate === event\.date/);
    assert.match(source, /binding\.expectedTitle === event\.title/);
    assert.match(source, /binding\.expectedPlace === event\.place/);
    assert.match(source, /binding\.expectedRegion === event\.region/);
    assert.match(source, new RegExp(`selectPublicPlacePhoto\\(photoBinding\\?\\.placeId, placePhotoCatalogue\\.entries, '${lang}'\\)`));
    assert.match(source, new RegExp(`<PlacePhoto photo=\\{placePhoto\\} lang="${lang}"`));
    assert.ok(source.indexOf('<PlacePhoto') > source.indexOf('event-detail-primary-actions'), 'photo must follow event actions');
  }
});

test('photo component is lazy, responsive, attributed, and has no decorative fallback', () => {
  const source = read('../src/components/PlacePhoto.astro');
  assert.match(source, /\{photo && \(/);
  assert.match(source, /loading="lazy"/);
  assert.match(source, /object-fit: cover/);
  assert.match(source, /max-width: 640px/);
  assert.match(source, /photo\.source/);
  assert.match(source, /photo\.licenseUrl/);
  assert.match(source, /photo\.alt/);
  assert.match(source, /Izrez za prikaz/);
  assert.match(source, /Cropped for display/);
  assert.match(source, /\{cropLabel\}/);
});
