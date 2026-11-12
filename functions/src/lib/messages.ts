import { SITE_URL } from '../options.js';
import { formatLKR } from '../shared/pricing.js';
import { bookTitles, buildTrackUrl, buildWaUrl, renderTemplate } from '../shared/templates.js';
import type { OrderDoc, PrivateConfig, PublicConfig } from '../shared/types.js';
import { templateKeyFor } from '../shared/status.js';

export function templateVars(order: OrderDoc, pub: PublicConfig): Record<string, string> {
  return {
    name: order.customer.name,
    orderId: order.orderId,
    bookTitles: bookTitles(order.items, order.lang),
    total: formatLKR(order.totals.grandTotalLKR),
    courier: order.dispatch?.courier ?? '',
    trackingNo: order.dispatch?.trackingNo ?? '',
    trackingUrl: buildTrackUrl(SITE_URL.value(), order.lang, order.orderId),
    facebookUrl: pub.contact.facebookPageUrl,
    reason: order.rejection?.reason ?? '',
  };
}

export function statusMessage(
  order: OrderDoc,
  pub: PublicConfig,
  priv: PrivateConfig,
): { message: string; waUrl: string } | null {
  const key = templateKeyFor(order.status);
  if (!key || !order.customer.whatsapp) return null;
  const tpl = priv.templates[key][order.lang] || priv.templates[key].en;
  const message = renderTemplate(tpl, templateVars(order, pub));
  return { message, waUrl: buildWaUrl(order.customer.whatsapp, message) };
}
