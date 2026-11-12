import { districtName } from '../shared/districts.js';
import { l10nText } from '../shared/l10n.js';
import { formatLKR } from '../shared/pricing.js';
import { bookTitles, buildOrderUrl, buildTrackUrl } from '../shared/templates.js';
import type { Lang, L10n, OrderDoc } from '../shared/types.js';
import { button, esc, layout, table } from './html.js';
import type { EmailContent } from './types.js';

const T = {
  si: {
    siteName: 'අජිත් අමරසිංහ පොත්',
    footer: 'මෙය ස්වයංක්‍රීය පණිවිඩයකි. ප්‍රශ්න ඇත්නම් WhatsApp හරහා අප අමතන්න.',
    orderId: 'ඇණවුම් අංකය',
    items: 'පොත්',
    total: 'මුළු මුදල',
    track: 'ඇණවුම පරීක්ෂා කරන්න',
    confirmSubject: 'ඔබගේ ඇණවුම ලැබුණා',
    confirmBody: 'ඔබගේ ඇණවුමට ස්තුතියි. අපි ඔබගේ බැංකු ගෙවීම පරීක්ෂා කර ඉක්මනින් ඔබට දැනුම් දෙන්නෙමු.',
    verifiedSubject: 'ගෙවීම තහවුරු විය',
    verifiedBody: 'ඔබගේ ගෙවීම තහවුරු විය. අපි දැන් ඔබගේ පොත යැවීමට සූදානම් කරමින් සිටිමු.',
    dispatchedSubject: 'ඔබගේ පොත යවා ඇත',
    dispatchedBody: 'ඔබගේ ඇණවුම තැපැල් කර ඇත.',
    courier: 'කුරියර් සේවය',
    trackingNo: 'ලුහුබැඳීමේ අංකය',
    rejectedSubject: 'ගෙවීම තහවුරු කළ නොහැකි විය',
    rejectedBody: 'ඔබගේ ගෙවීම තහවුරු කිරීමට අපට නොහැකි විය.',
    reason: 'හේතුව',
    reply: 'කරුණාකර WhatsApp හරහා අප අමතන්න, අපි ඔබට උදව් කරන්නෙමු.',
    hello: 'ආයුබෝවන්',
    backSubject: 'පොත නැවත ලබා ගත හැක',
    backBody: 'ඔබ ඉල්ලූ පොත දැන් නැවත ඇණවුම් කළ හැක:',
    orderNow: 'දැන් ඇණවුම් කරන්න',
  },
  en: {
    siteName: 'Books by Ajith Amarasinghe',
    footer: 'This is an automatic message. If you have questions, contact us on WhatsApp.',
    orderId: 'Order number',
    items: 'Books',
    total: 'Total',
    track: 'Track your order',
    confirmSubject: 'We received your order',
    confirmBody: 'Thank you for your order. We will check your bank transfer and let you know shortly.',
    verifiedSubject: 'Payment verified',
    verifiedBody: 'Your payment has been verified. We are now preparing your book for dispatch.',
    dispatchedSubject: 'Your book is on its way',
    dispatchedBody: 'Your order has been posted.',
    courier: 'Courier',
    trackingNo: 'Tracking number',
    rejectedSubject: 'We could not verify your payment',
    rejectedBody: 'We could not verify the payment for your order.',
    reason: 'Reason',
    reply: 'Please contact us on WhatsApp so we can help.',
    hello: 'Hello',
    backSubject: 'The book is available again',
    backBody: 'The book you asked about can be ordered again:',
    orderNow: 'Order now',
  },
  ta: {
    siteName: 'வைத்தியர் அஜித் அமரசிங்க புத்தகங்கள்',
    footer: 'இது ஒரு தானியங்கிச் செய்தி. கேள்விகள் இருந்தால் WhatsApp மூலம் எங்களைத் தொடர்பு கொள்ளுங்கள்.',
    orderId: 'ஆர்டர் எண்',
    items: 'புத்தகங்கள்',
    total: 'மொத்தம்',
    track: 'உங்கள் ஆர்டரைக் கண்காணிக்கவும்',
    confirmSubject: 'உங்கள் ஆர்டர் கிடைத்தது',
    confirmBody: 'உங்கள் ஆர்டருக்கு நன்றி. உங்கள் வங்கிப் பரிமாற்றத்தைச் சரிபார்த்து விரைவில் உங்களுக்குத் தெரிவிப்போம்.',
    verifiedSubject: 'கட்டணம் சரிபார்க்கப்பட்டது',
    verifiedBody: 'உங்கள் கட்டணம் சரிபார்க்கப்பட்டது. உங்கள் புத்தகத்தை அனுப்புவதற்குத் தயார் செய்து வருகிறோம்.',
    dispatchedSubject: 'உங்கள் புத்தகம் அனுப்பப்பட்டது',
    dispatchedBody: 'உங்கள் ஆர்டர் அனுப்பப்பட்டுள்ளது.',
    courier: 'கூரியர் சேவை',
    trackingNo: 'கண்காணிப்பு எண்',
    rejectedSubject: 'உங்கள் கட்டணத்தைச் சரிபார்க்க முடியவில்லை',
    rejectedBody: 'உங்கள் ஆர்டருக்கான கட்டணத்தைச் சரிபார்க்க முடியவில்லை.',
    reason: 'காரணம்',
    reply: 'உதவுவதற்கு WhatsApp மூலம் எங்களைத் தொடர்பு கொள்ளுங்கள்.',
    hello: 'வணக்கம்',
    backSubject: 'புத்தகம் மீண்டும் கிடைக்கிறது',
    backBody: 'நீங்கள் கேட்ட புத்தகத்தை இப்போது மீண்டும் ஆர்டர் செய்யலாம்:',
    orderNow: 'இப்போதே ஆர்டர் செய்யுங்கள்',
  },
} as const;

