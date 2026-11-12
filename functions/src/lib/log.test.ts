import { describe, expect, it } from 'vitest';
import { errorMessage, redact } from './log.js';

describe('redact', () => {
  it('removes emails and long digit runs', () => {
    expect(redact('mail a.b@example.com about 94770000001 order AJ-2611-7K3Q')).toBe(
      'mail [email] about [digits] order AJ-2611-7K3Q',
    );
  });
  it('truncates error messages', () => {
    expect(errorMessage(new Error('x'.repeat(500))).length).toBe(300);
  });
});
