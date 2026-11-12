import { SLIP_IMAGE_TARGET_BYTES, SLIP_MAX_BYTES, SLIP_TYPES } from '@shared/constants';

export type SlipCheck = { ok: true; file: Blob; type: string } | { ok: false; reason: 'type' | 'size' };

/** Validate a chosen slip and shrink large images to about 1.5 MB in the browser. */
export async function prepareSlip(file: File): Promise<SlipCheck> {
  const type = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  if (!(SLIP_TYPES as readonly string[]).includes(type)) return { ok: false, reason: 'type' };
  if (file.size > SLIP_MAX_BYTES) return { ok: false, reason: 'size' };
  if (type === 'application/pdf' || file.size <= SLIP_IMAGE_TARGET_BYTES) return { ok: true, file, type };
  try {
    const { default: compress } = await import('browser-image-compression');
    const out = await compress(file, {
      maxSizeMB: SLIP_IMAGE_TARGET_BYTES / 1024 / 1024,
      maxWidthOrHeight: 2000,
      useWebWorker: false, // the worker would load its script from a CDN
      fileType: 'image/jpeg',
      initialQuality: 0.85,
    });
    return { ok: true, file: out, type: 'image/jpeg' };
  } catch {
    return { ok: true, file, type };
  }
}
