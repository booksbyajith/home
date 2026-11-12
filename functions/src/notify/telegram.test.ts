import { describe, expect, it, vi } from 'vitest';
import { sendTelegram, telegramNewOrderText } from './telegram.js';
import { testOrder } from './testOrder.fixture.js';

describe('telegram', () => {
  it('contains no personal data', () => {
    const text = telegramNewOrderText(testOrder());
    expect(text).toContain('AJ-2611-7K3Q');
    expect(text).toContain('Rs. 4,850');
    expect(text).toContain('Colombo');
    for (const pii of ['Test Customer', '94770000001', 'customer@example.com', '1 Test Road', '00100'])
      expect(text).not.toContain(pii);
  });
  it('posts to the bot API', async () => {
    const f = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    await sendTelegram('tok', 'chat', 'hi', f as unknown as typeof fetch);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/bottok/sendMessage');
    expect(JSON.parse(init.body as string)).toMatchObject({ chat_id: 'chat', text: 'hi' });
  });
  it('throws on HTTP errors', async () => {
    const f = vi.fn(async () => new Response('', { status: 401 }));
    await expect(sendTelegram('t', 'c', 'x', f as unknown as typeof fetch)).rejects.toMatchObject({
      code: 'telegram_401',
    });
  });
});
