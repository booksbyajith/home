import { randomBytes } from 'node:crypto';
import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { HASH_SALT, PUBLIC_CALLABLE, SMTP_SECRETS, TEAM_EMAILS, corsOrigins } from '../options.js';
import {
  requestStockAlertSchema,
  submitEnquirySchema,
  submitReviewSchema,
  subscribeNewsletterSchema,
  unsubscribeNewsletterSchema,
} from '../shared/schemas.js';
import { Timestamp, db } from '../lib/admin.js';
import { fail } from '../lib/errors.js';
import { clientIp, parse, requireAppCheck } from '../lib/guard.js';
import { hmac } from '../lib/hash.js';
import { log } from '../lib/log.js';
import { enforceRateLimit } from '../lib/rateLimit.js';
import { runSends } from '../notify/core.js';
import { teamEnquiry } from '../notify/emailTemplates.js';
import { channelsFor, firestoreLedger, runtimeSettings } from '../notify/runtime.js';

const CONSENT_TEXT = {
  si: 'නව පොත් සහ සිදුවීම් පිළිබඳ ඊමේල් ලැබීමට මම එකඟ වෙමි. ඕනෑම වේලාවක ඉවත් විය හැක.',
  en: 'I agree to receive emails about new books and events. I can unsubscribe at any time.',
  ta: 'புதிய புத்தகங்கள் மற்றும் நிகழ்வுகள் பற்றிய மின்னஞ்சல்களைப் பெற ஒப்புக்கொள்கிறேன். எப்போது வேண்டுமானாலும் விலகலாம்.',
};

async function guardPublic(request: CallableRequest<unknown>, scope: string) {
  requireAppCheck(request);
  await enforceRateLimit({ scope, id: clientIp(request), limit: 5, windowSec: 3600 });
}

async function bookExists(slug: string) {
  if (!(await db().collection('books').doc(slug).get()).exists) fail('not-found', 'NOT_FOUND');
}

export async function handleSubscribeNewsletter(request: CallableRequest<unknown>) {
  const input = parse(subscribeNewsletterSchema, request.data);
  await guardPublic(request, 'newsletter');
  const ref = db().collection('newsletter_subscribers').doc(hmac(input.email));
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && !snap.get('unsubscribedAt')) return;
    tx.set(ref, {
      email: input.email,
      lang: input.lang,
      consentAt: Timestamp.now(),
      consentText: CONSENT_TEXT[input.lang],
      source: input.source,
      unsubToken: randomBytes(32).toString('base64url'),
      unsubscribedAt: null,
    });
  });
  return { ok: true };
}

export async function handleUnsubscribeNewsletter(request: CallableRequest<unknown>) {
  const { token } = parse(unsubscribeNewsletterSchema, request.data);
  await guardPublic(request, 'unsubscribe');
  const snap = await db()
    .collection('newsletter_subscribers')
    .where('unsubToken', '==', token)
    .limit(1)
    .get();
  if (!snap.empty) await snap.docs[0].ref.update({ unsubscribedAt: Timestamp.now() });
  return { ok: true };
}

export async function handleRequestStockAlert(request: CallableRequest<unknown>) {
  const input = parse(requestStockAlertSchema, request.data);
  await guardPublic(request, 'stock-alert');
  await bookExists(input.slug);
  await db()
    .collection('stock_alerts')
    .add({
      slug: input.slug,
      contact: { whatsapp: input.whatsapp ?? null, email: input.email ?? null },
      lang: input.lang,
      createdAt: Timestamp.now(),
      notifiedAt: null,
    });
  return { ok: true };
}

export async function handleSubmitEnquiry(request: CallableRequest<unknown>) {
  const input = parse(submitEnquirySchema, request.data);
  await guardPublic(request, 'enquiry');
  const enquiry = {
    kind: input.kind,
    organisation: input.organisation,
    contactName: input.contactName,
    phone: input.phone,
    email: input.email ?? null,
    books: input.books,
    message: input.message ?? null,
    lang: input.lang,
  };
  const ref = await db()
    .collection('enquiries')
    .add({ ...enquiry, createdAt: Timestamp.now(), handledAt: null });
  try {
    const settings = await runtimeSettings();
    if (settings.teamEmails.length)
      await runSends(
        [
          {
            channel: 'email',
            role: 'team',
            run: (c) =>
              c.email(
                { to: settings.teamEmails, ...teamEnquiry(enquiry, settings.siteUrl) },
                { event: 'enquiry', role: 'team', enquiryId: ref.id },
              ),
          },
        ],
        { orderId: `enquiry|${ref.id}`, eventId: 'enquiry', event: 'enquiry' },
        channelsFor(settings),
        firestoreLedger(),
      );
  } catch {
    log.warn('enquiry email failed', { enquiryId: ref.id });
  }
  return { ok: true };
}

export async function handleSubmitReview(request: CallableRequest<unknown>) {
  const input = parse(submitReviewSchema, request.data);
  await guardPublic(request, 'review');
  await bookExists(input.slug);
  await db().collection('review_submissions').add({
    slug: input.slug,
    displayName: input.displayName,
    rating: input.rating,
    text: input.text,
    lang: input.lang,
    createdAt: Timestamp.now(),
    status: 'pending',
    moderatedAt: null,
    moderatedBy: null,
  });
  return { ok: true };
}

const opts = { ...PUBLIC_CALLABLE, cors: corsOrigins(), secrets: [HASH_SALT] };

export const subscribeNewsletter = onCall(opts, handleSubscribeNewsletter);
export const unsubscribeNewsletter = onCall(opts, handleUnsubscribeNewsletter);
export const requestStockAlert = onCall(opts, handleRequestStockAlert);
export const submitReview = onCall(opts, handleSubmitReview);
export const submitEnquiry = onCall(
  { ...opts, secrets: [HASH_SALT, ...SMTP_SECRETS, TEAM_EMAILS] },
  handleSubmitEnquiry,
);
