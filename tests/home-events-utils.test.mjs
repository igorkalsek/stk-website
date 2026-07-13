import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildEnglishHomepageEventDetailPath,
  getCanonicalHomepageEvent,
  getHomepageEventYear
} from '../.cache/dist-test/utils-home-events.js';

const helpers = {
  rowKey: (event) => String(event.row ?? '').trim(),
  getTitle: (event) => String(event.naziv_prireditve ?? event.title ?? '').trim(),
  getDisplayTitle: (title) => title.replace(/^\d+\.\s*/, '')
};

describe('homepage event detail helpers', () => {
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
