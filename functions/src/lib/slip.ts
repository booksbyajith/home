import { SLIP_EXT, SLIP_MAX_BYTES, SLIP_TYPES, type SlipType } from '../shared/constants.js';
import { fail } from './errors.js';
import { sha256 } from './hash.js';

export function detectType(buf: Buffer): SlipType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP')
    return 'image/webp';
  if (buf.length >= 5 && buf.toString('latin1', 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

export interface DecodedSlip {
  buffer: Buffer;
  contentType: SlipType;
  ext: string;
  sizeBytes: number;
  sha256: string;
}

export function decodeSlip(input: { contentType: string; dataBase64: string }): DecodedSlip {
  const b64 = input.dataBase64.replace(/^data:[^;]+;base64,/, '');
  if (!/^[A-Za-z0-9+/=_-]+$/.test(b64)) fail('invalid-argument', 'SLIP_INVALID');
  const buffer = Buffer.from(b64, 'base64');
  if (buffer.length > SLIP_MAX_BYTES) fail('invalid-argument', 'SLIP_TOO_LARGE');
  if (buffer.length < 8) fail('invalid-argument', 'SLIP_INVALID');
  const detected = detectType(buffer);
  const declared = input.contentType.toLowerCase().replace('image/jpg', 'image/jpeg');
  if (!detected || !(SLIP_TYPES as readonly string[]).includes(declared) || declared !== detected)
    fail('invalid-argument', 'SLIP_INVALID');
  return { buffer, contentType: detected, ext: SLIP_EXT[detected], sizeBytes: buffer.length, sha256: sha256(buffer) };
}
