// Read-only. Public event data always comes from the existing Worker API.
import { readFileSync, writeFileSync } from 'node:fs';
import { NEARBY_EDITION_LOCATIONS } from '../.cache/nearby-audit/finder/nearby-production-index.js';
import { NEARBY_PLACES, NEARBY_EDITION_BINDINGS } from '../.cache/nearby-audit/data/nearby-geography.js';
import { summarizeNearbyCoverage } from '../.cache/nearby-audit/utils-nearby-races.js';
import { mapPublicRaceEvent, toApiRecords } from '../.cache/nearby-audit/utils-event-detail.js';
import { getTodayIsoInLjubljana } from '../.cache/nearby-audit/utils-date.js';

const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const snapshot = option('--snapshot');
const today = option('--today') || getTodayIsoInLjubljana();
const sources = ['2026', '2027'].map(year => ({ year, url: `https://stk-master-api.igor-kalsek.workers.dev/${year === '2027' ? '?year=2027' : ''}` }));
const events = snapshot ? JSON.parse(readFileSync(snapshot, 'utf8')).events.filter(e => e.date >= today) :
  (await Promise.all(sources.map(async ({year, url}) => {
    const response = await fetch(url, {signal: AbortSignal.timeout(30_000)});
    if (!response.ok) throw Error(`Worker ${year}: ${response.status}`);
    const payload = await response.json();
    if (payload.ok !== true || payload.sheet !== year || !Array.isArray(payload.data) || !payload.data.length) throw Error(`Invalid or empty Worker response for ${year}`);
    return toApiRecords(payload).map(row => mapPublicRaceEvent(row, year)).filter(e => e && e.date >= today);
  }))).flat();
if (!NEARBY_EDITION_LOCATIONS.length || !events.length) throw Error('Empty index or event population; cannot certify coverage.');
const summary = subset => summarizeNearbyCoverage(subset, NEARBY_EDITION_LOCATIONS);
const by = field => Object.fromEntries([...new Set(events.map(e => e[field]))].sort().map(key => [key, summary(events.filter(e => e[field] === key))]));
const bindings = new Map(NEARBY_EDITION_BINDINGS.map(b => [`${b.year}!${b.masterRow}`, b]));
const report = {
  checkedOn: today, source: snapshot || sources, catalogPlaces: NEARBY_PLACES.length,
  total: summary(events), byYear: by('year'), byRegion: by('region'),
  missing: events.filter(e => summary([e]).locatedEditions === 0).map(e => ({
    key: `${e.year}!${e.row}`, date: e.date, title: e.naziv_prireditve, place: e.place, region: e.region,
    reason: bindings.has(`${e.year}!${e.row}`) ? 'Identity changed: review date/name/place/region before rebinding.' : 'No reviewed edition binding.',
    // A known place needs a new identity binding, never coordinates entered again.
    knownPlaceCandidates: [...new Set(NEARBY_EDITION_BINDINGS.filter(b => b.expectedPlace === e.place && b.expectedRegion === e.region).map(b => b.placeId))]
  }))
};
const output = option('--output');
if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
