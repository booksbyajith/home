import { describe, expect, it, vi } from 'vitest';

vi.stubGlobal('__PUBLIC_ENV__', { useEmulators: true, firebase: { projectId: 'demo-ajith', apiKey: 'x' } });
const { decodeFields } = await import('./publicData');

describe('Firestore REST decoder', () => {
  it('decodes every value type', () => {
    expect(
      decodeFields({
        s: { stringValue: 'ලංකාව' },
        i: { integerValue: '4500' },
        d: { doubleValue: 6.9271 },
        b: { booleanValue: true },
        n: { nullValue: null },
        t: { timestampValue: '2026-11-11T00:00:00Z' },
        a: { arrayValue: { values: [{ stringValue: 'x' }, { integerValue: '2' }] } },
        e: { arrayValue: {} },
        m: { mapValue: { fields: { si: { stringValue: 'අ' }, en: { stringValue: 'A' } } } },
        em: { mapValue: {} },
      }),
    ).toEqual({
      s: 'ලංකාව',
      i: 4500,
      d: 6.9271,
      b: true,
      n: null,
      t: '2026-11-11T00:00:00Z',
      a: ['x', 2],
      e: [],
      m: { si: 'අ', en: 'A' },
      em: {},
    });
  });
});
