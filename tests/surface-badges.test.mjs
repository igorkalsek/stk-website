import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { formatEnglishSurface } from '../.cache/dist-test/utils-english.js';
import { formatSloveneSurface } from '../.cache/dist-test/utils-slovenian.js';
import { canonicalSurfaceLabels, canonicalSurfaceValues } from '../.cache/dist-test/utils-surface-labels.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const assertAnalyticsContract = (source) => {
  assert.match(source, /data-analytics-placement=/);
  for (const attribute of ['event-id', 'event-name', 'event-date', 'event-year']) {
    assert.match(source, new RegExp(`data-analytics-${attribute}=`));
  }
};

test('canonical and fallback surface labels remain localized', () => {
  const expectedSl = ['Cesta', 'Asfalt', 'Makadam', 'Trail', 'Cesta/trail', 'Gorski tek'];
  const expectedEn = ['Road', 'Asphalt', 'Gravel road', 'Trail', 'Road/trail', 'Mountain race'];
  assert.deepEqual(canonicalSurfaceValues.map((value) => canonicalSurfaceLabels.sl[value]), expectedSl);
  assert.deepEqual(canonicalSurfaceValues.map(formatSloveneSurface), expectedSl);
  assert.deepEqual(canonicalSurfaceValues.map((value) => canonicalSurfaceLabels.en[value]), expectedEn);
  assert.deepEqual(canonicalSurfaceValues.map(formatEnglishSurface), expectedEn);
  assert.equal(formatSloveneSurface('oviratlon'), 'Oviratlon');
  assert.equal(formatEnglishSurface('oviratlon'), 'Obstacle run');
  assert.equal(formatEnglishSurface('nova podlaga'), 'Nova podlaga');
});

test('static and refreshed homepage cards omit surface metadata and keep matching hierarchy', () => {
  const component = read('src/components/HomeUpcomingRaces.astro');
  assert.doesNotMatch(component, /event\.surface|surface-badge|event-card-summary/);
  assert.match(component, /\$\{summary \? `<p>\$\{escapeHtml\(summary\)\}<\/p>` : ''\}/);
  assertAnalyticsContract(component);

  for (const path of ['src/pages/index.astro', 'src/pages/en/index.astro']) {
    const source = read(path);
    const refresh = source.slice(source.indexOf('async function loadNearestEvents()'), source.indexOf('async function loadStats()'));
    assert.doesNotMatch(refresh, /tip_podlage|surface-badge|event-card-summary/);
    assert.match(refresh, /\$\{summary \? `<p>\$\{escapeHtml\(summary\)\}<\/p>` : ''\}/);
    assertAnalyticsContract(refresh);
  }
});

test('finder renders surface as an ordinary optional delimited metadata item', () => {
  const source = read('src/finder/race-finder-controller.ts');
  assert.match(source, /formattedSurface && `<span>\$\{escapeHtml\(formattedSurface\)\}<\/span>`/);
  assert.match(source, /\[\s*formattedSurface[\s\S]*?event\.distances[\s\S]*?event\.startTime[\s\S]*?\]\.filter\(Boolean\)\.join\(''\)/);
  assert.match(source, /\$\{metaItems \? `<div class="search-event-facts">\$\{metaItems\}<\/div>` : ''\}/);
  assert.doesNotMatch(source, /surface-badge|surfaceBadge|search-event-fact-text/);
  const styles = read('src/styles/global.css');
  const factsStyles = styles.slice(styles.indexOf('.search-event-facts {'), styles.indexOf('.search-event-primary-actions'));
  assert.match(factsStyles, /color: var\(--muted\)/);
  assert.match(factsStyles, /span:not\(:last-child\)::after[\s\S]*?content: "·"/);
  assert.doesNotMatch(factsStyles, /border|border-radius|background/);
  assertAnalyticsContract(source);
});
