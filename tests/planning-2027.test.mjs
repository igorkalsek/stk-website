import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildPlanningOverview, fetchPlanning2027, filterPlanningEvents, formatEventPlanningDate, formatPlanningRange, parsePlanningPayload } from '../.cache/dist-test/utils-planning-2027.js';

const row = (overrides = {}) => ({ naziv_prireditve: 'Testni tek', datum: '', predvideno_od: '', predvideno_do: '', kraj: 'Kraj', regija: 'Gorenjska', tip_podlage: 'cesta/trail', status: 'pričakovano', ...overrides });
const payload = (data) => ({ ok: true, type: 'planning_2027', source: 'tekaski-koledar-master', year: '2027', generated_at: '2026-08-10', row_count: data.length, columns: ['naziv_prireditve', 'datum', 'predvideno_od', 'predvideno_do', 'kraj', 'regija', 'tip_podlage', 'status'], data });

test('maps only the documented planning API contract and statuses', () => {
  const parsed = parsePlanningPayload(payload([row(), row({ naziv_prireditve: 'Potrjen', status: 'potrjeno', datum: '2027-05-15' }), row({ status: 'other' })]));
  assert.equal(parsed?.data.length, 2);
  assert.equal(parsed?.data[0].tip_podlage, 'cesta/trail');
  assert.equal(parsePlanningPayload({ ok: true, data: [] }), null);
});

test('confirmed dates and expected ranges produce calculated weekend counts and distinct known-window status', () => {
  const events = [
    row({ naziv_prireditve: 'Potrjen', status: 'potrjeno', datum: '2027-05-15' }),
    row({ naziv_prireditve: 'Pričakovan', predvideno_od: '2027-05-15', predvideno_do: '2027-05-16' }),
    row({ naziv_prireditve: 'Znan', status: 'termin_znan', predvideno_od: '2027-05-16', predvideno_do: '2027-05-16' })
  ];
  const overview = buildPlanningOverview(events);
  assert.deepEqual({ confirmed: overview.weekends[0].confirmed, expected: overview.weekends[0].expected, total: overview.weekends[0].total }, { confirmed: 1, expected: 2, total: 3 });
  assert.equal(overview.weekends[0].events[2].status, 'termin_znan');
  assert.equal(formatEventPlanningDate(events[0], 'sl'), '15. 5. 2027');
  assert.equal(formatEventPlanningDate(events[1], 'en'), '15–16 May 2027');
});

test('a multi-week range overlaps each relevant weekend exactly once', () => {
  const event = row({ predvideno_od: '2027-05-14', predvideno_do: '2027-05-23' });
  const overview = buildPlanningOverview([event]);
  assert.deepEqual(overview.weekends.map(({ start }) => start), ['2027-05-15', '2027-05-22']);
  assert.ok(overview.weekends.every((weekend) => weekend.events.length === 1));
});

test('undated events stay out of weekends and in the separate unknown group', () => {
  const event = row(); const overview = buildPlanningOverview([event]);
  assert.equal(overview.weekends.length, 0);
  assert.deepEqual(overview.unknown, [event]);
  assert.equal(formatEventPlanningDate(event, 'sl'), 'Termin še ni znan');
  assert.equal(formatEventPlanningDate(event, 'en'), 'Date not yet known');
});

test('month, region, and complete surface values filter locally', () => {
  const may = row({ naziv_prireditve: 'Maj', predvideno_od: '2027-05-15', predvideno_do: '2027-05-15' });
  const june = row({ naziv_prireditve: 'Junij', regija: 'Savinjska', tip_podlage: 'trail', predvideno_od: '2027-06-12', predvideno_do: '2027-06-12' });
  assert.deepEqual(filterPlanningEvents([may, june], { month: '05', region: 'Gorenjska', surface: 'cesta/trail' }), [may]);
});

test('date formatters localize dates and ranges without exposing ISO values', () => {
  assert.equal(formatPlanningRange('2027-08-20', '2027-08-22', 'sl'), '20.–22. avgust 2027');
  assert.equal(formatPlanningRange('2027-08-20', '2027-08-22', 'en'), '20–22 August 2027');
});

test('planning fetch returns a safe null fallback for an unavailable or invalid API', async () => {
  assert.equal(await fetchPlanning2027(async () => { throw new Error('offline'); }), null);
  assert.equal(await fetchPlanning2027(async () => new Response('{}')), null);
});

test('pages remove demo data, provide localized labels and preserve responsive details and analytics contract', () => {
  const component = readFileSync('src/components/RaceDates2027Page.astro', 'utf8');
  const organizer = readFileSync('src/components/OrganizerPage.astro', 'utf8');
  const styles = readFileSync('src/styles/global.css', 'utf8');
  assert.doesNotMatch(component, /DEMO 0|demonstracijski podatki|static examples|Srednje zaseden|Moderately busy/);
  for (const label of ['Potrjeno', 'Pričakovano', 'Termin znan', 'Confirmed', 'Expected', 'Date window known', 'Termin še ni znan', 'Date not yet known']) assert.match(component, new RegExp(label));
  assert.match(component, /data-planning-filter/);
  assert.match(component, /data-planning-fallback/);
  assert.match(component, /<details>/);
  assert.match(styles, /@media \(max-width: 719px\)/);
  assert.match(organizer, /data-organizer-action="check_2027_dates"/);
  assert.match(organizer, /data-organizer-placement="season_preview"/);
});

test('production planning routes are included in sitemap with canonical and hreflang metadata', () => {
  const sitemap = readFileSync('src/pages/sitemap.xml.ts', 'utf8');
  const sl = readFileSync('src/pages/za-organizatorje/termini-2027.astro', 'utf8');
  const en = readFileSync('src/pages/en/for-organizers/2027-race-dates.astro', 'utf8');
  assert.match(sitemap, /\/za-organizatorje\/termini-2027\//);
  assert.match(sitemap, /\/en\/for-organizers\/2027-race-dates\//);
  for (const page of [sl, en]) { assert.match(page, /canonicalPath=/); assert.match(page, /lang: 'x-default'/); }
});
