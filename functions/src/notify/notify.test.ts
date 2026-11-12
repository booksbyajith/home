import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PRIVATE_CONFIG } from '../shared/defaults.js';
import { planSends, runSends, NotifyError, type SendLedger } from './core.js';
import { testOrder, testSettings } from './testOrder.fixture.js';
import type { Channels } from './types.js';

function fakeChannels(failOn?: 'email' | 'telegram') {
  const sent: { channel: string; to: unknown; subject?: string; attachments?: number; text?: string }[] = [];
  const c: Channels = {
    email: async (m) => {
      if (failOn === 'email')
        throw Object.assign(new Error('smtp down for customer@example.com'), { code: 'ECONN' });
      sent.push({ channel: 'email', to: m.to, subject: m.subject, attachments: m.attachments?.length ?? 0 });
    },
    telegram: async (text) => {
      if (failOn === 'telegram') throw new Error('tg');
      sent.push({ channel: 'telegram', to: 'team', text });
    },
    whatsapp: async (m) => {
      sent.push({ channel: 'whatsapp_cloud', to: m.to, text: m.parameters.join('|') });
    },
  };
  return { c, sent };
}

function memoryLedger(): SendLedger & { keys: Set<string>; failures: unknown[] } {
  const keys = new Set<string>();
  const failures: unknown[] = [];
  return {
    keys,
    failures,
    claim: async (k) => (keys.has(k) ? false : (keys.add(k), true)),
    release: async (k) => void keys.delete(k),
    recordFailure: async (f) => void failures.push(f),
  };
}

const ctx = { orderId: 'AJ-2611-7K3Q', eventId: 'e1', event: 'new_order' };
const newOrder = { eventId: 'e1', from: null, to: 'pending_verification' as const };

describe('planSends', () => {
  it('new order: team email with slip, customer confirmation, telegram', async () => {
    const { c, sent } = fakeChannels();
    await runSends(planSends(testOrder(), newOrder, testSettings()), ctx, c, memoryLedger());
    expect(sent.map((s) => `${s.channel}:${JSON.stringify(s.to)}`)).toEqual([
      'email:["team@example.com"]',
      'email:["customer@example.com"]',
      'telegram:"team"',
    ]);
    expect(sent[0].attachments).toBe(1);
    expect(sent[1].attachments).toBe(0);
  });

  it('no customer email when none was given', () => {
    const sends = planSends(
      testOrder({ customer: { name: 'A', mobile: '94770000001', whatsapp: '94770000001', email: null } }),
      newOrder,
      testSettings(),
    );
    expect(sends.map((s) => s.role)).toEqual(['team', 'team']);
  });

  it('telegram skipped when disabled', () => {
    expect(
      planSends(testOrder(), newOrder, testSettings({ telegramEnabled: false })).map((s) => s.channel),
    ).toEqual(['email', 'email']);
  });

  it.each(['payment_verified', 'dispatched', 'rejected'] as const)('%s emails the customer', (to) => {
    const sends = planSends(
      testOrder({ status: to }),
      { eventId: 'e', from: 'acknowledged', to },
      testSettings(),
    );
    expect(sends.map((s) => `${s.channel}/${s.role}`)).toEqual(['email/customer']);
  });

  it.each(['acknowledged', 'delivered', 'cancelled'] as const)('%s sends no email', (to) => {
    expect(
      planSends(
        testOrder({ status: to }),
        { eventId: 'e', from: 'pending_verification', to },
        testSettings(),
      ),
    ).toEqual([]);
  });

  it('reopen sends nothing', () => {
    expect(
      planSends(testOrder(), { eventId: 'e', from: 'rejected', to: 'pending_verification' }, testSettings()),
    ).toEqual([]);
  });

  it('customer emails can be switched off', () => {
    const priv = {
      ...DEFAULT_PRIVATE_CONFIG,
      notifications: { ...DEFAULT_PRIVATE_CONFIG.notifications, customerEmails: false },
    };
    expect(
      planSends(
        testOrder(),
        { eventId: 'e', from: 'acknowledged', to: 'payment_verified' },
        testSettings({ priv }),
      ),
    ).toEqual([]);
  });

  it('WhatsApp Cloud only when secrets and flag are on and a template name is set', async () => {
    const wa = DEFAULT_PRIVATE_CONFIG.notifications.whatsappCloud;
    const on = {
      ...DEFAULT_PRIVATE_CONFIG,
      notifications: {
        ...DEFAULT_PRIVATE_CONFIG.notifications,
        whatsappCloud: {
          ...wa,
          enabled: true,
          templateNames: { ...wa.templateNames, acknowledged: 'order_ack' },
        },
      },
    };
    const e = { eventId: 'e', from: 'pending_verification' as const, to: 'acknowledged' as const };
    expect(planSends(testOrder(), e, testSettings({ priv: on, whatsappEnabled: false }))).toEqual([]);
    expect(
      planSends(testOrder(), e, testSettings({ priv: DEFAULT_PRIVATE_CONFIG, whatsappEnabled: true })),
    ).toEqual([]);
    const sends = planSends(testOrder(), e, testSettings({ priv: on, whatsappEnabled: true }));
    expect(sends.map((s) => s.channel)).toEqual(['whatsapp_cloud']);
    const { c, sent } = fakeChannels();
    await runSends(sends, ctx, c, memoryLedger());
    expect(sent[0]).toEqual({
      channel: 'whatsapp_cloud',
      to: '94770000001',
      text: 'Test Customer|AJ-2611-7K3Q|ලංකාවේ පෘතුගීසි සිටි යුගය',
    });
  });
});