function itemsHtml(order: OrderDoc, lang: Lang): string {
  return order.items
    .map((i) => `${esc(l10nText(i.title, lang))} × ${i.qty} — ${esc(formatLKR(i.lineTotalLKR))}`)
    .join('<br>');
}

function itemsText(order: OrderDoc, lang: Lang): string {
  return order.items
    .map((i) => `- ${l10nText(i.title, lang)} x ${i.qty}: ${formatLKR(i.lineTotalLKR)}`)
    .join('\n');
}

function customerEmail(
  order: OrderDoc,
  siteUrl: string,
  subjectKey: 'confirmSubject' | 'verifiedSubject' | 'dispatchedSubject' | 'rejectedSubject',
  intro: string,
  extraRows: [string, string][] = [],
  outro = '',
): EmailContent {
  const lang = order.lang;
  const t = T[lang];
  const trackUrl = buildTrackUrl(siteUrl, lang, order.orderId);
  const subject = `${t[subjectKey]} — ${order.orderId}`;
  const rows: [string, string][] = [
    [t.orderId, `<strong>${esc(order.orderId)}</strong>`],
    [t.items, itemsHtml(order, lang)],
    [t.total, esc(formatLKR(order.totals.grandTotalLKR))],
    ...extraRows.map(([k, v]) => [k, esc(v)] as [string, string]),
  ];
  const html = layout(
    lang,
    t[subjectKey],
    `<p>${esc(t.hello)} ${esc(order.customer.name)},</p><p>${esc(intro)}</p>${table(rows)}${outro ? `<p>${esc(outro)}</p>` : ''}${button(trackUrl, t.track)}`,
    `${esc(t.siteName)} · ${esc(t.footer)}`,
  );
  const text = [
    `${t.hello} ${order.customer.name},`,
    '',
    intro,
    '',
    `${t.orderId}: ${order.orderId}`,
    itemsText(order, lang),
    `${t.total}: ${formatLKR(order.totals.grandTotalLKR)}`,
    ...extraRows.map(([k, v]) => `${k}: ${v}`),
    outro,
    '',
    `${t.track}: ${trackUrl}`,
    '',
    t.footer,
  ].join('\n');
  return { subject, html, text };
}

export const customerConfirmation = (order: OrderDoc, siteUrl: string) =>
  customerEmail(order, siteUrl, 'confirmSubject', T[order.lang].confirmBody);

export const customerVerified = (order: OrderDoc, siteUrl: string) =>
  customerEmail(order, siteUrl, 'verifiedSubject', T[order.lang].verifiedBody);

export const customerDispatched = (order: OrderDoc, siteUrl: string) => {
  const t = T[order.lang];
  return customerEmail(order, siteUrl, 'dispatchedSubject', t.dispatchedBody, [
    [t.courier, order.dispatch?.courier ?? ''],
    [t.trackingNo, order.dispatch?.trackingNo ?? ''],
  ]);
};

export const customerRejected = (order: OrderDoc, siteUrl: string) => {
  const t = T[order.lang];
  return customerEmail(
    order,
    siteUrl,
    'rejectedSubject',
    t.rejectedBody,
    [[t.reason, order.rejection?.reason ?? '']],
    t.reply,
  );
};

