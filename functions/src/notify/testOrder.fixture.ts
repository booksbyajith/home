import type { OrderDoc } from '../shared/types.js';
import { DEFAULT_PRIVATE_CONFIG, DEFAULT_PUBLIC_CONFIG } from '../shared/defaults.js';
import type { NotifySettings } from './core.js';

/** Test fixture (fake data only). */
export function testOrder(overrides: Partial<OrderDoc> = {}): OrderDoc {
  return {
    orderId: 'AJ-2611-7K3Q',
    status: 'pending_verification',
    lang: 'si',
    createdAt: null,
    updatedAt: null,
    closedAt: null,
    anonymisedAt: null,
    customer: {
      name: 'Test Customer',
      mobile: '94770000001',
      whatsapp: '94770000001',
      email: 'customer@example.com',
    },
    phoneLast4: '0001',
    address: {
      line1: '1 Test Road',
      line2: null,
      city: 'Colombo',
      districtId: 'colombo',
      postalCode: '00100',
      landmark: null,
    },
    geo: null,
    items: [
      {
        slug: 'portuguese-era-1505-1594',
        title: { si: 'ලංකාවේ පෘතුගීසි සිටි යුගය', en: 'The Portuguese Period' },
        qty: 1,
        unitPriceLKR: 4500,
        lineTotalLKR: 4500,
        preorder: false,
      },
    ],
    bookSlugs: ['portuguese-era-1505-1594'],
    totalQty: 1,
    totals: {
      subtotalLKR: 4500,
      bundleDiscountLKR: 0,
      signedSurchargeLKR: 0,
      deliveryFeeLKR: 350,
      grandTotalLKR: 4850,
    },
    clientExpectedTotalLKR: 4850,
    totalMismatch: false,
    signedCopy: false,
    dedicationNote: null,
    slip: { path: 'slips/AJ-2611-7K3Q/slip.jpg', contentType: 'image/jpeg', sizeBytes: 10, sha256: 'x' },
    statusHistory: [],
    dispatch: null,
    rejection: null,
    stockReserved: true,
    search: [],
    ...overrides,
  };
}

export function testSettings(overrides: Partial<NotifySettings> = {}): NotifySettings {
  return {
    siteUrl: 'https://books.example.com/site',
    teamEmails: ['team@example.com'],
    telegramEnabled: true,
    whatsappEnabled: false,
    pub: DEFAULT_PUBLIC_CONFIG,
    priv: DEFAULT_PRIVATE_CONFIG,
    templateVars: (o) => ({
      name: o.customer.name,
      orderId: o.orderId,
      courier: 'C',
      trackingNo: 'T',
      trackingUrl: 'U',
      reason: 'R',
    }),
    loadSlip: async () => ({
      filename: 'slip.jpg',
      content: Buffer.from([1, 2, 3]),
      contentType: 'image/jpeg',
    }),
    ...overrides,
  };
}
