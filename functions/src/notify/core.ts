import { customerEmailFor } from '../shared/status.js';
import type { OrderDoc, OrderStatus, PrivateConfig, PublicConfig, WaEvent } from '../shared/types.js';
import {
  customerConfirmation,
  customerDispatched,
  customerRejected,
  customerVerified,
  teamNewOrder,
} from './emailTemplates.js';
import { telegramNewOrderText } from './telegram.js';
import type { ChannelName, Channels, EmailAttachment, Role } from './types.js';
import { waTemplateMessage } from './whatsappCloud.js';

export interface NotifyEvent {
  eventId: string;
  from: OrderStatus | null;
  to: OrderStatus;
}

export interface NotifySettings {
  siteUrl: string;
  teamEmails: string[];
  telegramEnabled: boolean;
  whatsappEnabled: boolean;
  pub: PublicConfig;
  priv: PrivateConfig;
  templateVars: (order: OrderDoc) => Record<string, string>;
  loadSlip: (order: OrderDoc) => Promise<EmailAttachment | null>;
}

export interface Send {
  channel: ChannelName;
  role: Role;
  run: (channels: Channels) => Promise<void>;
}

export function eventName(e: NotifyEvent): string {
  return e.from === null && e.to === 'pending_verification' ? 'new_order' : e.to;
}

export function planSends(order: OrderDoc, e: NotifyEvent, s: NotifySettings): Send[] {
  const sends: Send[] = [];
  const meta = { orderId: order.orderId, event: eventName(e) };
  const customerEmail = order.customer.email;

  if (e.from === null && e.to === 'pending_verification') {
    if (s.teamEmails.length)
      sends.push({
        channel: 'email',
        role: 'team',
        run: async (c) => {
          const slip = await s.loadSlip(order);
          await c.email(
            { to: s.teamEmails, ...teamNewOrder(order, s.siteUrl), attachments: slip ? [slip] : [] },
            { ...meta, role: 'team' },
          );
        },
      });
    if (customerEmail)
      sends.push({
        channel: 'email',
        role: 'customer',
        run: (c) =>
          c.email(
            { to: [customerEmail], ...customerConfirmation(order, s.siteUrl) },
            { ...meta, role: 'customer' },
          ),
      });
    if (s.telegramEnabled)
      sends.push({
        channel: 'telegram',
        role: 'team',
        run: (c) => c.telegram(telegramNewOrderText(order), { ...meta, role: 'team' }),
      });
    return sends;
  }

  if (customerEmail && s.priv.notifications.customerEmails && customerEmailFor(e.to)) {
    const tpl =
      e.to === 'payment_verified'
        ? customerVerified
        : e.to === 'dispatched'
          ? customerDispatched
          : customerRejected;
    sends.push({
      channel: 'email',
      role: 'customer',
      run: (c) => c.email({ to: [customerEmail], ...tpl(order, s.siteUrl) }, { ...meta, role: 'customer' }),
    });
  }

  const waEvents: OrderStatus[] = ['acknowledged', 'payment_verified', 'dispatched', 'rejected'];
  const wa = s.priv.notifications.whatsappCloud;
  if (s.whatsappEnabled && wa.enabled && waEvents.includes(e.to) && order.customer.whatsapp) {
    const ev = e.to as WaEvent;
    const name = wa.templateNames[ev];
    if (name)
      sends.push({
        channel: 'whatsapp_cloud',
        role: 'customer',
        run: (c) =>
          c.whatsapp(
            waTemplateMessage(order, ev, name, wa.languageCodes[order.lang], s.templateVars(order)),
            {
              ...meta,
              role: 'customer',
            },
          ),
      });
  }
  return sends;
}

export interface SendLedger {
  /** Returns true when this key was not claimed before (i.e. the send should happen). */
  claim(key: string, info: { orderId: string; event: string; channel: ChannelName }): Promise<boolean>;
  release(key: string): Promise<void>;
  recordFailure(f: { orderId: string; event: string; channel: ChannelName; err: unknown }): Promise<void>;
}

export class NotifyError extends Error {
  constructor(public failed: number) {
    super(`${failed} notification(s) failed`);
  }
}

/** Run each send at most once per (order, event, channel, role). Throws after all sends if any failed. */
export async function runSends(
  sends: Send[],
  ctx: { orderId: string; eventId: string; event: string },
  channels: Channels,
  ledger: SendLedger,
): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const s of sends) {
    const key = `${ctx.orderId}|${ctx.eventId}|${s.channel}|${s.role}`;
    if (!(await ledger.claim(key, { orderId: ctx.orderId, event: ctx.event, channel: s.channel }))) {
      skipped++;
      continue;
    }
    try {
      await s.run(channels);
      sent++;
    } catch (err) {
      failed++;
      await ledger.release(key);
      await ledger.recordFailure({ orderId: ctx.orderId, event: ctx.event, channel: s.channel, err });
    }
  }
  if (failed) throw new NotifyError(failed);
  return { sent, skipped, failed };
}
