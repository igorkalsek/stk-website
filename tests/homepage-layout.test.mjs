import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pages = {
  sl: readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8'),
  en: readFileSync(new URL('../src/pages/en/index.astro', import.meta.url), 'utf8')
};

const requiredSelectors = [
  'data-hero-preview-title',
  'data-hero-preview-helper',
  'data-hero-preview-list',
  'data-stat',
  'data-registration-deadlines-section',
  'data-registration-deadlines',
  'data-nearest-events',
  'data-top-events',
  'data-recent-updates',
  'data-status'
];

test('homepages preserve required dynamic selectors and a single recent-updates container', () => {
  for (const [lang, source] of Object.entries(pages)) {
    for (const selector of requiredSelectors) assert.match(source, new RegExp(selector), `${lang} missing ${selector}`);
    assert.equal(source.match(/data-recent-updates/g)?.length, 2, `${lang} should have one markup container and one script selector`);
  }
});

test('homepages remove duplicate standalone lower sections', () => {
  assert.doesNotMatch(pages.sl, /Več kot samo datumi tekov|Zakaj Slovenski Tekaški Koledar\?|Vprašajte STK Tekobota/);
  assert.doesNotMatch(pages.en, /More than race dates|Why use the Slovenian Race Calendar\?/);
});

test('homepages include final utility cards and expected links', () => {
  assert.match(pages.sl, /Še več možnosti[\s\S]*Osebni koledar[\s\S]*href="\/osebni-koledar\/"[\s\S]*Za organizatorje[\s\S]*href="\/dodaj-ali-popravi-tek\/"[\s\S]*Spremljajte STK[\s\S]*<SocialLinks lang="sl"/);
  assert.match(pages.en, /More from STK[\s\S]*Personal calendar[\s\S]*href="\/en\/personal-calendar\/"[\s\S]*For organisers[\s\S]*href="\/en\/add-or-correct-race\/"[\s\S]*Follow STK[\s\S]*<SocialLinks lang="en"/);
});

