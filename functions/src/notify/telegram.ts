import { districtName } from '../shared/districts.js';
import { formatLKR } from '../shared/pricing.js';
import type { OrderDoc } from '../shared/types.js';

/** Team alert text: no name, phone number or address. */
export function telegramNewOrderText(order: OrderDoc): string {
  const titles = order.items.map((i) => `• ${i.title.en} × ${i.qty}`).join('\n');
  return `🆕 New order ${order.orderId}\n${titles}\nTotal: ${formatLKR(order.totals.grandTotalLKR)}\nDistrict: ${districtName(order.address.districtId, 'en')}`;
}

export async function sendTelegram(
  token: string,
  chatId: string,
  text: string,
  f: typeof fetch = fetch,
): Promise<void> {
  const res = await f(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!res.ok) {
    const err = new Error(`telegram http ${res.status}`) as Error & { code: string };
    err.code = `telegram_${res.status}`;
    throw err;
  }
}
