import { describe, expect, it, vi } from 'vitest';
import { sendWhatsAppTemplate, waTemplateMessage } from './whatsappCloud.js';
import { testOrder } from './testOrder.fixture.js';

describe('WhatsApp Cloud adapter', () => {
  it('builds the parameter list in the documented order', () => {
    const m = waTemplateMessage(testOrder({ lang: 'en' }), 'dispatched', 'order_dispatched', 'en', {
      orderId: 'AJ-2611-7K3Q',
      courier: 'Demo Courier',
      trackingNo: 'T1',
      trackingUrl: 'https://x.example.com/track/#AJ-2611-7K3Q',
    });
    expect(m).toEqual({
      to: '94770000001',
      templateName: 'order_dispatched',
      languageCode: 'en',
      parameters: [
        'AJ-2611-7K3Q',
        'The Portuguese Period',
        'Demo Courier',
        'T1',
        'https://x.example.com/track/#AJ-2611-7K3Q',
      ],
    });
  });

  it('posts a template message to the Graph API', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    await sendWhatsAppTemplate(
      { token: 'tok', phoneNumberId: '123', graphApiVersion: 'v21.0' },
      { to: '94770000001', templateName: 'order_ack', languageCode: 'si', parameters: ['a', 'b'] },
      f as unknown as typeof fetch,
    );
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v21.0/123/messages');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: 'whatsapp',
      to: '94770000001',
      type: 'template',
      template: {
        name: 'order_ack',
        language: { code: 'si' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'a' },
              { type: 'text', text: 'b' },
            ],
          },
        ],
      },
    });
  });

  it('throws a coded error on failure without leaking the token', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { code: 132001 } }), { status: 400 }));
    const p = sendWhatsAppTemplate(
      { token: 'secret-token', phoneNumberId: '123', graphApiVersion: 'v21.0' },
      { to: '94770000001', templateName: 'x', languageCode: 'en', parameters: [] },
      f as unknown as typeof fetch,
    );
    await expect(p).rejects.toMatchObject({ code: 'whatsapp_400_132001' });
    await expect(p).rejects.not.toThrow('secret-token');
  });
});
