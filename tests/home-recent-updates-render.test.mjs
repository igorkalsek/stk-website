import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const slSource = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const enSource = readFileSync(new URL('../src/pages/en/index.astro', import.meta.url), 'utf8');

describe('homepage recent updates rendering', () => {
  it('renders Slovenian recent update titles as links when matched', () => {
    assert.match(slSource, /Promise\.allSettled\(\[\s*loadJson\('\/recent_updates\?days=7&limit=20'\),\s*loadJson\('\/'\)/s);
    assert.match(slSource, /buildHomepageEventDetailPath\(matchedEvent\.event/);
    assert.match(slSource, /<h3>\$\{detailPath \? `<a href="\$\{escapeHtml\(detailPath\)\}">\$\{escapeHtml\(title\)\}<\/a>` : escapeHtml\(title\)\}<\/h3>/);
  });

  it('renders English recent update titles as links when matched', () => {
    assert.match(enSource, /Promise\.allSettled\(\[\s*loadJson\('\/recent_updates\?days=7&limit=20'\),\s*loadJson\('\/'\)/s);
    assert.match(enSource, /buildEnglishHomepageEventDetailPath\(matchedEvent\.event/);
    assert.match(enSource, /<h3>\$\{detailPath \? `<a href="\$\{escapeHtml\(detailPath\)\}">\$\{escapeHtml\(title\)\}<\/a>` : escapeHtml\(title\)\}<\/h3>/);
  });

  it('keeps recent updates visible when master loading fails', () => {
    assert.match(slSource, /masterResult\.status === 'fulfilled'[\s\S]*: null/);
    assert.match(enSource, /masterResult\.status === 'fulfilled'[\s\S]*: null/);
    assert.doesNotMatch(slSource, /throw masterResult\.reason/);
    assert.doesNotMatch(enSource, /throw masterResult\.reason/);
  });

  it('adds analytics attributes only for linked recent updates', () => {
    for (const source of [slSource, enSource]) {
      assert.match(source, /data-analytics-placement="home_updates"/);
      assert.match(source, /data-analytics-event-id="\$\{escapeHtml\(analyticsEventId\)\}"/);
      assert.match(source, /const analyticsAttributes = detailPath[\s\S]*: '';/);
    }
  });
});
