import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { selectHomepageSpotlightRace } from '../.cache/dist-test/utils-home-events.js';

const day = (date) => Date.parse(date + 'T00:00:00');
const race = (row, date, year = date.slice(0, 4), extra = {}) => ({
  row: String(row), id: String(row), year, date, dateValue: day(date),
  title: 'Race ' + row, naziv_prireditve: 'Race ' + row,
  displayTitle: 'Race ' + row, place: 'Slovenija', surface: 'trail', ...extra
});

test('editorial hero race uses 14–56 day window and excludes the nearest four', () => {
  const now = '2026-11-03';
  const closest = [race(1, '2026-11-04'), race(2, '2026-11-05'), race(3, '2026-11-06'), race(4, '2026-11-07')];
  const eligible = race(5, '2026-12-03');
  const events = [...closest, race(6, '2026-11-10'), eligible, race(7, '2027-02-10')];
  assert.equal(selectHomepageSpotlightRace(events, closest, now)?.row, '5');
  assert.equal(selectHomepageSpotlightRace(closest, closest, now), null);
});

test('editorial rotation is deterministic for a week and independent of candidate input order', () => {
  const a = race(5, '2026-12-03');
  const b = race(6, '2026-12-04');
  const c = race(7, '2026-12-05');
  const all = [a, b, c];
  const left = selectHomepageSpotlightRace(all, [], '2026-11-03');
  const right = selectHomepageSpotlightRace([...all].reverse(), [], '2026-11-06');
  assert.equal(left?.row, right?.row);
  assert.ok(all.some((event) => event.row === left?.row));
});

test('selection supports cross-year races without assuming 2026 ends the season', () => {
  const upcoming = [race(1, '2026-12-21'), race(5, '2027-01-20', '2027')];
  assert.equal(selectHomepageSpotlightRace(upcoming, upcoming.slice(0, 1), '2026-12-20')?.year, '2027');
});

test('invalid date and empty candidates yield no hero placement', () => {
  assert.equal(selectHomepageSpotlightRace([race(1, '2026-12-10')], [], 'bad'), null);
  assert.equal(selectHomepageSpotlightRace([race(1, '2026-11-04')], [], '2026-11-03'), null);
});

test('SL/EN hero share one editorial component and no paid or sponsored state', () => {
  const sl = readFileSync('src/pages/index.astro', 'utf8');
  const en = readFileSync('src/pages/en/index.astro', 'utf8');
  const component = readFileSync('src/components/HomeSpotlightRace.astro', 'utf8');
  const css = readFileSync('src/styles/global.css', 'utf8');
  for (const [lang, source] of [['sl', sl], ['en', en]]) {
    assert.match(source, /selectHomepageSpotlightRace\(/);
    assert.ok(source.includes('<HomeSpotlightRace lang="' + lang + '" initialRace={initialSpotlightRace} />'));
    assert.ok(source.indexOf('HomeSpotlightRace') < source.indexOf('home-stats-strip'));
  }
  assert.match(component, /STK EDITORIAL PICK/);
  assert.match(component, /UREDNIŠKI IZBOR STK/);
  assert.match(component, /data-analytics-placement="home_featured"/);
  assert.match(component, /data-analytics-featured-impression="true"/);
  assert.match(component, /initializeFeaturedRaceImpressionTracking/);
  assert.match(component, /buildEnglishEventDetailPath/);
  assert.match(component, /buildEventDetailPath/);
  assert.match(component, /Promise\.allSettled\(SUPPORTED_PUBLIC_YEARS/);
  assert.doesNotMatch(component, /SPONZORIRANO|Sponsored|Sponzorirano|mailto:/);
  assert.match(css, /@media \(min-width: 960px\)/);
  assert.match(css, /\.home-spotlight-card\[hidden\]/);
});
