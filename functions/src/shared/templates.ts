import type { L10n, Lang, TemplateKey } from './types.js';

export const DEFAULT_TEMPLATES: Record<TemplateKey, L10n> = {
  acknowledged: {
    en: 'Thank you for ordering {bookTitles}, {name}! 🙏 Your order number is {orderId}. We will verify your bank transfer shortly and start preparing your book.',
    si: '{name}, {bookTitles} ඇණවුම් කිරීම ගැන ඔබට ස්තුතියි! 🙏 ඔබගේ ඇණවුම් අංකය {orderId}. අපි ඔබගේ බැංකු තැන්පතුව ඉක්මනින් තහවුරු කර පොත සූදානම් කිරීම අරඹන්නෙමු.',
  },
  payment_verified: {
    en: 'Your payment for order {orderId} has been verified ✅. We are now preparing your book for dispatch.',
    si: 'ඇණවුම් අංක {orderId} සඳහා ඔබගේ ගෙවීම තහවුරු විය ✅. අපි දැන් ඔබගේ පොත යැවීමට සූදානම් කරමින් සිටිමු.',
  },
  dispatched: {
    en: 'Good news! Your order {orderId} ({bookTitles}) has been posted via {courier}, tracking number {trackingNo}. You should receive it within 3 days. Track it here: {trackingUrl}. Follow our Facebook page for history stories: {facebookUrl}',
    si: 'සුබ ආරංචියක්! ඔබගේ ඇණවුම {orderId} ({bookTitles}) {courier} මගින් තැපැල් කර ඇත. ලුහුබැඳීමේ අංකය {trackingNo}. දින 3ක් ඇතුළත ඔබට ලැබෙනු ඇත. මෙතැනින් පරීක්ෂා කරන්න: {trackingUrl}. ඉතිහාස කතා සඳහා අපගේ Facebook පිටුව අනුගමනය කරන්න: {facebookUrl}',
  },
  rejected: {
    en: 'We could not verify the payment for order {orderId}: {reason}. Please reply to this message so we can help.',
    si: 'ඇණවුම් අංක {orderId} සඳහා ගෙවීම තහවුරු කිරීමට අපට නොහැකි විය: {reason}. කරුණාකර මෙම පණිවිඩයට පිළිතුරු දෙන්න, අපි ඔබට උදව් කරන්නෙමු.',
  },
  back_in_stock: {
    en: 'Good news! {bookTitles} is available again. Order here: {orderUrl}',
    si: 'සුබ ආරංචියක්! {bookTitles} නැවත ලබා ගත හැක. මෙතැනින් ඇණවුම් කරන්න: {orderUrl}',
  },
};

export const TEMPLATE_VARS = [
  'name',
  'orderId',
  'bookTitles',
  'total',
  'courier',
  'trackingNo',
  'trackingUrl',
  'facebookUrl',
  'reason',
  'orderUrl',
] as const;
export type TemplateVar = (typeof TEMPLATE_VARS)[number];

export function renderTemplate(template: string, vars: Partial<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? whole : String(v);
  });
}

export function bookTitles(items: { title: L10n }[], lang: Lang): string {
  return items.map((i) => i.title[lang] || i.title.en).join(', ');
}

export function buildWaUrl(number: string, text: string): string {
  const digits = number.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function buildMapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

export function buildTrackUrl(siteUrl: string, lang: Lang, orderId: string): string {
  return `${trimSlash(siteUrl)}${lang === 'en' ? '/en' : ''}/track/#${orderId}`;
}

export function buildOrderUrl(siteUrl: string, lang: Lang, slug?: string): string {
  return `${trimSlash(siteUrl)}${lang === 'en' ? '/en' : ''}/order/${slug ? `?book=${encodeURIComponent(slug)}` : ''}`;
}

export function buildCourierTrackingUrl(
  template: string | null | undefined,
  trackingNo: string,
): string | null {
  if (!template) return null;
  return template.replace('{trackingNo}', encodeURIComponent(trackingNo));
}
