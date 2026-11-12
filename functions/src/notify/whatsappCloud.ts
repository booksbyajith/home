import { bookTitles } from '../shared/templates.js';
import type { OrderDoc, WaEvent } from '../shared/types.js';
import type { WaTemplateMessage } from './types.js';

/** Body parameter order for each approved template. Keep in sync with MANUAL_SETUP.md. */
export const WA_PARAMS: Record<WaEvent, string[]> = {
  acknowledged: ['name', 'orderId', 'bookTitles'],
  payment_verified: ['orderId'],
  dispatched: ['orderId', 'bookTitles', 'courier', 'trackingNo', 'trackingUrl'],
  rejected: ['orderId', 'reason'],
};

export function waTemplateMessage(
  order: OrderDoc,
  event: WaEvent,
  templateName: string,
  languageCode: string,
  vars: Record<string, string>,
): WaTemplateMessage {
  const all: Record<string, string> = {
    ...vars,
    bookTitles: vars.bookTitles ?? bookTitles(order.items, order.lang),
  };
  return {
    to: order.customer.whatsapp,
    templateName,
    languageCode,
    parameters: WA_PARAMS[event].map((k) => all[k] ?? ''),
  };
}

export async function sendWhatsAppTemplate(
  cfg: { token: string; phoneNumberId: string; graphApiVersion: string },
  msg: WaTemplateMessage,
  f: typeof fetch = fetch,
): Promise<void> {
  const res = await f(`https://graph.facebook.com/${cfg.graphApiVersion}/${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: msg.to,
      type: 'template',
      template: {
        name: msg.templateName,
        language: { code: msg.languageCode },
        components: [{ type: 'body', parameters: msg.parameters.map((text) => ({ type: 'text', text })) }],
      },
    }),
  });
  if (!res.ok) {
    let code = String(res.status);
    try {
      const j = (await res.json()) as { error?: { code?: number } };
      if (j.error?.code) code = `${res.status}_${j.error.code}`;
    } catch {
      /* ignore */
    }
    const err = new Error(`whatsapp http ${code}`) as Error & { code: string };
    err.code = `whatsapp_${code}`;
    throw err;
  }
}
