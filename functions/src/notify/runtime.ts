import {
  MAIL_FROM,
  SITE_URL,
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_USER,
  TEAM_EMAILS,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  WA_PHONE_NUMBER_ID,
  WA_TOKEN,
  isEmulator,
  isSet,
} from '../options.js';
import type { OrderDoc } from '../shared/types.js';
import { FieldValue, Timestamp, bucket, db } from '../lib/admin.js';
import { getPrivateConfig, getPublicConfig } from '../lib/config.js';
import { sha256 } from '../lib/hash.js';
import { errorCode, errorMessage, log } from '../lib/log.js';
import { templateVars } from '../lib/messages.js';
import type { NotifySettings, SendLedger } from './core.js';
import { sendEmail } from './email.js';
import { sendTelegram } from './telegram.js';
import type { Channels, EmailAttachment } from './types.js';
import { sendWhatsAppTemplate } from './whatsappCloud.js';

const secret = (p: { value(): string }) => {
  try {
    return p.value();
  } catch {
    return '';
  }
};

/** In the emulator every channel writes to dev_outbox instead of sending. */
export function outboxChannels(): Channels {
  const write = (channel: string, data: Record<string, unknown>, meta: Record<string, string>) =>
    db()
      .collection('dev_outbox')
      .add({ channel, ...data, meta, createdAt: FieldValue.serverTimestamp() })
      .then(() => log.info('dev_outbox', { channel, event: meta.event, orderId: meta.orderId }));
  return {
    email: (m, meta) =>
      write(
        'email',
        {
          to: m.to,
          subject: m.subject,
          html: m.html,
          text: m.text,
          attachments: (m.attachments ?? []).map((a) => ({
            filename: a.filename,
            sizeBytes: a.content.length,
            contentType: a.contentType,
          })),
        },
        meta,
      ),
    telegram: (text, meta) =>
      write('telegram', { to: 'team', subject: null, html: null, text, attachments: [] }, meta),
    whatsapp: (m, meta) =>
      write(
        'whatsapp_cloud',
        { to: m.to, subject: m.templateName, html: null, text: m.parameters.join(' | '), attachments: [] },
        { ...meta, languageCode: m.languageCode },
      ),
  };
}

export function realChannels(graphApiVersion: string): Channels {
  return {
    email: (m) =>
      sendEmail(
        {
          host: secret(SMTP_HOST),
          port: Number(secret(SMTP_PORT)) || 587,
          user: secret(SMTP_USER),
          pass: secret(SMTP_PASS),
          from: secret(MAIL_FROM),
        },
        m,
      ),
    telegram: (text) => sendTelegram(secret(TELEGRAM_BOT_TOKEN), secret(TELEGRAM_CHAT_ID), text),
    whatsapp: (m) =>
      sendWhatsAppTemplate(
        { token: secret(WA_TOKEN), phoneNumberId: secret(WA_PHONE_NUMBER_ID), graphApiVersion },
        m,
      ),
  };
}

export function firestoreLedger(): SendLedger {
  const ref = (key: string) => db().collection('notification_log').doc(sha256(key));
  return {
    async claim(key, info) {
      try {
        await ref(key).create({
          ...info,
          sentAt: Timestamp.now(),
          expiresAt: Timestamp.fromMillis(Date.now() + 90 * 86400 * 1000),
        });
        return true;
      } catch (err) {
        if ((err as { code?: number }).code === 6) return false; // ALREADY_EXISTS
        throw err;
      }
    },
    async release(key) {
      await ref(key).delete();
    },
    async recordFailure({ orderId, event, channel, err }) {
      log.warn('notification failed', { orderId, event, channel, code: errorCode(err) });
      await db()
        .collection('notification_failures')
        .add({
          orderId,
          event,
          channel,
          errorCode: errorCode(err),
          errorMessage: errorMessage(err),
          at: Timestamp.now(),
          attempt: 1,
        });
    },
  };
}

export async function loadSlip(order: OrderDoc): Promise<EmailAttachment | null> {
  if (!order.slip) return null;
  const [content] = await bucket().file(order.slip.path).download();
  const ext = order.slip.path.split('.').pop();
  return { filename: `slip-${order.orderId}.${ext}`, content, contentType: order.slip.contentType };
}

export async function runtimeSettings(): Promise<NotifySettings> {
  const [pub, priv] = await Promise.all([getPublicConfig(), getPrivateConfig()]);
  return {
    siteUrl: SITE_URL.value(),
    teamEmails: secret(TEAM_EMAILS)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    telegramEnabled: isSet(secret(TELEGRAM_BOT_TOKEN)) && isSet(secret(TELEGRAM_CHAT_ID)),
    whatsappEnabled: isSet(secret(WA_TOKEN)) && isSet(secret(WA_PHONE_NUMBER_ID)),
    pub,
    priv,
    templateVars: (o) => templateVars(o, pub),
    loadSlip,
  };
}

export function channelsFor(settings: NotifySettings): Channels {
  return isEmulator()
    ? outboxChannels()
    : realChannels(settings.priv.notifications.whatsappCloud.graphApiVersion);
}
