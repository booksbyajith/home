import { l10nText } from './l10n.js';
import type { L10n, Lang, TemplateKey } from './types.js';

export const DEFAULT_TEMPLATES: Record<TemplateKey, L10n> = {
  acknowledged: {
    en: 'Thank you for ordering {bookTitles}, {name}! 🙏 Your order number is {orderId}. We will verify your bank transfer shortly and start preparing your book.',
    si: '{name}, {bookTitles} ඇණවුම් කිරීම ගැන ඔබට ස්තුතියි! 🙏 ඔබගේ ඇණවුම් අංකය {orderId}. අපි ඔබගේ බැංකු තැන්පතුව ඉක්මනින් තහවුරු කර පොත සූදානම් කිරීම අරඹන්නෙමු.',
    ta: '{bookTitles} ஆர்டர் செய்ததற்கு நன்றி, {name}! 🙏 உங்கள் ஆர்டர் எண் {orderId}. உங்கள் வங்கிப் பரிமாற்றத்தை விரைவில் சரிபார்த்து, புத்தகத்தைத் தயார் செய்யத் தொடங்குவோம்.',
  },
  payment_verified: {
    en: 'Your payment for order {orderId} has been verified ✅. We are now preparing your book for dispatch.',
    si: 'ඇණවුම් අංක {orderId} සඳහා ඔබගේ ගෙවීම තහවුරු විය ✅. අපි දැන් ඔබගේ පොත යැවීමට සූදානම් කරමින් සිටිමු.',
    ta: 'ஆர்டர் {orderId} க்கான உங்கள் கட்டணம் சரிபார்க்கப்பட்டது ✅. உங்கள் புத்தகத்தை அனுப்புவதற்குத் தயார் செய்து வருகிறோம்.',
  },
  dispatched: {
    en: 'Good news! Your order {orderId} ({bookTitles}) has been posted via {courier}, tracking number {trackingNo}. You should receive it within 3 days. Track it here: {trackingUrl}. Follow our Facebook page for history stories: {facebookUrl}',
    si: 'සුබ ආරංචියක්! ඔබගේ ඇණවුම {orderId} ({bookTitles}) {courier} මගින් තැපැල් කර ඇත. ලුහුබැඳීමේ අංකය {trackingNo}. දින 3ක් ඇතුළත ඔබට ලැබෙනු ඇත. මෙතැනින් පරීක්ෂා කරන්න: {trackingUrl}. ඉතිහාස කතා සඳහා අපගේ Facebook පිටුව අනුගමනය කරන්න: {facebookUrl}',
    ta: 'நல்ல செய்தி! உங்கள் ஆர்டர் {orderId} ({bookTitles}) {courier} மூலம் அனுப்பப்பட்டது, கண்காணிப்பு எண் {trackingNo}. 3 நாட்களுக்குள் உங்களுக்குக் கிடைக்கும். இங்கே கண்காணிக்கவும்: {trackingUrl}. வரலாற்றுக் கதைகளுக்கு எங்கள் Facebook பக்கத்தைப் பின்தொடருங்கள்: {facebookUrl}',
  },
  rejected: {
    en: 'We could not verify the payment for order {orderId}: {reason}. Please reply to this message so we can help.',
    si: 'ඇණවුම් අංක {orderId} සඳහා ගෙවීම තහවුරු කිරීමට අපට නොහැකි විය: {reason}. කරුණාකර මෙම පණිවිඩයට පිළිතුරු දෙන්න, අපි ඔබට උදව් කරන්නෙමු.',
    ta: 'ஆர்டர் {orderId} க்கான கட்டணத்தைச் சரிபார்க்க முடியவில்லை: {reason}. உதவுவதற்கு இந்தச் செய்திக்குப் பதிலளிக்கவும்.',
  },
  back_in_stock: {
    en: 'Good news! {bookTitles} is available again. Order here: {orderUrl}',
    si: 'සුබ ආරංචියක්! {bookTitles} නැවත ලබා ගත හැක. මෙතැනින් ඇණවුම් කරන්න: {orderUrl}',
    ta: 'நல்ல செய்தி! {bookTitles} மீண்டும் கிடைக்கிறது. இங்கே ஆர்டர் செய்யுங்கள்: {orderUrl}',
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
  return items.map((i) => l10nText(i.title, lang)).join(', ');
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
  return `${trimSlash(siteUrl)}${lang === 'si' ? '' : `/${lang}`}/track/#${orderId}`;
}

export function buildOrderUrl(siteUrl: string, lang: Lang, slug?: string): string {
  return `${trimSlash(siteUrl)}${lang === 'si' ? '' : `/${lang}`}/order/${slug ? `?book=${encodeURIComponent(slug)}` : ''}`;
}

export function buildCourierTrackingUrl(
  template: string | null | undefined,
  trackingNo: string,
): string | null {
  if (!template) return null;
  return template.replace('{trackingNo}', encodeURIComponent(trackingNo));
}