describe('runSends idempotency', () => {
  it('a second run with the same event id sends nothing', async () => {
    const ledger = memoryLedger();
    const { c, sent } = fakeChannels();
    const sends = planSends(testOrder(), newOrder, testSettings());
    expect(await runSends(sends, ctx, c, ledger)).toEqual({ sent: 3, skipped: 0, failed: 0 });
    expect(await runSends(sends, ctx, c, ledger)).toEqual({ sent: 0, skipped: 3, failed: 0 });
    expect(sent).toHaveLength(3);
  });

  it('a failed send is recorded, released and retried alone', async () => {
    const ledger = memoryLedger();
    const sends = planSends(testOrder(), newOrder, testSettings());
    const first = fakeChannels('telegram');
    await expect(runSends(sends, ctx, first.c, ledger)).rejects.toBeInstanceOf(NotifyError);
    expect(first.sent).toHaveLength(2);
    expect(ledger.failures).toHaveLength(1);
    const retry = fakeChannels();
    expect(await runSends(sends, ctx, retry.c, ledger)).toEqual({ sent: 1, skipped: 2, failed: 0 });
    expect(retry.sent.map((s) => s.channel)).toEqual(['telegram']);
  });
});

describe('emulator transport', () => {
  it('outbox channels never open SMTP or call fetch', async () => {
    const added: unknown[] = [];
    vi.resetModules();
    vi.doMock('../lib/admin.js', () => ({
      db: () => ({ collection: () => ({ add: async (d: unknown) => void added.push(d) }) }),
      FieldValue: { serverTimestamp: () => 'ts' },
      Timestamp: { now: () => 'now', fromMillis: () => 'ms' },
      bucket: () => ({}),
    }));
    const createTransport = vi.fn();
    vi.doMock('nodemailer', () => ({ default: { createTransport }, createTransport }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { outboxChannels } = await import('./runtime.js');
    const sends = planSends(testOrder(), newOrder, testSettings());
    await runSends(sends, ctx, outboxChannels(), memoryLedger());
    expect(added).toHaveLength(3);
    expect(createTransport).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    vi.doUnmock('../lib/admin.js');
    vi.doUnmock('nodemailer');
  });
});
