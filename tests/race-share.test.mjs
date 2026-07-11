import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { buildRaceCopyDescription } from '../.cache/dist-test/utils-race-copy.js';
import { buildRaceShareUrls } from '../.cache/dist-test/utils-race-share.js';

const event = {
  title: 'Ljubljanski maraton',
  naziv_prireditve: 'Ljubljanski maraton',
  year: '2026',
  row: '42',
  date: '2026-10-18',
  place: 'Ljubljana',
  distances: '10;21;42'
};
const formatDate = (value) => value === '2026-10-18' ? '18. oktober 2026' : value;

describe('race detail public share URLs', () => {
  it('builds Slovene and English Facebook URLs with production detail URLs only', () => {
    const sl = buildRaceShareUrls({ event, language: 'sl', formatDate });
    const en = buildRaceShareUrls({ event, language: 'en', formatDate });

    assert.equal(sl.detailUrl, 'https://tekaski-koledar.si/tek/2026/r000042-ljubljanski-maraton/');
    assert.equal(en.detailUrl, 'https://tekaski-koledar.si/en/races/2026/r000042-ljubljanski-maraton/');
    assert.equal(new URL(sl.facebook).searchParams.get('u'), sl.detailUrl);
    assert.equal(new URL(en.facebook).searchParams.get('u'), en.detailUrl);

    for (const url of [sl.facebook, en.facebook]) {
      assert.doesNotMatch(url, /pages\.dev|localhost|127\.0\.0\.1/i);
    }
  });

  it('uses the same production URL for WhatsApp, X, email and copy-link controls', () => {
    const sl = buildRaceShareUrls({ event, language: 'sl', formatDate });
    const source = readFileSync(new URL('../src/pages/tek/[year]/[slug].astro', import.meta.url), 'utf8');

    assert.match(new URL(sl.whatsapp).searchParams.get('text'), new RegExp(sl.detailUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(new URL(sl.twitter).searchParams.get('text'), new RegExp(sl.detailUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(new URL(sl.email).searchParams.get('body'), new RegExp(sl.detailUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(source, /data-copy-share-url=\{shareUrl\}/);
    assert.match(source, /href=\{shareLinks\.whatsapp\}/);
    assert.match(source, /href=\{shareLinks\.twitter\}/);
    assert.match(source, /href=\{shareLinks\.email\}/);
  });

  it('keeps the prepared description with title, date, place and production link', () => {
    const description = buildRaceCopyDescription({ event, language: 'sl', formatDate });

    assert.match(description, /Ljubljanski maraton/);
    assert.match(description, /18\. oktober 2026/);
    assert.match(description, /Ljubljana/);
    assert.match(description, /https:\/\/tekaski-koledar\.si\/tek\/2026\/r000042-ljubljanski-maraton\//);
  });

  it('keeps Facebook analytics attributes on both detail pages', () => {
    for (const path of ['../src/pages/tek/[year]/[slug].astro', '../src/pages/en/races/[year]/[slug].astro']) {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      assert.match(source, /data-analytics-event-type="share_clicked"/);
      assert.match(source, /data-analytics-action-type="share_facebook_click"/);
      assert.match(source, /data-analytics-target-url=\{shareUrl\}/);
    }
  });

  it('sets absolute public Open Graph URL and image metadata', () => {
    const layout = readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
    const detail = readFileSync(new URL('../src/pages/tek/[year]/[slug].astro', import.meta.url), 'utf8');

    assert.match(detail, /canonicalUrl=\{event \? shareUrl : undefined\}/);
    assert.match(layout, /<meta property="og:url" content=\{canonicalUrl\}/);
    assert.match(layout, /https:\/\/tekaski-koledar\.si\/stk-logo\.jpeg/);
    assert.match(layout, /<meta property="og:image" content=\{openGraphImageUrl\}/);
    assert.match(layout, /<meta property="og:image:alt" content=\{openGraphImageAlt\}/);
  });
});
