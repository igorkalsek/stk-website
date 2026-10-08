import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('../src/pages/en/index.astro', import.meta.url), 'utf8');

describe('English home interest section', () => {
  it('uses interest-preview copy and keeps only View all races in the section header', () => {
    assert.match(source, /<h2 id="voted-title">Races attracting the most interest<\/h2>/);
    assert.match(source, /<p data-top-description>Upcoming races ranked by recorded visitor interactions on STK, including race views, official information and registration clicks\.<\/p>/);
    assert.match(source, /href="\/en\/find-races\/">View all races<\/a>/);
    assert.doesNotMatch(source, /Most voted upcoming races/);
    assert.doesNotMatch(source, /View full ranking/);
    assert.doesNotMatch(source, /Vote for your race/);
  });

  it('loads the interest preview without a voted fallback', () => {
    assert.match(source, /const INTEREST_PREVIEW_URL = '\/api\/interest-preview';/);
    assert.match(source, /fetch\(INTEREST_PREVIEW_URL/);
    assert.match(source, /getInterestPreviewRaces\(masterRows, 5\)/);
  });

  it('keeps interest cards free of vote badges and leaves the subtitle unchanged', () => {
    const loader = source.slice(source.indexOf('  async function loadTopEvents()'), source.indexOf('  async function loadRecentUpdates()'));
    assert.doesNotMatch(loader, /getTopUpcomingRaces|formatVoteCount|Voting open|description\.textContent/);
    assert.match(loader, /There is not enough interest data yet\./);
    assert.match(loader, /Interest data is currently unavailable\./);
    assert.match(loader, /container\.replaceChildren\(\)/);
  });

  it('keeps interest analytics and links cards to English race detail pages', () => {
    assert.ok(source.includes('data-analytics-placement="home_interest"'));
    assert.ok(source.includes('data-analytics-placement=\"home_interest\"'));
    assert.match(source, /buildEnglishHomepageEventDetailPath/);
    assert.ok(source.includes('<h3><a href="${escapeHtml(eventDetailPath(event))}">'));
  });

  it('links deadline and race collection titles through English detail paths', () => {
    assert.ok(source.includes('<strong><a href="${escapeHtml(eventDetailPath(item.event))}">${escapeHtml(item.title)}</a></strong>'));
    assert.ok(source.includes('<h3><a href="${escapeHtml(eventDetailPath(event))}">${escapeHtml(title)}</a></h3>'));
    assert.doesNotMatch(source, /buildEventDetailPath/);
  });
});
