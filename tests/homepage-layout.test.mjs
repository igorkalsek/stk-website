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
  assert.match(pages.sl, /Še več možnosti[\s\S]*Osebni koledar[\s\S]*href="\/osebni-koledar\/"[\s\S]*Za organizatorje[\s\S]*Načrtujete tek za 2027\?[\s\S]*href="\/za-organizatorje\/"[\s\S]*Spremljajte STK[\s\S]*<SocialLinks lang="sl"/);
  assert.match(pages.en, /More from STK[\s\S]*Personal calendar[\s\S]*href="\/en\/personal-calendar\/"[\s\S]*For organisers[\s\S]*Planning a race for 2027\?[\s\S]*href="\/en\/for-organizers\/"[\s\S]*Follow STK[\s\S]*<SocialLinks lang="en"/);
});



test('mobile compaction keeps every homepage entry link available', () => {
  assert.match(pages.sl, /href="\/iskalnik-tekov\/">Odprite iskalnik<\/a>[\s\S]*href="\/moji-teki\/">Odprite Moje teke<\/a>[\s\S]*href="\/stk-tekobot\/">Odprite Tekobota<\/a>/);
  assert.match(pages.en, /href="\/en\/find-races\/">Open race search<\/a>[\s\S]*href="\/en\/my-races\/">Open My races<\/a>[\s\S]*href="\/en\/stk-tekobot\/">Open Tekobot<\/a>/);
});

test('homepages label the nearest-event section accurately and place current races before statistics', () => {
  assert.match(pages.sl, /<h2 id="nearest-title">Naslednji teki<\/h2>/);
  assert.match(pages.en, /<h2 id="nearest-title">Upcoming races<\/h2>/);
  for (const [lang, source] of Object.entries(pages)) {
    assert.ok(source.indexOf('home-current-sections') < source.indexOf('home-calendar-stats'), `${lang} should show current races before statistics`);
  }
});

test('homepages use neutral preview copy before and after loading', () => {
  assert.match(pages.sl, /data-hero-preview-helper>Izbor prihodnjih tekov\.<\/p>/);
  assert.match(pages.sl, /helperElement\.textContent = 'Izbor prihodnjih tekov\.';/);
  assert.doesNotMatch(pages.sl, /Po glasovih tekačev|zanimanju obiskovalcev/);
  assert.match(pages.en, /data-hero-preview-helper>A selection of upcoming races\.<\/p>/);
  assert.match(pages.en, /helperElement\.textContent = 'A selection of upcoming races\.';/);
  assert.doesNotMatch(pages.en, /runner votes|visitor interest/);
});

test('Slovene home declares the same language alternates as English home', () => {
  for (const source of Object.values(pages)) {
    assert.match(source, /alternateLinks=\{\[\s*\{ lang: 'sl', href: '\/' \},\s*\{ lang: 'en', href: '\/en\/' \},\s*\{ lang: 'x-default', href: '\/' \}\s*\]\}/s);
  }
});
