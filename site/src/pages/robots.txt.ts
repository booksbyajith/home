import type { APIRoute } from 'astro';
import { absUrl, asset } from '../lib/paths';

export const GET: APIRoute = () =>
  new Response(
    `User-agent: *\nAllow: /\nDisallow: ${asset('/admin/')}\nDisallow: ${asset('/staff/')}\n\nSitemap: ${absUrl(asset('/sitemap.xml'))}\n`,
    {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    },
  );
