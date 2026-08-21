import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  STATIC_SITEMAP_PATHS,
  buildSitemapPaths,
  renderSitemapXml,
} from '../.cache/dist-test/utils-sitemap.js';

test('sitemap keeps static URLs and adds both languages for generated detail paths', () => {
  const detailPaths = [
    { params: { year: '2026', slug: 'r002026-testni-tek-2026' } },
    { params: { year: '2027', slug: 'r002027-testni-tek-2027' } },
  ];
  const paths = buildSitemapPaths(detailPaths);

  for (const staticPath of STATIC_SITEMAP_PATHS) assert.ok(paths.includes(staticPath));
  assert.ok(paths.includes('/tek/2026/r002026-testni-tek-2026/'));
  assert.ok(paths.includes('/en/races/2026/r002026-testni-tek-2026/'));
  assert.ok(paths.includes('/tek/2027/r002027-testni-tek-2027/'));
  assert.ok(paths.includes('/en/races/2027/r002027-testni-tek-2027/'));

  const xml = renderSitemapXml(paths, 'https://tekaski-koledar.si');
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<loc>https:\/\/tekaski-koledar\.si\/tek\/2026\/r002026-testni-tek-2026\/<\/loc>/);
});

test('sitemap contains no duplicate URLs when detail paths repeat', () => {
  const detailPath = { params: { year: '2026', slug: 'r002026-testni-tek-2026' } };
  const paths = buildSitemapPaths([detailPath, detailPath]);

  assert.equal(paths.length, new Set(paths).size);
  assert.equal(paths.length, STATIC_SITEMAP_PATHS.length + 2);
});
