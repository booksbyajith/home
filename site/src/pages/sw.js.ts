import type { APIRoute } from 'astro';
import { asset } from '../lib/paths';

/** Hand-written service worker: offline fallback for navigations, runtime cache for built assets. */
export const GET: APIRoute = () => {
  const base = asset('/');
  const body = `/* booksbyajith service worker */
const VERSION = 'v1';
const CACHE = 'aj-' + VERSION;
const BASE = ${JSON.stringify(base)};
const OFFLINE = { si: BASE + 'offline/', en: BASE + 'en/offline/', ta: BASE + 'ta/offline/' };

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of Object.values(OFFLINE)) {
      const res = await fetch(url, { cache: 'reload' });
      if (!res.ok) continue;
      await cache.put(url, res.clone());
      const html = await res.text();
      const assets = [...html.matchAll(/(?:href|src)="([^"]+\\.(?:css|js|woff2))"/g)].map((m) => m[1]).filter((u) => u.startsWith(BASE));
      await cache.addAll([...new Set(assets)]).catch(() => undefined);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        const lang = url.pathname.startsWith(BASE + 'en/') ? 'en' : url.pathname.startsWith(BASE + 'ta/') ? 'ta' : 'si';
        return (await caches.match(OFFLINE[lang])) || Response.error();
      }
    })());
    return;
  }
  if (url.pathname.startsWith(BASE + '_astro/')) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
  }
});
`;
  return new Response(body, { headers: { 'Content-Type': 'application/javascript; charset=utf-8' } });
};
