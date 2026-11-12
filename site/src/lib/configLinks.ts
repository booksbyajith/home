import { buildWaUrl } from '@shared/templates';
import { fetchPublicConfig } from './publicData';

/** Fill links whose targets come from config/public (Facebook page, WhatsApp, phone). */
export function initConfigLinks(): void {
  const els = document.querySelectorAll<HTMLElement>('[data-config]');
  if (!els.length) return;
  const run = async () => {
    const cfg = await fetchPublicConfig();
    if (!cfg) return;
    for (const el of els) {
      const kind = el.dataset.config;
      let url = '';
      if (kind === 'facebook') url = cfg.contact.facebookPageUrl;
      else if (kind === 'whatsapp' && cfg.contact.whatsappNumber)
        url = buildWaUrl(cfg.contact.whatsappNumber, el.dataset.waText ?? '');
      else if (kind === 'phone' && cfg.contact.orderPhone) {
        url = `tel:+${cfg.contact.orderPhone}`;
        const label = el.querySelector('[data-phone-label]');
        if (label) label.textContent = '+' + cfg.contact.orderPhone;
      }
      if (url && el instanceof HTMLAnchorElement) {
        el.href = url;
        el.hidden = false;
        el.closest<HTMLElement>('[data-config-wrap]')?.removeAttribute('hidden');
      }
    }
  };
  if ('requestIdleCallback' in window) requestIdleCallback(() => void run(), { timeout: 2000 });
  else setTimeout(() => void run(), 200);
}
