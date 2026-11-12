import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { resetAll } from '../helpers/emulator.js';
import { placeOrder } from './orderHelpers.js';

test.use({ viewport: { width: 900, height: 1400 }, deviceScaleFactor: 2, isMobile: false, hasTouch: false });
test.skip(({ browserName }) => browserName !== 'chromium');

test.beforeEach(async () => {
  await resetAll();
});

const W = 720;
const BLUR = 2; // R15: 1 px was too sensitive to sub-pixel offsets

async function grey(buf: Buffer, width = W) {
  return sharp(buf).resize({ width, fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
}

async function meanDiff(a: Buffer, b: Buffer): Promise<number> {
  const A = await grey(a);
  const B = await sharp(b)
    .resize({ width: A.info.width, height: A.info.height, fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();
  let sum = 0;
  for (let i = 0; i < A.data.length; i++) sum += Math.abs(A.data[i] - B[i]);
  return sum / A.data.length / 255;
}

async function mask(
  buf: Buffer,
  crop: { left: number; top: number; width: number; height: number },
  scale: number,
) {
  const meta = await sharp(buf).metadata();
  const s = ((meta.width ?? 0) / (W * 2)) * scale;
  const region = {
    left: Math.max(0, Math.round(crop.left * s)),
    top: Math.max(0, Math.round(crop.top * s)),
    width: Math.round(crop.width * s),
    height: Math.round(crop.height * s),
  };
  const { data } = await sharp(buf)
    .extract(region)
    .resize({ width: 400, height: 60, fit: 'fill' })
    .greyscale()
    .blur(BLUR)
    .threshold(200)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

function iou(a: Buffer, b: Buffer): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] < 128;
    const y = b[i] < 128;
    if (x && y) inter++;
    if (x || y) union++;
  }
  return union ? inter / union : 0;
}

async function receiptShot(page: Page): Promise<Buffer> {
  const el = page.locator('[data-testid="receipt"]');
  await el.evaluate((n: HTMLElement) => {
    n.style.left = '0px';
  });
  const shot = await el.screenshot();
  await el.evaluate((n: HTMLElement) => {
    n.style.left = '';
  });
  return shot;
}

test('receipt JPG and PDF render Sinhala text correctly', async ({ page }) => {
  test.setTimeout(120_000);
  const orderId = await placeOrder(page);
  expect(await page.evaluate(() => document.fonts.check('16px "Noto Sans Sinhala"', 'ලංකාවේ'))).toBe(true);
  await expect(page.locator('[data-testid="receipt-qr"]')).toHaveAttribute(
    'data-qr-url',
    `http://127.0.0.1:4321/booksbyajith/track/#${orderId}`,
  );

  // JPG
  const [jpgDl] = await Promise.all([page.waitForEvent('download'), page.click('[data-download="jpg"]')]);
  expect(jpgDl.suggestedFilename()).toBe(`receipt-${orderId}.jpg`);
  const jpg = readFileSync((await jpgDl.path())!);
  const meta = await sharp(jpg).metadata();
  expect(meta.format).toBe('jpeg');
  expect(meta.width).toBe(W * 2);

  // Reference: the same element as rendered by the browser.
  const ref = await receiptShot(page);
  expect(await meanDiff(jpg, ref)).toBeLessThan(0.06);

  const box = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="receipt"]')!.getBoundingClientRect();
    const t = document.querySelector('[data-testid="receipt-title"]')!.getBoundingClientRect();
    return { left: t.left - r.left, top: t.top - r.top, width: t.width, height: t.height };
  });
  const jpgTitle = await mask(jpg, box, 2);
  const refTitle = await mask(ref, box, 2);
  const good = iou(jpgTitle, refTitle);
  expect(good).toBeGreaterThanOrEqual(0.5);

  // Negative control: a wrong font must score clearly worse.
  await page
    .locator('[data-testid="receipt-title"]')
    .first()
    .evaluate((n: HTMLElement) => {
      n.style.fontFamily = 'monospace';
    });
  const wrong = await receiptShot(page);
  const bad = iou(jpgTitle, await mask(wrong, box, 2));
  console.log(`receipt title IoU: good=${good.toFixed(3)} wrongFont=${bad.toFixed(3)}`);
  expect(good - bad).toBeGreaterThanOrEqual(0.15);
  await page
    .locator('[data-testid="receipt-title"]')
    .first()
    .evaluate((n: HTMLElement) => {
      n.style.fontFamily = '';
    });

  // PDF: an image of the receipt and no text-drawing operators (jsPDF always declares a default font).
  const [pdfDl] = await Promise.all([page.waitForEvent('download'), page.click('[data-download="pdf"]')]);
  expect(pdfDl.suggestedFilename()).toBe(`receipt-${orderId}.pdf`);
  const pdf = readFileSync((await pdfDl.path())!);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  const text = pdf.toString('latin1');
  expect(text).toContain('/DCTDecode');
  expect(text).toMatch(/\/I\w* Do/);
  const start = pdf.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
  const end = pdf.lastIndexOf(Buffer.from([0xff, 0xd9]));
  const withoutImage = text.slice(0, start) + text.slice(end + 2);
  expect(withoutImage).not.toMatch(/\bBT\b[\s\S]*?\bET\b/);
  const embedded = pdf.subarray(start, end + 2);
  expect(await meanDiff(embedded, ref)).toBeLessThan(0.06);
  expect(iou(await mask(embedded, box, 2), refTitle)).toBeGreaterThanOrEqual(0.5);

  // QR is present and not blank.
  const qrSrc = (await page.locator('[data-testid="receipt-qr"]').getAttribute('src'))!;
  const stats = await sharp(Buffer.from(qrSrc.split(',')[1], 'base64')).stats();
  expect(stats.channels[0].stdev).toBeGreaterThan(50);
});
