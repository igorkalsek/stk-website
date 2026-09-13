import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { selectFeaturedUpcomingEvents, selectHomepageRecentUpdates } from '../.cache/dist-test/utils-home-events.js';

const day = (value) => Date.parse(`${value}T00:00:00Z`);

describe('homepage featured selection', () => {
  const options = {
    todayValue: day('2026-09-13'),
    cutoffValue: day('2026-09-27'),
    limit: 3,
    getDateValue: (event) => day(event.date),
    getIdentity: (event) => event.id,
    compareFallback: (a, b) => day(a.date) - day(b.date) || a.title.localeCompare(b.title)
  };

  it('keeps nearby interest rank ahead of proximity fallback', () => {
    const interest = [
      { id: 'far', date: '2026-11-07', title: 'Far ranked race' },
      { id: 'rank-2', date: '2026-09-26', title: 'Second rank' },
      { id: 'rank-3', date: '2026-09-27', title: 'Third rank' }
    ];
    const fallback = [
      { id: 'near', date: '2026-09-13', title: 'Nearest race' },
      { id: 'rank-2', date: '2026-09-26', title: 'Duplicate ranked race' }
    ];

    assert.deepEqual(
      selectFeaturedUpcomingEvents(interest, fallback, options).map(({ id }) => id),
      ['rank-2', 'rank-3', 'near']
    );
  });

  it('excludes past races, deduplicates and caps the result at three', () => {
    const interest = [
      { id: 'past', date: '2026-09-12', title: 'Past race' },
      { id: 'one', date: '2026-09-20', title: 'One' },
      { id: 'one', date: '2026-09-20', title: 'Duplicate one' }
    ];
    const fallback = [
      { id: 'two', date: '2026-09-13', title: 'Two' },
      { id: 'three', date: '2026-09-14', title: 'Three' },
      { id: 'four', date: '2026-09-15', title: 'Four' }
    ];

    assert.deepEqual(
      selectFeaturedUpcomingEvents(interest, fallback, options).map(({ id }) => id),
      ['one', 'two', 'three']
    );
  });
});

describe('homepage recent updates selection', () => {
  it('sorts categories globally by canonical recency, preserves type and deduplicates', () => {
    const selection = selectHomepageRecentUpdates({
      updatedEvents: [
        { row: '1', naziv_prireditve: 'Older update', recent_update_date: '2026-09-11' },
        { row: '2', naziv_prireditve: 'Duplicate older update', recent_update_date: '2026-09-10' }
      ],
      newEvents: [
        { row: '3', naziv_prireditve: 'Newest new race', recent_update_date: '2026-09-13' },
        { row: '2', naziv_prireditve: 'Duplicate newer new race', recent_update_date: '2026-09-12' }
      ],
      confirmedEvents: [
        { row: '4', naziv_prireditve: 'Confirmed race', recent_update_date: '2026-09-12' }
      ]
    }, 4);

    assert.equal(selection.canOrderGlobally, true);
    assert.deepEqual(selection.items.map((item) => item.row), ['3', '4', '2', '1']);
    assert.deepEqual(selection.items.map((item) => item.update_type), ['new', 'confirmed', 'new', 'updated']);
  });

  it('fails closed when canonical recency is missing', () => {
    assert.deepEqual(selectHomepageRecentUpdates({
      updatedEvents: [{ row: '1', naziv_prireditve: 'Missing recency' }],
      newEvents: [],
      confirmedEvents: []
    }), { canOrderGlobally: false, items: [] });
  });
});
