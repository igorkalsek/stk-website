export function GET() {
  const sitemapUrl = new URL('/sitemap.xml', import.meta.env.SITE).href;

  return new Response(`User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
