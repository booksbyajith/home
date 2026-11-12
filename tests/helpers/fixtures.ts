import { jpg } from './files.js';

export const PORTUGUESE = 'portuguese-era-1505-1594';
export const SINHABAHU = 'finding-sinhabahu';
export const CHINESE = 'chinese-expedition';

export const CUSTOMER = {
  name: 'Test Customer',
  mobile: '0770000001',
  whatsapp: '0770000001',
  email: 'customer@example.com',
};

export async function orderInput(overrides: Record<string, any> = {}) {
  const slip = await jpg();
  return {
    lang: 'si',
    items: [{ slug: PORTUGUESE, qty: 1 }],
    customer: { ...CUSTOMER },
    address: {
      line1: '1 Test Road',
      line2: 'Apartment 2',
      city: 'Colombo',
      districtId: 'colombo',
      postalCode: '00100',
      landmark: 'Near the test tower',
    },
    geo: null,
    signedCopy: false,
    dedicationNote: '',
    expectedTotalLKR: 4850,
    slip: { fileName: 'slip.jpg', contentType: 'image/jpeg', dataBase64: slip.toString('base64') },
    consent: true,
    ...overrides,
  };
}
