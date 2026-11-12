import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEMPLATES,
  bookTitles,
  buildCourierTrackingUrl,
  buildMapsUrl,
  buildOrderUrl,
  buildTrackUrl,
  buildWaUrl,
  renderTemplate,
} from './templates.js';

describe('renderTemplate', () => {
  it('substitutes variables', () => {
    expect(renderTemplate('Hi {name}, order {orderId}', { name: 'Nimal', orderId: 'AJ-2611-7K3Q' })).toBe(
      'Hi Nimal, order AJ-2611-7K3Q',
    );
  });
  it('leaves unknown variables', () => expect(renderTemplate('{foo} {name}', { name: 'A' })).toBe('{foo} A'));
  it('renders the English acknowledged template exactly', () => {
    expect(
      renderTemplate(DEFAULT_TEMPLATES.acknowledged.en, {
        bookTitles: 'Finding Sinhabahu',
        name: 'Nimal',
        orderId: 'AJ-2611-7K3Q',
      }),
    ).toBe(
      'Thank you for ordering Finding Sinhabahu, Nimal! 🙏 Your order number is AJ-2611-7K3Q. We will verify your bank transfer shortly and start preparing your book.',
    );
  });
  it('every default template exists in both languages', () => {
    for (const t of Object.values(DEFAULT_TEMPLATES)) {
      expect(t.si.length).toBeGreaterThan(10);
      expect(t.en.length).toBeGreaterThan(10);
    }
  });
});

describe('urls', () => {
  it('wa.me encodes Sinhala and emoji', () => {
    const text = 'ස්තුතියි 🙏 & AJ-2611-7K3Q';
    const url = buildWaUrl('+94 77 123 4567', text);
    expect(url.startsWith('https://wa.me/94771234567?text=')).toBe(true);
    expect(decodeURIComponent(url.split('?text=')[1])).toBe(text);
    expect(url).not.toContain(' ');
  });
  it('maps url', () =>
    expect(buildMapsUrl(6.9271, 79.8612)).toBe('https://maps.google.com/?q=6.9271,79.8612'));
  it('track url', () => {
    expect(buildTrackUrl('https://x.github.io/booksbyajith/', 'si', 'AJ-2611-7K3Q')).toBe(
      'https://x.github.io/booksbyajith/track/#AJ-2611-7K3Q',
    );
    expect(buildTrackUrl('https://x.github.io/booksbyajith', 'en', 'AJ-2611-7K3Q')).toBe(
      'https://x.github.io/booksbyajith/en/track/#AJ-2611-7K3Q',
    );
  });
  it('order url', () =>
    expect(buildOrderUrl('https://a.b', 'en', 'finding-sinhabahu')).toBe(
      'https://a.b/en/order/?book=finding-sinhabahu',
    ));
  it('courier tracking url', () => {
    expect(buildCourierTrackingUrl('https://c.example.com/t?n={trackingNo}', 'AB 12')).toBe(
      'https://c.example.com/t?n=AB%2012',
    );
    expect(buildCourierTrackingUrl(null, 'AB')).toBeNull();
  });
  it('book titles', () => {
    const items = [{ title: { si: 'අ', en: 'A' } }, { title: { si: 'ආ', en: 'B' } }];
    expect(bookTitles(items, 'si')).toBe('අ, ආ');
    expect(bookTitles(items, 'en')).toBe('A, B');
  });
});
