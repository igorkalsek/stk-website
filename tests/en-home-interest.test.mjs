import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('../src/pages/en/index.astro', import.meta.url), 'utf8');

describe('English home interest section', () => {
  it('uses interest-preview copy and keeps only View all races in the section header', () => {
    assert.match(source, /<h2 id="voted-title">Races attracting the most interest<\/h2>/);
    assert.match(source, /<p data-top-description>Upcoming races attracting the most visitor interest in registration, official information, calendar and route links\.<\/p>/);
    assert.match(source, /href="\/en\/find-races\/">View all races<\/a>/);
    assert.doesNotMatch(source, /Most voted upcoming races/);
    assert.doesNotMatch(source, /View full ranking/);
    assert.doesNotMatch(source, /Vote for your race/);
  });

  it('loads /api/interest-preview before falling back to votes', () => {
    assert.match(source, /const INTEREST_PREVIEW_URL = '\/api\/interest-preview';/);
    assert.match(source, /fetch\(INTEREST_PREVIEW_URL/);
    assert.match(source, /getInterestPreviewRaces\(masterRows, 5\)/);
  });

  it('hides vote counts for interest cards and shows them for vote fallback cards', () => {
    assert.match(source, /const metaItems = options\.interestPreview\s*\? ''\s*:/s);
    assert.match(source, /formatVoteCount\(votes\)/);
    assert.match(source, /Upcoming races with the most runner votes\./);
    assert.match(source, /This view is based on runner votes\. If vote counts are tied, nearer upcoming races are shown first\./);
  });

  it('keeps interest analytics and links cards to English race detail pages', () => {
    assert.ok(source.includes('data-analytics-placement="home_interest"'));
    assert.ok(source.includes('data-analytics-placement=\"home_interest\"'));
    assert.match(source, /buildEnglishEventDetailPath/);
    assert.ok(source.includes('<h3><a href="${escapeHtml(eventDetailPath(event))}">'));
  });
});

describe('English home hero preview', () => {
  it('uses interest events plus nearest fallback events and hides interest vote counts', () => {
    assert.match(source, /const interestPreviewEvents = await getInterestPreviewRaces\(events, 20\)\.catch\(\(\) => \[\]\);/);
    assert.match(source, /renderHeroPreview\(interestPreviewEvents, events\);/);
    assert.match(source, /upcomingInterestEvents\.length\s*\? 'Nearby upcoming races attracting the most interest\.'\s*: 'Nearby upcoming races\.'/s);
    assert.doesNotMatch(source, /Most votes among upcoming races\./);
  });

  it('sorts the final hero preview by date and links titles to English detail pages', () => {
    assert.match(source, /const previewEvents = \[\.\.\.upcomingInterestEvents, \.\.\.fallbackEvents\]\.sort\(compareEventDateThenTitle\);/);
    assert.match(source, /const detailPath = eventDetailPath\(event\);/);
    assert.ok(source.includes('<strong><a href=\"${escapeHtml(detailPath)}\">'));
  });
});
