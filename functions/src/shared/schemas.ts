import { z } from 'zod';
import {
  LANGS,
  MAX_ORDER_LINES,
  MAX_QTY_PER_BOOK,
  MAX_TOTAL_QTY,
  ORDER_ID_REGEX,
  SLIP_MAX_BYTES,
} from './constants.js';
import { OVERSEAS, isDeliveryArea, isDistrictId } from './districts.js';
import { normaliseLkMobile, normaliseWhatsApp } from './phone.js';
import { ORDER_STATUSES, SALE_MODES, TEMPLATE_KEYS, WA_EVENTS } from './types.js';

// ---------- building blocks ----------

export const langSchema = z.enum(LANGS);
export const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]{1,80}$/);
export const orderIdSchema = z.string().trim().toUpperCase().regex(ORDER_ID_REGEX);

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https:\/\//i.test(v) && URL.canParse(v), { message: 'https_url' });

export const lkMobileSchema = z.string().transform((v, ctx) => {
  const n = normaliseLkMobile(v);
  if (!n) {
    ctx.addIssue({ code: 'custom', message: 'mobile' });
    return z.NEVER;
  }
  return n;
});

export const whatsappSchema = z.string().transform((v, ctx) => {
  const n = normaliseWhatsApp(v);
  if (!n) {
    ctx.addIssue({ code: 'custom', message: 'whatsapp' });
    return z.NEVER;
  }
  return n;
});

export const emailSchema = z.string().trim().toLowerCase().max(120).pipe(z.email());
const optEmail = z
  .union([z.literal(''), emailSchema])
  .optional()
  .transform((v) => (v ? v : undefined));

const l10n = (max: number) =>
  z.strictObject({
    si: z.string().trim().max(max),
    en: z.string().trim().max(max),
    ta: z.string().trim().max(max).optional(),
  });
const int = (min: number, max: number) => z.number().int().min(min).max(max);

// ---------- order form (shared with the site) ----------

// Mobile: a Sri Lankan mobile, or an international number for overseas deliveries
// (createOrderSchema / domesticMobileError check which one applies).
export const orderCustomerSchema = z.object({
  name: text(2, 80),
  mobile: z.string().transform((v, ctx) => {
    const n = normaliseWhatsApp(v);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'mobile' });
      return z.NEVER;
    }
    return n;
  }),
  whatsapp: whatsappSchema,
  email: optEmail,
});

export const orderAddressSchema = z
  .object({
    line1: text(3, 120),
    line2: optText(120),
    city: text(2, 60),
    districtId: z.string().refine(isDeliveryArea, { message: 'district' }),
    // Sri Lanka: 5 digits. Overseas: any common postal/ZIP format.
    postalCode: z.string().trim().max(12),
    country: optText(60),
    landmark: optText(200),
  })
  .superRefine((a, ctx) => {
    const overseas = a.districtId === OVERSEAS;
    const ok = overseas
      ? /^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/.test(a.postalCode)
      : /^\d{5}$/.test(a.postalCode);
    if (!ok) ctx.addIssue({ code: 'custom', message: 'postalCode', path: ['postalCode'] });
    if (overseas && (a.country ?? '').length < 2)
      ctx.addIssue({ code: 'custom', message: 'country', path: ['country'] });
  });

/** Deliveries in Sri Lanka need a Sri Lankan mobile (for the courier). */
export function domesticMobileError(districtId: string, normalisedMobile: string): boolean {
  return districtId !== OVERSEAS && !/^947\d{8}$/.test(normalisedMobile);
}

export const geoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(100000),
  capturedAt: z.number().int().positive(),
});

export const cartItemSchema = z.object({ slug: slugSchema, qty: int(1, MAX_QTY_PER_BOOK) });

const MAX_BASE64 = Math.ceil((SLIP_MAX_BYTES * 4) / 3) + 1024;

