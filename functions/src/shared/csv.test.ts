import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv.js';

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
  });
  it('guards formula injection', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+94')).toBe("'+94");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@x')).toBe("'@x");
  });
  it('null and numbers', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(12)).toBe('12');
  });
  it('builds a file with BOM and CRLF', () => {
    const out = toCsv(
      [{ a: 'x', b: 1 }],
      [
        { header: 'A', value: (r) => r.a },
        { header: 'B', value: (r) => r.b },
      ],
    );
    expect(out).toBe('﻿A,B\r\nx,1\r\n');
  });
  it('keeps Sinhala intact', () => {
    expect(toCsv([{ n: 'කොළඹ' }], [{ header: 'n', value: (r) => r.n }])).toContain('කොළඹ');
  });
});
