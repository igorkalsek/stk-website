import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { isInternalStkNavigationTarget } from '../.cache/dist-test/lib/stkAnalytics.js';

const analyticsSource = readFileSync(new URL('../src/lib/stkAnalytics.ts', import.meta.url), 'utf8');
const proposalFormSource = readFileSync(new URL('../src/components/RaceProposalForm.astro', import.meta.url), 'utf8');

describe('isInternalStkNavigationTarget', () => {
  const canonicalCurrent = 'https://tekaski-koledar.si/iskalnik-tekov/?year=2026';

  it('classifies relative, canonical, preview and local STK navigation as internal', () => {
    const internalTargets = [
      '/tek/2026/r000001-example/',
      '../tek/2026/r000001-example/',
      '?year=2027',
      '#results',
      'https://tekaski-koledar.si/tek/2026/example/',
      'https://www.tekaski-koledar.si/en/races/2026/example/',
      'https://stk-website.pages.dev/tek/2026/example/',
      'https://branch-name.stk-website.pages.dev/tek/2026/example/',
      'http://localhost:4321/tek/2026/example/'
    ];

    for (const target of internalTargets) {
      assert.equal(isInternalStkNavigationTarget(target, canonicalCurrent), true, target);
    }
  });

  it('treats canonical links as internal from Cloudflare previews and preview links as internal from local development', () => {
    assert.equal(
      isInternalStkNavigationTarget('https://tekaski-koledar.si/tek/2026/example/', 'https://feature.stk-website.pages.dev/iskalnik-tekov/'),
      true
    );
    assert.equal(
      isInternalStkNavigationTarget('https://feature.stk-website.pages.dev/tek/2026/example/', 'http://localhost:4321/iskalnik-tekov/'),
      true
    );
  });

  it('does not classify external domains or non-page protocols as internal navigation', () => {
    const externalTargets = [
      'https://prijavim.se/calendar/event/123/',
      'https://protime.si/dogodek/example/',
      'https://docs.google.com/forms/example',
      'https://calendar.google.com/calendar/render',
      'https://connect.garmin.com/modern/course/123',
      'https://stk-master-api.igor-kalsek.workers.dev/',
      'https://example.pages.dev/',
      'https://example.com/',
      'mailto:test@example.com'
    ];

    for (const target of externalTargets) {
      assert.equal(isInternalStkNavigationTarget(target, canonicalCurrent), false, target);
    }
  });

  it('fails safely for malformed URLs without throwing', () => {
    for (const target of ['http://[::1', 'https://%', 'not a valid url']) {
      assert.doesNotThrow(() => isInternalStkNavigationTarget(target, canonicalCurrent));
      assert.equal(isInternalStkNavigationTarget(target, canonicalCurrent), false, target);
    }
  });
});

describe('STK analytics internal navigation guard', () => {
  it('keeps external_link_clicked allowed and suppresses internal targets before sending', () => {
    assert.match(analyticsSource, /'external_link_clicked'/);
    assert.ok(analyticsSource.includes("body.event_type === 'external_link_clicked' && body.target_url && isInternalStkNavigationTarget(body.target_url)) return;"));
    assert.ok(analyticsSource.indexOf('isInternalStkNavigationTarget(body.target_url)') < analyticsSource.indexOf('sendBody(body)'));
  });

  it('supports narrowly scoped analytics target URL redaction for prefilled fallback links', () => {
    assert.match(analyticsSource, /dataset\.analyticsRedactTargetUrl === 'true'/);
    assert.match(analyticsSource, /`\$\{url\.origin\}\$\{url\.pathname\}`/);
    assert.match(proposalFormSource, /data-analytics-redact-target-url="true"/);
  });
});