export const createOrderSchema = z
  .object({
    lang: langSchema,
    items: z
      .array(cartItemSchema)
      .min(1)
      .max(MAX_ORDER_LINES)
      .refine((a) => new Set(a.map((i) => i.slug)).size === a.length, { message: 'duplicate_slug' })
      .refine((a) => a.reduce((n, i) => n + i.qty, 0) <= MAX_TOTAL_QTY, { message: 'too_many' }),
    customer: orderCustomerSchema,
    address: orderAddressSchema,
    geo: geoSchema.optional().nullable(),
    signedCopy: z.boolean(),
    dedicationNote: optText(300),
    expectedTotalLKR: int(0, 100_000_000),
    slip: z.object({
      fileName: z.string().trim().min(1).max(200),
      contentType: z.string().trim().max(100),
      dataBase64: z.string().min(8).max(MAX_BASE64),
    }),
    consent: z.literal(true),
  })
  .superRefine((o, ctx) => {
    if (domesticMobileError(o.address.districtId, o.customer.mobile))
      ctx.addIssue({ code: 'custom', message: 'mobile', path: ['customer', 'mobile'] });
  });
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const trackOrderSchema = z.object({
  orderId: orderIdSchema,
  phoneLast4: z
    .string()
    .trim()
    .regex(/^\d{4}$/),
});
export type TrackOrderInput = z.infer<typeof trackOrderSchema>;

// ---------- admin callables ----------

export const orderStatusSchema = z.enum(ORDER_STATUSES);

export const updateOrderStatusSchema = z.object({
  orderId: orderIdSchema,
  to: orderStatusSchema,
  courier: optText(60),
  trackingNo: optText(60),
  reason: optText(300),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

export const addOrderNoteSchema = z.object({ orderId: orderIdSchema, note: text(1, 1000) });
export const getSlipUrlSchema = z.object({ orderId: orderIdSchema });

const phoneDigits = z
  .string()
  .trim()
  .max(30)
  .transform((v, ctx) => {
    if (v === '') return '';
    const n = normaliseWhatsApp(v) ?? (/^\+?[\d\s-]{9,20}$/.test(v) ? v.replace(/\D/g, '') : null);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'phone' });
      return z.NEVER;
    }
    return n;
  });

const optHttpsOrEmpty = z.union([z.literal(''), httpsUrl]);
const socialLink = z.strictObject({ url: httpsUrl, title: l10n(120) });

export const publicConfigSchema = z.strictObject({
  ordersOpen: z.boolean(),
  notice: l10n(500).nullable(),
  bank: z.strictObject({
    accountName: z.string().trim().max(120),
    accountNumber: z.string().trim().max(40),
    bankName: z.string().trim().max(120),
    branch: z.string().trim().max(120),
    branchCode: z.string().trim().max(20).nullable(),
    swift: z.string().trim().max(20).nullable(),
  }),
  paymentInstructions: l10n(2000),
  delivery: z.strictObject({
    fees: z
      .record(z.string(), int(0, 100_000))
      .refine((r) => Object.keys(r).every(isDistrictId), { message: 'district' }),
    defaultFeeLKR: int(0, 100_000),
    perExtraCopyLKR: int(0, 100_000),
    estimateDays: z
      .strictObject({ min: int(0, 60), max: int(0, 60) })
      .refine((d) => d.min <= d.max, { message: 'range' }),
  }),
  contact: z.strictObject({
    whatsappNumber: phoneDigits,
    orderPhone: phoneDigits,
    facebookPageUrl: optHttpsOrEmpty,
  }),
  social: z.strictObject({
    reels: z.array(socialLink).max(6),
    videos: z.array(socialLink).max(6),
    storyOfWeek: z.strictObject({ url: httpsUrl, title: l10n(120), blurb: l10n(400) }).nullable(),
  }),
  bundle: z.strictObject({ enabled: z.boolean(), minQty: int(2, 50), percentOff: int(0, 50) }),
  signedCopy: z.strictObject({ enabled: z.boolean(), surchargeLKR: int(0, 100_000) }),
  couriers: z
    .array(
      z.strictObject({
        name: text(1, 60),
        trackingUrlTemplate: z
          .union([httpsUrl.refine((v) => v.includes('{trackingNo}'), { message: 'placeholder' }), z.null()])
          .nullable(),
      }),
    )
    .max(10),
});

