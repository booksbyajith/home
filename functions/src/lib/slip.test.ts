import { describe, expect, it } from 'vitest';
import { decodeSlip, detectType } from './slip.js';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
const pdf = Buffer.from('%PDF-1.4 test');

describe('slip', () => {
  it('detects types by magic bytes', () => {
    expect(detectType(jpeg)).toBe('image/jpeg');
    expect(detectType(png)).toBe('image/png');
    expect(detectType(webp)).toBe('image/webp');
    expect(detectType(pdf)).toBe('application/pdf');
    expect(detectType(Buffer.from('GIF89a....'))).toBeNull();
  });
  it('decodes and hashes', () => {
    const r = decodeSlip({ contentType: 'image/jpeg', dataBase64: jpeg.toString('base64') });
    expect(r.ext).toBe('jpg');
    expect(r.sizeBytes).toBe(jpeg.length);
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it('accepts a data URL prefix', () => {
    expect(decodeSlip({ contentType: 'application/pdf', dataBase64: 'data:application/pdf;base64,' + pdf.toString('base64') }).ext).toBe('pdf');
  });
  it('rejects mismatched types', () => {
    expect(() => decodeSlip({ contentType: 'image/png', dataBase64: jpeg.toString('base64') })).toThrow('SLIP_INVALID');
  });
  it('rejects oversize files', () => {
    const big = Buffer.concat([pdf, Buffer.alloc(5 * 1024 * 1024)]);
    expect(() => decodeSlip({ contentType: 'application/pdf', dataBase64: big.toString('base64') })).toThrow('SLIP_TOO_LARGE');
  });
});
