import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { absUrl, href } from '../lib/paths';
import { STATIC_ROUTES } from '../lib/routes';

export const GET: APIRoute = async () => {
  const urls: { si?: string; en?: string; priority: number; lastmod?: string }[] = [];
  for (const r of STATIC_ROUTES.filter((r) => r.sitemap))
    urls.push({ si: r.path, en: r.path, priority: r.priority });
  for (const b of await getCollection('bookFacts'))
    urls.push({ si: `/books/${b.data.slug}/`, en: `/books/${b.data.slug}/`, priority: 0.9 });
  for (const kind of ['news', 'blog'] as const) {
    for (const p of await getCollection(kind, (e) => !e.data.draft)) {
      const [lang, slug] = p.id.split('/');
      urls.push({
        [lang]: `/${kind}/${slug}/`,
        priority: 0.6,
        lastmod: (p.data.updated ?? p.data.date).toISOString().slice(0, 10),
      });
    }
  }
  const entry = (loc: string, u: (typeof urls)[number]) =>
    `<url><loc>${loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}${
      u.si && u.en
        ? `<xhtml:link rel="alternate" hreflang="si" href="${absUrl(href('si', u.si))}"/><xhtml:link rel="alternate" hreflang="en" href="${absUrl(href('en', u.en))}"/>`
        : ''
    }<priority>${u.priority.toFixed(1)}</priority></url>`;
  const body = urls
    .flatMap((u) => [u.si && entry(absUrl(href('si', u.si)), u), u.en && entry(absUrl(href('en', u.en)), u)])
    .filter(Boolean)
    .join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