export const privateConfigSchema = z.strictObject({
  templates: z.strictObject(
    Object.fromEntries(TEMPLATE_KEYS.map((k) => [k, l10n(1000)])) as Record<
      (typeof TEMPLATE_KEYS)[number],
      ReturnType<typeof l10n>
    >,
  ),
  retention: z.strictObject({ anonymiseAfterMonths: int(1, 60) }),
  lowStockThreshold: int(0, 1000),
  notifications: z.strictObject({
    customerEmails: z.boolean(),
    whatsappCloud: z.strictObject({
      enabled: z.boolean(),
      graphApiVersion: z
        .string()
        .trim()
        .regex(/^v\d{1,3}\.\d$/),
      templateNames: z.strictObject(
        Object.fromEntries(WA_EVENTS.map((k) => [k, z.string().trim().max(512)])) as Record<
          (typeof WA_EVENTS)[number],
          z.ZodString
        >,
      ),
      languageCodes: z.strictObject({
        si: z.string().trim().max(10),
        en: z.string().trim().max(10),
        ta: z.string().trim().max(10).optional(),
      }),
    }),
  }),
});

export const updateSettingsSchema = z
  .strictObject({
    public: publicConfigSchema.partial().optional(),
    private: privateConfigSchema.partial().optional(),
  })
  .refine((v) => v.public || v.private, { message: 'empty' });
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const updateBookSchema = z.strictObject({
  slug: slugSchema,
  priceLKR: int(0, 1_000_000).optional(),
  saleMode: z.enum(SALE_MODES).optional(),
  externalUrl: z.union([httpsUrl, z.null()]).optional(),
  stock: int(0, 1_000_000).optional(),
  inStock: z.boolean().optional(),
  preorder: z.boolean().optional(),
  preorderNote: l10n(200).nullable().optional(),
  signedCopyAvailable: z.boolean().optional(),
});
export type UpdateBookInput = z.infer<typeof updateBookSchema>;

export const moderateReviewSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,64}$/),
  action: z.enum(['approve', 'reject', 'unpublish']),
});

export const adminUpdateRecordSchema = z
  .object({
    collection: z.enum(['stock_alerts', 'enquiries', 'newsletter_subscribers']),
    id: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{1,128}$/),
    action: z.enum(['mark_notified', 'mark_handled', 'delete']),
  })
  .refine(
    (v) =>
      v.action === 'delete' ||
      (v.action === 'mark_notified' && v.collection === 'stock_alerts') ||
      (v.action === 'mark_handled' && v.collection === 'enquiries'),
    { message: 'invalid_action' },
  );

export const anonymiseSchema = z.object({ dryRun: z.boolean() });

// ---------- engagement callables ----------

export const subscribeNewsletterSchema = z.object({
  email: emailSchema,
  lang: langSchema,
  consent: z.literal(true),
  source: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{1,40}$/),
});

export const unsubscribeNewsletterSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{20,100}$/),
});

export const requestStockAlertSchema = z
  .object({
    slug: slugSchema,
    lang: langSchema,
    whatsapp: z
      .union([z.literal(''), whatsappSchema])
      .optional()
      .transform((v) => (v ? v : undefined)),
    email: optEmail,
    consent: z.literal(true),
  })
  .refine((v) => v.whatsapp || v.email, { message: 'contact_required', path: ['email'] });

export const ENQUIRY_KINDS = ['school', 'library', 'university', 'bookshop', 'other'] as const;
export const submitEnquirySchema = z.object({
  kind: z.enum(ENQUIRY_KINDS),
  organisation: text(2, 120),
  contactName: text(2, 80),
  phone: whatsappSchema,
  email: optEmail,
  books: z
    .array(z.object({ slug: slugSchema, qty: int(1, 10000) }))
    .min(1)
    .max(10),
  message: optText(2000),
  lang: langSchema,
  consent: z.literal(true),
});

export const submitReviewSchema = z.object({
  slug: slugSchema,
  displayName: text(2, 40),
  rating: int(1, 5),
  text: text(10, 1000),
  lang: langSchema,
  consent: z.literal(true),
});
