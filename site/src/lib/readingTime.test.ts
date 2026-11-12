import { expect, it } from 'vitest';
import { readingTime } from './readingTime';

it('counts English and Sinhala words', () => {
  expect(readingTime('word '.repeat(360))).toBe(2);
  expect(readingTime('ලංකාවේ '.repeat(540))).toBe(3);
  expect(readingTime('')).toBe(1);
});
