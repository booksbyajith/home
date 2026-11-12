import { trackPageView, loadPixel } from './analytics';
import { initConfigLinks } from './configLinks';
import { env } from './env';
import { asset } from './paths';

const KEY = 'aj.pixelConsent';

function pixel() {
  if (!env.metaPixelId) return;
  let choice: string | null = null;
  try {
    choice = localStorage.getItem(KEY);
  } catch {
    /* ignore */
  }
  if (choice === 'accept') return loadPixel(env.metaPixelId);
  if (choice === 'decline') return;
  const banner = document.querySelector<HTMLElement>('[data-pixel-consent]');
  if (!banner) return;
  banner.hidden = false;
  banner.addEventListener('click', (e) => {
    const v = (e.target as HTMLElement).closest<HTMLElement>('[data-pixel]')?.dataset.pixel;
    if (!v) return;
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
    banner.hidden = true;
    if (v === 'accept') loadPixel(env.metaPixelId);
  });
}

export function initClient(): void {
  initConfigLinks();
  trackPageView();
  pixel();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(asset('/sw.js'), { scope: asset('/') }).catch(() => undefined);
    });
  }
}
