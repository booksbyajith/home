import type { Lang } from './constants.js';

export type { Lang };
/** Text in each site language. Tamil is optional and falls back to English (see l10nText). */
export type L10n = { si: string; en: string; ta?: string };
/** Firestore Timestamp on the server; plain values in shared code. */
export type Ts = unknown;

export const ORDER_STATUSES = [
  'pending_verification',
  'acknowledged',
  'payment_verified',
  'dispatched',
  'delivered',
  'rejected',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const SALE_MODES = ['direct', 'external', 'unavailable'] as const;
export type SaleMode = (typeof SALE_MODES)[number];

export interface BookDoc {
  slug: string;
  title: L10n;
  priceLKR: number;
  saleMode: SaleMode;
  externalUrl: string | null;
  stock: number;
  inStock: boolean;
  preorder: boolean;
  preorderNote: L10n | null;
  signedCopyAvailable: boolean;
  sortOrder: number;
  updatedAt?: Ts;
}

export interface BankDetails {
  accountName: string;
  accountNumber: string;
  bankName: string;
  branch: string;
  branchCode: string | null;
  swift: string | null;
}

export interface DeliveryConfig {
  fees: Record<string, number>;
  defaultFeeLKR: number;
  perExtraCopyLKR: number;
  estimateDays: { min: number; max: number };
}

export interface SocialLink {
  url: string;
  title: L10n;
}

export interface PublicConfig {
  ordersOpen: boolean;
  notice: L10n | null;
  bank: BankDetails;
  paymentInstructions: L10n;
  delivery: DeliveryConfig;
  contact: { whatsappNumber: string; orderPhone: string; facebookPageUrl: string };
  social: {
    reels: SocialLink[];
    videos: SocialLink[];
    storyOfWeek: { url: string; title: L10n; blurb: L10n } | null;
  };
  bundle: { enabled: boolean; minQty: number; percentOff: number };
  signedCopy: { enabled: boolean; surchargeLKR: number };
  couriers: { name: string; trackingUrlTemplate: string | null }[];
  updatedAt?: Ts;
  updatedBy?: string | null;
}

export const TEMPLATE_KEYS = [
  'acknowledged',
  'payment_verified',
  'dispatched',
  'rejected',
  'back_in_stock',
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];
export const WA_EVENTS = ['acknowledged', 'payment_verified', 'dispatched', 'rejected'] as const;
export type WaEvent = (typeof WA_EVENTS)[number];

export interface PrivateConfig {
  templates: Record<TemplateKey, L10n>;
  retention: { anonymiseAfterMonths: number };
  lowStockThreshold: number;
  notifications: {
    customerEmails: boolean;
    whatsappCloud: {
      enabled: boolean;
      graphApiVersion: string;
      templateNames: Record<WaEvent, string>;
      languageCodes: { si: string; en: string; ta?: string };
    };
  };
  updatedAt?: Ts;
  updatedBy?: string | null;
}

export interface Totals {
  subtotalLKR: number;
  bundleDiscountLKR: number;
  signedSurchargeLKR: number;
  deliveryFeeLKR: number;
  grandTotalLKR: number;
}

export interface OrderItem {
  slug: string;
  title: L10n;
  qty: number;
  unitPriceLKR: number;
  lineTotalLKR: number;
  preorder: boolean;
}

export interface OrderDoc {
  orderId: string;
  status: OrderStatus;
  lang: Lang;
  createdAt: Ts;
  updatedAt: Ts;
  closedAt: Ts | null;
  anonymisedAt: Ts | null;
  customer: { name: string; mobile: string; whatsapp: string; email: string | null };
  phoneLast4: string;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    districtId: string;
    postalCode: string;
    /** Only for overseas deliveries (districtId 'overseas'). */
    country?: string | null;
    landmark: string | null;
  };
  geo: { lat: number; lng: number; accuracyM: number; capturedAt: Ts } | null;
  items: OrderItem[];
  bookSlugs: string[];
  totalQty: number;
  totals: Totals;
  clientExpectedTotalLKR: number;
  totalMismatch: boolean;
  signedCopy: boolean;
  dedicationNote: string | null;
  slip: { path: string; contentType: string; sizeBytes: number; sha256: string } | null;
  statusHistory: { status: OrderStatus; at: Ts }[];
  dispatch: { courier: string; trackingNo: string; trackingUrl: string | null; dispatchedAt: Ts } | null;
  rejection: { reason: string; at: Ts } | null;
  stockReserved: boolean;
  search: string[];
}

export type AuditType = 'status' | 'note' | 'slip_view' | 'anonymise';

export interface AuditEvent {
  type: AuditType;
  at: Ts;
  by: { uid: string; email: string | null } | null;
  from: OrderStatus | null;
  to: OrderStatus | null;
  note: string | null;
  meta: Record<string, unknown> | null;
}
