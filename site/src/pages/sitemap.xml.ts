import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import type { Lang } from '@shared/constants';
import { absUrl, href, LANGS } from '../lib/paths';
import { STATIC_ROUTES } from '../lib/routes';

type Entry = { paths: Partial<Record<Lang, string>>; priority: number; lastmod?: string };

const all = (path: string) => Object.fromEntries(LANGS.map((l) => [l, path])) as Record<Lang, string>;

export const GET: APIRoute = async () => {
  const urls: Entry[] = [];
  for (const r of STATIC_ROUTES.filter((r) => r.sitemap))
    urls.push({ paths: all(r.path), priority: r.priority });
  for (const b of await getCollection('bookFacts'))
    urls.push({ paths: all(`/books/${b.data.slug}/`), priority: 0.9 });
  for (const kind of ['news', 'blog'] as const) {
    // Group translations of the same post so each URL lists its alternates.
    const groups = new Map<string, Entry>();
    for (const p of await getCollection(kind, (e) => !e.data.draft)) {
      const [lang, slug] = p.id.split('/') as [Lang, string];
      const key = p.data.translationKey ?? `${lang}/${slug}`;
      const lastmod = (p.data.updated ?? p.data.date).toISOString().slice(0, 10);
      const g = groups.get(key) ?? { paths: {}, priority: 0.6, lastmod };
      g.paths[lang] = `/${kind}/${slug}/`;
      if (!g.lastmod || lastmod > g.lastmod) g.lastmod = lastmod;
      groups.set(key, g);
    }
    urls.push(...groups.values());
  }
  const entry = (loc: string, u: Entry) => {
    const alts = Object.entries(u.paths) as [Lang, string][];
    const links =
      alts.length > 1
        ? alts
            .map(([l, p]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${absUrl(href(l, p))}"/>`)
            .join('')
        : '';
    return `<url><loc>${loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}${links}<priority>${u.priority.toFixed(1)}</priority></url>`;
  };
  const body = urls
    .flatMap((u) =>
      (Object.entries(u.paths) as [Lang, string][]).map(([l, p]) => entry(absUrl(href(l, p)), u)),
    )
    .join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
