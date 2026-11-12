import { describe, expect, it } from 'vitest';
import {
  backInStock,
  customerConfirmation,
  customerDispatched,
  customerRejected,
  customerVerified,
  teamEnquiry,
  teamNewOrder,
} from './emailTemplates.js';
import { testOrder } from './testOrder.fixture.js';

const site = 'https://books.example.com/site';

describe('email templates', () => {
  it.each(['si', 'en'] as const)('customer emails render in %s', (lang) => {
    const o = testOrder({
      lang,
      dispatch: { courier: 'Demo Courier', trackingNo: 'T1', trackingUrl: null, dispatchedAt: null },
      rejection: { reason: 'Amount <wrong>', at: null },
    });
    for (const fn of [customerConfirmation, customerVerified, customerDispatched, customerRejected]) {
      const e = fn(o, site);
      expect(e.subject).toContain('AJ-2611-7K3Q');
      expect(e.html).toContain(`lang="${lang}"`);
      expect(e.html).toContain(`${site}${lang === 'en' ? '/en' : ''}/track/#AJ-2611-7K3Q`);
      expect(e.text).toContain('AJ-2611-7K3Q');
    }
    expect(customerRejected(o, site).html).toContain('Amount &lt;wrong&gt;');
    expect(customerDispatched(o, site).text).toContain('Demo Courier');
  });
  it('Sinhala confirmation uses Sinhala text', () => {
    expect(customerConfirmation(testOrder({ lang: 'si' }), site).html).toContain('ස්තුතියි');
  });
  it('team email has full details and the admin link', () => {
    const e = teamNewOrder(testOrder({ totalMismatch: true, clientExpectedTotalLKR: 4000 }), site);
    expect(e.text).toContain('94770000001');
    expect(e.text).toContain('1 Test Road');
    expect(e.text).toContain(`${site}/admin/#/orders/AJ-2611-7K3Q`);
    expect(e.text).toContain('customer saw Rs. 4,000');
  });
  it('enquiry and back-in-stock emails', () => {
    expect(
      teamEnquiry(
        {
          kind: 'library',
          organisation: 'Test Library',
          contactName: 'X',
          phone: '94770000001',
          email: null,
          books: [{ slug: 'a', qty: 20 }],
          message: null,
          lang: 'en',
        },
        site,
      ).subject,
    ).toContain('Test Library');
    const b = backInStock({ si: 'පොත', en: 'Book' }, 'finding-sinhabahu', 'en', site);
    expect(b.text).toContain(`${site}/en/order/?book=finding-sinhabahu`);
  });
});
