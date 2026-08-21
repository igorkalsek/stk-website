export const STATIC_SITEMAP_PATHS = [
  '/',
  '/iskalnik-tekov/',
  '/najbolj-glasovani-teki/',
  '/druzinam-prijazni-teki/',
  '/skupinski-teki/',
  '/osebni-koledar/',
  '/stk-tekobot/',
  '/dodaj-ali-popravi-tek/',
  '/za-organizatorje/',
  '/za-organizatorje/termini-2027/',
  '/o-projektu-in-zasebnost/',
  '/en/',
  '/en/find-races/',
  '/en/most-voted-races/',
  '/en/family-friendly-races/',
  '/en/group-runs/',
  '/en/personal-calendar/',
  '/en/stk-tekobot/',
  '/en/for-organizers/',
  '/en/for-organizers/2027-race-dates/',
];

type DetailStaticPath = { params: { year: string; slug: string } };

export const buildSitemapPaths = (detailPaths: DetailStaticPath[]) => [
  ...new Set([
    ...STATIC_SITEMAP_PATHS,
    ...detailPaths.flatMap(({ params: { year, slug } }) => [
      `/tek/${year}/${slug}/`,
      `/en/races/${year}/${slug}/`,
    ]),
  ]),
];

export const renderSitemapXml = (paths: string[], site: string) => {
  const urls = paths
    .map((path) => `  <url><loc>${new URL(path, site).href}</loc></url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
};
