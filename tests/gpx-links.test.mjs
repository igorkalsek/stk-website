import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { GPX_LINKS } from '../.cache/dist-test/data/gpx-links.js';
import { getGpxLinks, gpxYearLabel } from '../.cache/dist-test/utils-gpx.js';

const eventFor = ({ edition: e }) => ({ year: e.year, row: e.row, date: e.date, naziv_prireditve: e.name, place: e.place });
const evidence = JSON.parse(readFileSync(new URL('../docs/dev048-gpx/p1/recheck.json', import.meta.url)));

test('all public links have a separate P1 selection, unchanged validated file and public edition evidence', () => {
  assert.equal(GPX_LINKS.length, 13);
  assert.equal(GPX_LINKS.flatMap(e => e.links).length, 31);
  for (const group of GPX_LINKS) {
    assert.ok(evidence.bindings.some(b => JSON.stringify(b.edition) === JSON.stringify(group.edition)));
    assert.deepEqual(getGpxLinks(eventFor(group)), group.links.map(link => ({ ...link, url: new URL(link.url).href, sourceUrl: new URL(link.sourceUrl).href })));
    for (const link of group.links) {
      const proof = evidence.entries.find(e => e.target_url === link.url && e.publication_decision === 'SELECTED_EXTERNAL_ARCHIVE_LINK');
      assert.ok(proof, link.url);
      assert.equal(proof.source.status, 200);
      assert.equal(proof.target.status, 200);
      assert.equal(proof.source_links_target, true);
      assert.equal(proof.hash_matches_p0f, true);
      assert.equal(link.year, proof.research_gpx_file_year);
      assert.ok(proof.members.length && proof.members.every(m => m.valid && m.points > 1));
      assert.equal(link.kind, proof.target_url.endsWith('.zip') ? 'ZIP' : 'GPX');
      assert.doesNotMatch(link.url, /drive\.google|docs\.google|kocevsko-outdoor/i);
    }
  }
});

test('exact year, row and full fingerprint required; no cross-year, family, renamed or moved row fallback', () => {
  for (const group of GPX_LINKS) {
    const event = eventFor(group);
    for (const [field, value] of Object.entries({ year: '2028', row: '999999', date: '2027-01-01', naziv_prireditve: `${event.naziv_prireditve} II`, place: `${event.place} II` })) {
      assert.deepEqual(getGpxLinks({ ...event, [field]: value }), [], `${group.edition.name}: ${field}`);
    }
    assert.deepEqual(getGpxLinks({ ...event, year: event.year === '2026' ? '2027' : '2026' }), []);
  }
  assert.deepEqual(getGpxLinks({ year: '2027', row: '17', date: '2027-05-28', naziv_prireditve: 'Kočevsko Outdoor Festival 2027', place: 'Kočevje' }), []);
});

test('year labels distinguish older, same, newer and unknown tracks in both languages', () => {
  const cases = [
    [2025, 'Arhivska GPX-sled 2025', 'Archived GPX track 2025'],
    [2027, 'GPX-sled z oznako 2027', 'GPX track labelled 2027'],
    [2028, 'GPX-sled z oznako 2028', 'GPX track labelled 2028'],
    [null, 'GPX-sled · letnica ni potrjena', 'GPX track · year unconfirmed']
  ];
  for (const [year, sl, en] of cases) {
    assert.equal(gpxYearLabel(year, '2027', 'sl'), sl);
    assert.equal(gpxYearLabel(year, '2027', 'en'), en);
  }
});

test('shared ZIP and repeated versions yield one button with distinct course names and conservative year', () => {
  const group = GPX_LINKS[0];
  const base = { ...group.links[0], kind: 'ZIP', url: 'https://example.org/tracks.zip' };
  const manifest = [{ ...group, links: [base, { ...base, route: 'Other course', year: null }, base] }];
  const links = getGpxLinks(eventFor(group), manifest);
  assert.equal(links.length, 1);
  assert.equal(links[0].route, `${base.route} / Other course`);
  assert.equal(links[0].year, null);
});

test('invalid target and provenance URLs fail closed', () => {
  const group = GPX_LINKS[0];
  for (const bad of ['javascript:alert(1)', 'data:text/html,hi', '//example.org/file.gpx', '/local.gpx', 'https://%', 'file:///tmp/course.gpx']) {
    for (const field of ['url', 'sourceUrl']) {
      assert.deepEqual(getGpxLinks(eventFor(group), [{ ...group, links: [{ ...group.links[0], [field]: bad }] }]), []);
    }
  }
});
