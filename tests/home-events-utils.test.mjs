import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildEnglishHomepageEventDetailPath,
  buildHomepageEventDetailPath,
  buildHomepageMasterEventIndex,
  matchRecentUpdateToMasterEvent,
  getCanonicalHomepageEvent,
  getHomepageEventYear,
  selectUpcomingHomepageEvents
} from '../.cache/dist-test/utils-home-events.js';

const helpers = {
  rowKey: (event) => String(event.row ?? '').trim(),
  getTitle: (event) => String(event.naziv_prireditve ?? event.title ?? '').trim(),
  getDisplayTitle: (title) => title.replace(/^\d+\.\s*/, '')
};

describe('homepage event detail helpers', () => {
  it('selects at most four nearest races using the client date, place and title order', () => {
    const event = (row, date, place, title) => ({ row, date, place, title, dateValue: Date.parse(`${date}T00:00:00`) });
    const selected = selectUpcomingHomepageEvents([
      event('5', '2026-09-02', 'Bled', 'Fifth'),
      event('4', '2026-09-01', 'Celje', 'Fourth'),
      event('3', '2026-09-01', 'Bled', 'Zulu'),
      event('2', '2026-09-01', 'Bled', 'Alpha'),
      event('1', '2026-08-31', 'Ptuj', 'First')
    ]);

    assert.deepEqual(selected.map(({ row }) => row), ['1', '2', '3', '4']);
  });

  it('detects supported event years from dates and explicit fields only', () => {
    assert.equal(getHomepageEventYear({ datum: '2026-05-16' }), '2026');
    assert.equal(getHomepageEventYear({ year: '2027', datum: '2026-05-16' }), '2027');
    assert.equal(getHomepageEventYear({ leto: '2027' }), '2027');
    assert.equal(getHomepageEventYear({ year: '2028', datum: '2028-05-16' }), '');
    assert.equal(getHomepageEventYear({ naziv_prireditve: 'Missing date' }), '');
  });

  it('builds English detail paths from master events', () => {
    const path = buildEnglishHomepageEventDetailPath({
      row: '17',
      datum: '2026-04-12',
      naziv_prireditve: '12. Testni tek',
      kraj: 'Ljubljana'
    }, helpers);

    assert.equal(path, '/en/races/2026/r000017-testni-tek/');
  });

  it('uses a canonical master event when an interest or top row was enriched', () => {
    const interestEvent = {
      row: '',
      datum: '2026-01-01',
      naziv_prireditve: 'Interest shell',
      __canonical_master_event: {
        row: '25',
        datum: '2027-09-20',
        naziv_prireditve: 'Master Trail',
        kraj: 'Bled'
      }
    };

    assert.equal(getCanonicalHomepageEvent(interestEvent).row, '25');
    assert.equal(
      buildEnglishHomepageEventDetailPath(interestEvent, helpers),
      '/en/races/2027/r000025-master-trail/'
    );
  });
});


describe('recent update matching helpers', () => {
  const masterEvents = [
    { row: '175', datum: '2026-05-16', naziv_prireditve: '12. Testni tek', kraj: 'Ljubljana' },
    { row: '176', datum: '2026-06-01', naziv_prireditve: 'Gorski tek', kraj: 'Bled' },
    { row: '177', datum: '2026-06-01', naziv_prireditve: 'Gorski tek', kraj: 'Bled' }
  ];

  it('matches recent updates by row', () => {
    const match = matchRecentUpdateToMasterEvent({ row: '175' }, buildHomepageMasterEventIndex(masterEvents));
    assert.equal(match.reason, 'row');
    assert.equal(match.event?.row, '175');
  });

  it('matches recent updates by master_row', () => {
    const match = matchRecentUpdateToMasterEvent({ master_row: '176' }, buildHomepageMasterEventIndex(masterEvents));
    assert.equal(match.reason, 'row');
    assert.equal(match.event?.row, '176');
  });

  it('matches recent updates by stable event ID', () => {
    const match = matchRecentUpdateToMasterEvent({ event_id: 'r000175' }, buildHomepageMasterEventIndex(masterEvents));
    assert.equal(match.reason, 'event_id');
    assert.equal(match.event?.row, '175');
  });

  it('matches recent updates by exact date, title and place', () => {
    const match = matchRecentUpdateToMasterEvent({ datum: '2026-05-16', naziv_prireditve: '12. Testni tek', kraj: 'Ljubljana' }, buildHomepageMasterEventIndex(masterEvents));
    assert.equal(match.reason, 'date_title_place');
    assert.equal(match.event?.row, '175');
  });

  it('does not link ambiguous date, title and place matches', () => {
    const match = matchRecentUpdateToMasterEvent({ datum: '2026-06-01', naziv_prireditve: 'Gorski tek', kraj: 'Bled' }, buildHomepageMasterEventIndex(masterEvents));
    assert.equal(match.event, null);
  });

  it('does not link missing identity updates', () => {
    const match = matchRecentUpdateToMasterEvent({ naziv_prireditve: 'Brez datuma' }, buildHomepageMasterEventIndex(masterEvents));
    assert.equal(match.event, null);
    assert.equal(match.reason, 'missing_identity');
  });

  it('builds Slovenian and English detail paths from canonical master events', () => {
    const event = { row: '175', datum: '2026-05-16', naziv_prireditve: '12. Testni tek', kraj: 'Ljubljana' };
    assert.equal(buildHomepageEventDetailPath(event, helpers), '/tek/2026/r000175-testni-tek/');
    assert.equal(buildEnglishHomepageEventDetailPath(event, helpers), '/en/races/2026/r000175-testni-tek/');
  });
});
