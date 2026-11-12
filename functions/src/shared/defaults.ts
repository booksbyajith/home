import { DEFAULT_TEMPLATES } from './templates.js';
import type { PrivateConfig, PublicConfig } from './types.js';

/** Empty business defaults. Real values are entered in the admin Settings screen. */
export const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  ordersOpen: false,
  notice: null,
  bank: { accountName: '', accountNumber: '', bankName: '', branch: '', branchCode: null, swift: null },
  paymentInstructions: {
    si: 'කරුණාකර ඇණවුමේ මුළු මුදල පහත ගිණුමට බැර කර, බැංකු රිසිට්පතේ ඡායාරූපයක් හෝ PDF එකක් උඩුගත කරන්න.',
    en: 'Please transfer the order total to the account below and upload a photo or PDF of the bank slip.',
  },
  delivery: { fees: {}, defaultFeeLKR: 0, perExtraCopyLKR: 0, estimateDays: { min: 2, max: 4 } },
  contact: { whatsappNumber: '', orderPhone: '', facebookPageUrl: '' },
  social: { reels: [], videos: [], storyOfWeek: null },
  bundle: { enabled: false, minQty: 2, percentOff: 0 },
  signedCopy: { enabled: false, surchargeLKR: 0 },
  couriers: [],
};

export const DEFAULT_PRIVATE_CONFIG: PrivateConfig = {
  templates: DEFAULT_TEMPLATES,
  retention: { anonymiseAfterMonths: 12 },
  lowStockThreshold: 5,
  notifications: {
    customerEmails: true,
    whatsappCloud: {
      enabled: false,
      graphApiVersion: 'v21.0',
      templateNames: { acknowledged: '', payment_verified: '', dispatched: '', rejected: '' },
      languageCodes: { si: 'si', en: 'en' },
    },
  },
};

export function mergePublicConfig(doc: Partial<PublicConfig> | undefined): PublicConfig {
  const d = DEFAULT_PUBLIC_CONFIG;
  const c = doc ?? {};
  return {
    ...d,
    ...c,
    bank: { ...d.bank, ...c.bank },
    paymentInstructions: { ...d.paymentInstructions, ...c.paymentInstructions },
    delivery: { ...d.delivery, ...c.delivery, fees: { ...(c.delivery?.fees ?? {}) } },
    contact: { ...d.contact, ...c.contact },
    social: { ...d.social, ...c.social },
    bundle: { ...d.bundle, ...c.bundle },
    signedCopy: { ...d.signedCopy, ...c.signedCopy },
    couriers: c.couriers ?? d.couriers,
  };
}

export function mergePrivateConfig(doc: Partial<PrivateConfig> | undefined): PrivateConfig {
  const d = DEFAULT_PRIVATE_CONFIG;
  const c = doc ?? {};
  return {
    ...d,
    ...c,
    templates: { ...d.templates, ...c.templates },
    retention: { ...d.retention, ...c.retention },
    notifications: {
      ...d.notifications,
      ...c.notifications,
      whatsappCloud: {
        ...d.notifications.whatsappCloud,
        ...c.notifications?.whatsappCloud,
        templateNames: {
          ...d.notifications.whatsappCloud.templateNames,
          ...c.notifications?.whatsappCloud?.templateNames,
        },
        languageCodes: {
          ...d.notifications.whatsappCloud.languageCodes,
          ...c.notifications?.whatsappCloud?.languageCodes,
        },
      },
    },
  };
}
