import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getSurfaceBadgeClass, getSurfaceBadgeTone } from '../.cache/dist-test/utils-surface-badge.js';
import { formatEnglishSurface } from '../.cache/dist-test/utils-english.js';
import { formatSloveneSurface } from '../.cache/dist-test/utils-slovenian.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('surface values map to stable visual tones', () => {
  for (const [value, expected] of [
    ['cesta', 'road'], ['ROAD', 'road'], ['asfalt', 'road'], ['trail', 'trail'],
    ['gorski', 'mountain'], ['Mountain', 'mountain'], ['vzpon', 'mountain'],
    ['mešano', 'mixed'], ['mesano', 'mixed'], ['mixed', 'mixed'], ['cesta/trail', 'mixed'],
    ['oviratlon', 'other'], ['nekaj novega', 'other'], ['', null], ['   ', null]
  ]) assert.equal(getSurfaceBadgeTone(value), expected, value);
  assert.equal(getSurfaceBadgeClass('trail'), 'surface-badge surface-badge--trail');
  assert.equal(getSurfaceBadgeClass(''), '');
});

test('surface labels remain localized and retain unknown source text', () => {
  assert.equal(formatSloveneSurface('CESTA'), 'Cesta');
  assert.equal(formatSloveneSurface('oviratlon'), 'Oviratlon');
  assert.equal(formatEnglishSurface('cesta'), 'Road');
  assert.equal(formatEnglishSurface('gorski'), 'Mountain');
  assert.equal(formatEnglishSurface('oviratlon'), 'Obstacle run');
  assert.equal(formatEnglishSurface('nova podlaga'), 'Nova podlaga');
});

test('static and refreshed homepage cards share surface badge structure', () => {
  const component = read('src/components/HomeUpcomingRaces.astro');
  assert.match(component, /renderSurfaceBadgeHtml\(event\.surface, surfaceLabel, escapeHtml\)/);
  assert.match(component, /renderSurfaceSummaryHtml\(summary, surfaceBadge, escapeHtml\)/);
  for (const path of ['src/pages/index.astro', 'src/pages/en/index.astro']) {
    const source = read(path);
    const refresh = source.slice(source.indexOf('async function loadNearestEvents()'), source.indexOf('async function loadStats()'));
    assert.match(refresh, /getEventField\(event, 'tip_podlage', \['surface'\]\)/);
    assert.match(refresh, /getSurfaceBadgeClass\(surface\)/);
    assert.match(refresh, /event-card-summary/);
    assert.match(refresh, /data-analytics-placement="home_this_week"/);
    for (const attribute of ['event-id', 'event-name', 'event-date', 'event-year']) {
      assert.match(refresh, new RegExp(`data-analytics-${attribute}=`));
    }
  }
});

test('finder renders the badge separately before delimited facts and preserves analytics', () => {
  const source = read('src/finder/race-finder-controller.ts');
  assert.match(source, /getSurfaceBadgeClass\(event\.surface\)/);
  assert.match(source, /\$\{surfaceBadge\}\$\{metaItems/);
  assert.match(source, /data-analytics-placement="finder_results"/);
  for (const attribute of ['event-id', 'event-name', 'event-date', 'event-year']) {
    assert.match(source, new RegExp(`data-analytics-${attribute}=`));
  }
});
