import { describe, expect, it } from 'vitest';
import { guessCountryCode, guessCountryName } from './guessCountry';

describe('guessCountry', () => {
  it('returns nothing in Sri Lanka or for unknown zones', () => {
    expect(guessCountryCode('Asia/Colombo')).toBeNull();
    expect(guessCountryCode('Etc/UTC')).toBeNull();
  });
  it('recognises common zones', () => {
    expect(guessCountryCode('Australia/Sydney')).toBe('AU');
    expect(guessCountryCode('Australia/Perth')).toBe('AU');
    expect(guessCountryCode('Europe/London')).toBe('GB');
    expect(guessCountryCode('Asia/Dubai')).toBe('AE');
    expect(guessCountryCode('America/Toronto')).toBe('CA');
  });
  it('names the country in the page language', () => {
    expect(guessCountryName('en', 'Australia/Melbourne')).toBe('Australia');
    expect(guessCountryName('si', 'Australia/Melbourne')).toBeTruthy();
  });
});
