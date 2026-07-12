import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const analytics = read('src/lib/stkAnalytics.ts');
const savedClient = read('src/saved-races-client.ts');
const myRacesClient = read('src/my-races-client.ts');
const slFinder = read('src/pages/iskalnik-tekov.astro');
const enFinder = read('src/pages/en/find-races.astro');
const related = read('src/components/RelatedRaceCards.astro');
const slDetail = read('src/pages/tek/[year]/[slug].astro');
const enDetail = read('src/pages/en/races/[year]/[slug].astro');

describe('frontend analytics v3 contract', () => {
  it('keeps existing events and allows all new frontend event types', () => {
    for (const eventType of ['search_performed', 'no_results_search', 'external_link_clicked', 'calendar_add_clicked', 'vote_clicked', 'tekobot_clicked', 'share_clicked', 'correction_clicked', 'copy_clicked', 'race_saved', 'race_unsaved', 'event_detail_viewed', 'event_card_clicked', 'related_race_clicked', 'my_races_viewed', 'my_races_bulk_ics_exported', 'personalized_results_used']) {
      assert.match(analytics, new RegExp(`'${eventType}'`));
    }
  });

  it('serializes placement with the writer-approved allowlist', () => {
    for (const placement of ['home_featured', 'home_this_week', 'home_interest', 'finder_results', 'family_results', 'most_voted_results', 'race_detail', 'related_races', 'my_races', 'personalized_results', 'personal_calendar', 'unknown']) {
      assert.match(analytics, new RegExp(`'${placement}'`));
    }
    assert.match(analytics, /placement: normalizePlacement\(payload\.placement\)/);
  });

  it('tracks save and unsave only after an actual local state change', () => {
    assert.match(savedClient, /before === result\.saved\) return/);
    assert.match(savedClient, /event_type: result\.saved \? 'race_saved' : 'race_unsaved'/);
  });

  it('deduplicates page-load detail and my-races views without localStorage', () => {
    assert.match(analytics, /const pageLoadTrackedEvents = new Set<string>\(\)/);
    assert.match(slDetail, /event_detail_viewed/);
    assert.match(enDetail, /event_detail_viewed/);
    assert.match(myRacesClient, /my_races_viewed/);
  });

  it('assigns placements for finder cards, related races, my races, and personalized results', () => {
    assert.match(slFinder, /data-analytics-placement="finder_results"/);
    assert.match(enFinder, /data-analytics-placement="finder_results"/);
    assert.match(related, /data-analytics-placement="related_races"/);
    assert.match(myRacesClient, /data-analytics-placement="my_races"/);
    assert.match(slFinder, /placement: 'personalized_results'/);
    assert.match(enFinder, /placement: 'personalized_results'/);
  });

  it('tracks related clicks with target card identity and suppresses duplicate listener registration', () => {
    assert.match(analytics, /placement === 'related_races' \? 'related_race_clicked' : 'event_card_clicked'/);
    assert.match(analytics, /getEventContext\(link\)/);
    assert.match(analytics, /hasInitializedStkAnalyticsClickTracking/);
  });

  it('tracks bulk ICS export count and omits free search text from personalized-results payloads', () => {
    assert.match(myRacesClient, /results_count: events.length/);
    assert.match(myRacesClient, /calendar_type: 'ics'/);
    assert.match(slFinder, /const \{ search, \.\.\.safePersonalizedFilters \} = filters/);
    assert.doesNotMatch(slFinder, /personalized_results_used[\s\S]{0,240}search_query/);
    assert.doesNotMatch(enFinder, /personalized_results_used[\s\S]{0,240}search_query/);
  });
});
