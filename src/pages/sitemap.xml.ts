const sitemapPaths = [
  '/',
  '/iskalnik-tekov/',
  '/najbolj-glasovani-teki/',
  '/druzinam-prijazni-teki/',
  '/skupinski-teki/',
  '/osebni-koledar/',
  '/stk-tekobot/',
  '/dodaj-ali-popravi-tek/',
  '/o-projektu-in-zasebnost/',
  '/en/',
  '/en/find-races/',
  '/en/most-voted-races/',
  '/en/family-friendly-races/',
  '/en/group-runs/',
  '/en/personal-calendar/',
  '/en/stk-tekobot/',
];

export function GET() {
  const urls = sitemapPaths
    .map((path) => `  <url><loc>${new URL(path, import.meta.env.SITE).href}</loc></url>`)
    .join('\n');

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
