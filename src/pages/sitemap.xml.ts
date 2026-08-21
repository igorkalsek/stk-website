import { getDetailStaticPaths } from '../utils-build-data';
import { buildSitemapPaths, renderSitemapXml } from '../utils-sitemap';

export async function GET() {
  const detailPaths = await getDetailStaticPaths('sl');
  const sitemapPaths = buildSitemapPaths(detailPaths);

  return new Response(renderSitemapXml(sitemapPaths, import.meta.env.SITE), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
