/**
 * Generates sitemap.xml and robots.txt.
 * @param {Array<object>} pages 
 * @param {object} config 
 * @returns {{ sitemap: string, robots: string }}
 */
export function generateSitemapAndRobots(pages, config) {
  const siteUrl = (config.siteUrl || '').replace(/\/$/, '');

  let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
  sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const page of pages) {
    if (page.frontmatter?.draft) continue;
    const loc = siteUrl ? `${siteUrl}${page.route}` : page.route;
    sitemap += '  <url>\n';
    sitemap += `    <loc>${loc}</loc>\n`;
    sitemap += `    <changefreq>weekly</changefreq>\n`;
    sitemap += `    <priority>${page.route === '/' ? '1.0' : '0.8'}</priority>\n`;
    sitemap += '  </url>\n';
  }

  sitemap += '</urlset>\n';

  let robots = 'User-agent: *\nAllow: /\n';
  if (siteUrl) {
    robots += `Sitemap: ${siteUrl}/sitemap.xml\n`;
  }

  return { sitemap, robots };
}