/** Team emails are in English, with Sinhala book titles alongside. */
export function teamNewOrder(order: OrderDoc, siteUrl: string): EmailContent {
  const adminUrl = `${siteUrl.replace(/\/+$/, '')}/admin/#/orders/${order.orderId}`;
  const a = order.address;
  const address = [
    a.line1,
    a.line2,
    a.city,
    `${districtName(a.districtId, 'en')} ${a.postalCode}`,
    a.landmark,
  ]
    .filter(Boolean)
    .join(', ');
  const titles = order.items.map((i) => `${i.title.en} / ${i.title.si} × ${i.qty}`);
  const t = order.totals;
  const rows: [string, string][] = [
    ['Order', `<strong>${esc(order.orderId)}</strong>`],
    ['Books', titles.map(esc).join('<br>')],
    ['Subtotal', esc(formatLKR(t.subtotalLKR))],
    ['Bundle discount', esc(formatLKR(t.bundleDiscountLKR))],
    ['Signed copy', esc(formatLKR(t.signedSurchargeLKR))],
    ['Delivery', esc(formatLKR(t.deliveryFeeLKR))],
    [
      'Total',
      `<strong>${esc(formatLKR(t.grandTotalLKR))}</strong>${order.totalMismatch ? ' ⚠ customer saw ' + esc(formatLKR(order.clientExpectedTotalLKR)) : ''}`,
    ],
    ['Name', esc(order.customer.name)],
    ['Mobile', esc(order.customer.mobile)],
    ['WhatsApp', esc(order.customer.whatsapp)],
    ['Email', esc(order.customer.email ?? '—')],
    ['Address', esc(address)],
    [
      'Location',
      order.geo
        ? `<a href="https://maps.google.com/?q=${order.geo.lat},${order.geo.lng}">Google Maps</a>`
        : '—',
    ],
    ['Signed copy requested', order.signedCopy ? 'Yes' : 'No'],
    ['Dedication / gift note', esc(order.dedicationNote ?? '—')],
    ['Language', order.lang === 'si' ? 'Sinhala' : 'English'],
  ];
  const html = layout(
    'en',
    `New order ${order.orderId}`,
    `<p>A new order is waiting for payment verification. The bank slip is attached.</p>${table(rows)}${button(adminUrl, 'Open in admin')}`,
    'Internal notification.',
  );
  const text = [
    `New order ${order.orderId} — waiting for payment verification. Bank slip attached.`,
    '',
    ...titles,
    `Total: ${formatLKR(t.grandTotalLKR)}${order.totalMismatch ? ` (customer saw ${formatLKR(order.clientExpectedTotalLKR)})` : ''}`,
    `Name: ${order.customer.name}`,
    `Mobile: ${order.customer.mobile}`,
    `WhatsApp: ${order.customer.whatsapp}`,
    `Email: ${order.customer.email ?? '-'}`,
    `Address: ${address}`,
    `Signed copy: ${order.signedCopy ? 'yes' : 'no'}`,
    `Dedication: ${order.dedicationNote ?? '-'}`,
    '',
    `Admin: ${adminUrl}`,
  ].join('\n');
  return { subject: `New order ${order.orderId} — ${formatLKR(t.grandTotalLKR)}`, html, text };
}

export interface EnquiryForEmail {
  kind: string;
  organisation: string;
  contactName: string;
  phone: string;
  email: string | null;
  books: { slug: string; qty: number }[];
  message: string | null;
  lang: Lang;
}

export function teamEnquiry(e: EnquiryForEmail, siteUrl: string): EmailContent {
  const adminUrl = `${siteUrl.replace(/\/+$/, '')}/admin/#/enquiries`;
  const rows: [string, string][] = [
    ['Type', esc(e.kind)],
    ['Organisation', esc(e.organisation)],
    ['Contact', esc(e.contactName)],
    ['Phone', esc(e.phone)],
    ['Email', esc(e.email ?? '—')],
    ['Books', e.books.map((b) => `${esc(b.slug)} × ${b.qty}`).join('<br>')],
    ['Message', esc(e.message ?? '—')],
  ];
  return {
    subject: `Bulk enquiry: ${e.organisation}`,
    html: layout(
      'en',
      'New bulk / institutional enquiry',
      `${table(rows)}${button(adminUrl, 'Open enquiries')}`,
      'Internal notification.',
    ),
    text: [
      `Bulk enquiry from ${e.organisation} (${e.kind})`,
      `Contact: ${e.contactName}, ${e.phone}, ${e.email ?? '-'}`,
      ...e.books.map((b) => `${b.slug} x ${b.qty}`),
      e.message ?? '',
      adminUrl,
    ].join('\n'),
  };
}

export function backInStock(title: L10n, slug: string, lang: Lang, siteUrl: string): EmailContent {
  const t = T[lang];
  const url = buildOrderUrl(siteUrl, lang, slug);
  const name = l10nText(title, lang);
  return {
    subject: `${t.backSubject}: ${name}`,
    html: layout(
      lang,
      t.backSubject,
      `<p>${esc(t.backBody)} <strong>${esc(name)}</strong></p>${button(url, t.orderNow)}`,
      `${esc(t.siteName)} · ${esc(t.footer)}`,
    ),
    text: `${t.backBody} ${name}\n${url}\n\n${t.footer}`,
  };
}

export { bookTitles };
