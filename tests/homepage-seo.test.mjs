import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const layout = readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
const pages = {
  sl: readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8'),
  en: readFileSync(new URL('../src/pages/en/index.astro', import.meta.url), 'utf8')
};

test('homepages have one exact, language-specific hero heading', () => {
  assert.equal(pages.sl.match(/<h1\b/g)?.length, 1);
  assert.equal(pages.en.match(/<h1\b/g)?.length, 1);
  assert.match(pages.sl, /<h1 id="hero-title">Tek se začne tukaj<\/h1>/);
  assert.match(pages.en, /<h1 id="hero-title">Your race starts here<\/h1>/);
});

test('homepages provide distinct SEO titles, canonicals, and all language alternates', () => {
  assert.match(pages.sl, /title="Tekaški koledar 2026 – teki po Sloveniji \| Slovenski Tekaški Koledar"/);
  assert.match(pages.en, /title="Run Slovenia: Race Calendar \| Slovenski Tekaški Koledar"/);
  assert.doesNotMatch(pages.sl, /canonicalPath=/);
  assert.match(pages.en, /canonicalPath="\/en\/"/);
  assert.match(layout, /canonicalPath \?\? Astro\.url\.pathname/);
  for (const source of Object.values(pages)) {
    assert.match(source, /\{ lang: 'sl', href: '\/' \}/);
    assert.match(source, /\{ lang: 'en', href: '\/en\/' \}/);
    assert.match(source, /\{ lang: 'x-default', href: '\/' \}/);
  }
});

test('homepages retain the existing default social metadata', () => {
  assert.match(layout, /const openGraphImageUrl = 'https:\/\/tekaski-koledar\.si\/stk-logo\.jpeg';/);
  assert.match(layout, /<meta property="og:image" content=\{openGraphImageUrl\}/);
  assert.match(layout, /<meta property="og:image:alt" content=\{openGraphImageAlt\}/);
  assert.match(layout, /<meta name="twitter:card" content="summary" \/>/);
  assert.doesNotMatch(layout, /twitter:image|og:image:width|og:image:height|summary_large_image/);
  for (const source of Object.values(pages)) assert.doesNotMatch(source, /socialImage|twitterCard/);
});

test('primary CTAs retain copy, hrefs, and analytics hooks', () => {
  assert.match(pages.sl, /<a class="button button-primary hero-primary-cta" href="\/iskalnik-tekov\/">Poiščite tek<\/a>/);
  assert.match(pages.en, /<a class="button button-primary hero-primary-cta" href="\/en\/find-races\/">Find a race<\/a>/);
  for (const source of Object.values(pages)) {
    assert.match(source, /data-analytics-placement=/);
    assert.match(source, /data-analytics-event-id=/);
    assert.match(source, /data-analytics-event-name=/);
    assert.match(source, /data-analytics-event-date=/);
    assert.match(source, /data-analytics-event-year=/);
  }
});
