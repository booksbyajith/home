/**
 * Receipt downloads. The receipt is HTML rendered by the browser (so Sinhala is shaped correctly),
 * rasterised to JPG with html-to-image, and that JPG is placed on a PDF page with jsPDF.
 * jsPDF's text API is never used: it cannot shape Sinhala.
 */
export interface RenderedReceipt {
  dataUrl: string;
  width: number;
  height: number;
}

export async function renderReceiptJpg(node: HTMLElement): Promise<RenderedReceipt> {
  await document.fonts.ready;
  const { toJpeg } = await import('html-to-image');
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  const opts = {
    quality: 0.92,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    width,
    height,
    style: { position: 'static', left: '0', top: '0', transform: 'none', margin: '0' },
  };
  // The first pass warms html-to-image's font and image caches (a known Safari/Chromium quirk).
  await toJpeg(node, opts).catch(() => undefined);
  const dataUrl = await toJpeg(node, opts);
  return { dataUrl, width, height };
}

export async function renderReceiptPdf(r: RenderedReceipt): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({
    unit: 'px',
    format: [r.width, r.height],
    orientation: r.width > r.height ? 'landscape' : 'portrait',
    hotfixes: ['px_scaling'],
    compress: false, // keeps the one-line content stream readable; the JPEG dominates the size
  });
  pdf.addImage(r.dataUrl, 'JPEG', 0, 0, r.width, r.height);
  return pdf.output('blob');
}

export function downloadUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
