import { env } from './env';

/**
 * Cookieless page-view beacon. Sends only the pathname: never the query string or fragment
 * (order IDs live in fragments), never personal data. Off when PUBLIC_ANALYTICS_PROVIDER=none.
 */
export function trackPageView(): void {
  const a = env.analytics;
  if (a.provider === 'none' || navigator.doNotTrack === '1') return;
  const path = location.pathname;
  try {
    if (a.provider === 'goatcounter' && a.endpoint) {
      const u = `${a.endpoint.replace(/\/+$/, '')}/count?p=${encodeURIComponent(path)}&t=${encodeURIComponent(document.title)}&rnd=${Math.random().toString(36).slice(2)}`;
      void fetch(u, { mode: 'no-cors', keepalive: true, credentials: 'omit' });
    } else if (a.provider === 'plausible' && a.src && a.endpoint) {
      void fetch(`${new URL(a.src).origin}/api/event`, {
        method: 'POST',
        keepalive: true,
        credentials: 'omit',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ n: 'pageview', u: location.origin + path, d: a.endpoint, r: null }),
      });
    }
  } catch {
    /* analytics must never break the page */
  }
}

/** Meta Pixel, only when configured AND the visitor has accepted. */
export function loadPixel(id: string): void {
  type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
  const w = window as unknown as { fbq?: Fbq; _fbq?: Fbq };
  if (w.fbq) return;
  const q: unknown[] = [];
  const fbq = ((...args: unknown[]) => void q.push(args)) as Fbq;
  fbq.queue = q;
  fbq.loaded = true;
  fbq.version = '2.0';
  w.fbq = w._fbq = fbq;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);
  fbq('init', id);
  fbq('track', 'PageView');
}
