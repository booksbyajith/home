import sharp from 'sharp';

export async function jpg(width = 64, height = 64): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#c0a080' } })
    .jpeg()
    .toBuffer();
}
export async function png(): Promise<Buffer> {
  return sharp({ create: { width: 32, height: 32, channels: 3, background: '#2050a0' } })
    .png()
    .toBuffer();
}
export async function webp(): Promise<Buffer> {
  return sharp({ create: { width: 32, height: 32, channels: 3, background: '#20a050' } })
    .webp()
    .toBuffer();
}
export function pdf(sizeBytes = 400): Buffer {
  const head = '%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n';
  const tail = '\n%%EOF\n';
  const pad = Math.max(0, sizeBytes - head.length - tail.length);
  return Buffer.concat([Buffer.from(head), Buffer.alloc(pad, 0x20), Buffer.from(tail)]);
}
