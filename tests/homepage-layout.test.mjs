import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pages = {
  sl: readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8'),
  en: readFileSync(new URL('../src/pages/en/index.astro', import.meta.url), 'utf8')
};

const requiredSelectors = [
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



test('hero keeps the primary paths and removes the duplicate promotional trio', () => {
  assert.match(pages.sl, /href="\/iskalnik-tekov\/">Najdi tek<\/a>[\s\S]*href="\/moji-teki\/">Moji teki<\/a>[\s\S]*href="\/stk-tekobot\/">Vprašajte Tekobota<\/a>/);
  assert.match(pages.en, /href="\/en\/find-races\/">Find a race<\/a>[\s\S]*href="\/en\/my-races\/">My races<\/a>[\s\S]*href="\/en\/stk-tekobot\/">Ask STK Tekobot<\/a>/);
  for (const [lang, source] of Object.entries(pages)) {
    assert.doesNotMatch(source, /home-entry-grid|home-entry-card|hero-preview/, `${lang} should not render repeated promotional or race-preview blocks`);
  }
  assert.doesNotMatch(pages.sl, /Najdite pravi tek|Načrtujte svoje teke/);
  assert.doesNotMatch(pages.en, /Find the right race|Plan your races/);
});

test('homepages preserve race sections and follow the compact editorial order', () => {
  assert.match(pages.sl, /<h2 id="nearest-title">Naslednji teki<\/h2>/);
  assert.match(pages.en, /<h2 id="nearest-title">Upcoming races<\/h2>/);
  for (const [lang, source] of Object.entries(pages)) {
    const orderedSections = [
      'home-current-sections',
      'home-secondary-section',
      'home-update-section',
      'home-calendar-stats',
      'home-trust-section',
      'home-utility-section'
    ];
    for (let index = 1; index < orderedSections.length; index += 1) {
      assert.ok(
        source.indexOf(orderedSections[index - 1]) < source.indexOf(orderedSections[index]),
        `${lang} should place ${orderedSections[index - 1]} before ${orderedSections[index]}`
      );
    }
  }
});

test('homepages use neutral interest copy before and after loading', () => {
  assert.match(pages.sl, /data-top-description>Izbor prihodnjih tekov\.<\/p>/);
  assert.match(pages.sl, /description\.textContent = 'Izbor prihodnjih tekov\.';/);
  assert.doesNotMatch(pages.sl, /Po glasovih tekačev|zanimanju obiskovalcev/);
  assert.match(pages.en, /data-top-description>A selection of upcoming races\.<\/p>/);
  assert.match(pages.en, /description\.textContent = 'A selection of upcoming races\.';/);
  assert.doesNotMatch(pages.en, /runner votes|visitor interest/);
});

test('Slovene home declares the same language alternates as English home', () => {
  for (const source of Object.values(pages)) {
    assert.match(source, /alternateLinks=\{\[\s*\{ lang: 'sl', href: '\/' \},\s*\{ lang: 'en', href: '\/en\/' \},\s*\{ lang: 'x-default', href: '\/' \}\s*\]\}/s);
  }
});
