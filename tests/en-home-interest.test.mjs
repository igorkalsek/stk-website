import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('../src/pages/en/index.astro', import.meta.url), 'utf8');

describe('English home interest section', () => {
  it('uses interest-preview copy and keeps only View all races in the section header', () => {
    assert.match(source, /<h2 id="voted-title">Races attracting the most interest<\/h2>/);
    assert.match(source, /<p data-top-description>A selection of upcoming races\.<\/p>/);
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
    assert.doesNotMatch(source, /This view is based on runner votes/);
    assert.match(source, /setStatus\('top', 'A selection of upcoming races\.'\)/);
  });

  it('keeps interest analytics and links cards to English race detail pages', () => {
    assert.ok(source.includes('data-analytics-placement="home_interest"'));
    assert.ok(source.includes('data-analytics-placement=\"home_interest\"'));
    assert.match(source, /buildEnglishHomepageEventDetailPath/);
    assert.ok(source.includes('<h3><a href="${escapeHtml(eventDetailPath(event))}">'));
  });

  it('links all homepage event title surfaces through English detail paths', () => {
    assert.ok(source.includes('<strong><a href="${escapeHtml(eventDetailPath(item.event))}">${escapeHtml(item.title)}</a></strong>'));
    assert.ok(source.includes('<strong><a href="${escapeHtml(detailPath)}">${escapeHtml(title)}</a></strong>'));
    assert.ok(source.includes('<h3><a href="${escapeHtml(eventDetailPath(event))}">${escapeHtml(title)}</a></h3>'));
    assert.doesNotMatch(source, /buildEventDetailPath/);
  });
});

describe('English home hero preview', () => {
  it('uses interest events plus nearest fallback events and hides interest vote counts', () => {
    assert.match(source, /const interestPreviewEvents = await getInterestPreviewRaces\(events, 20\)\.catch\(\(\) => \[\]\);/);
    assert.match(source, /renderHeroPreview\(interestPreviewEvents, events\);/);
    assert.match(source, /helperElement\.textContent = 'A selection of upcoming races\.';/);
    assert.doesNotMatch(source, /Most votes among upcoming races\./);
  });

  it('sorts the final hero preview by date and links titles to English detail pages', () => {
    assert.match(source, /const previewEvents = \[\.\.\.upcomingInterestEvents, \.\.\.fallbackEvents\]\.sort\(compareEventDateThenTitle\);/);
    assert.match(source, /const detailPath = eventDetailPath\(event\);/);
    assert.ok(source.includes('<strong><a href=\"${escapeHtml(detailPath)}\">'));
  });
});
