import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fs = (pkg, file) => path.join(root, 'node_modules/@fontsource', pkg, 'files', file);

export const FONTS = {
  serifSinhalaBold: fs('noto-serif-sinhala', 'noto-serif-sinhala-sinhala-700-normal.woff'),
  serifLatinBold: fs('noto-serif-sinhala', 'noto-serif-sinhala-latin-700-normal.woff'),
  sansSinhala: fs('noto-sans-sinhala', 'noto-sans-sinhala-sinhala-400-normal.woff'),
  sansLatin: fs('noto-sans-sinhala', 'noto-sans-sinhala-latin-400-normal.woff'),
};

const SINHALA = /[඀-෿]/;

/** Escape text for Pango markup. */
export const pango = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Render a block of text to a transparent PNG buffer using sharp + a bundled font. */
export async function textImage(
  sharp,
  text,
  { size = 48, width = 1000, bold = true, color = '#1f1b16', serif = true, align = 'left' } = {},
) {
  const sinhala = SINHALA.test(text);
  const fontfile = serif
    ? sinhala
      ? FONTS.serifSinhalaBold
      : FONTS.serifLatinBold
    : sinhala
      ? FONTS.sansSinhala
      : FONTS.sansLatin;
  const family = serif ? 'Noto Serif Sinhala' : 'Noto Sans Sinhala';
  const { data, info } = await sharp({
    text: {
      text: `<span foreground="${color}">${pango(text)}</span>`,
      font: `${family}${bold && serif ? ' Bold' : ''} ${size}`,
      fontfile,
      rgba: true,
      width,
      align,
      wrap: 'word',
      dpi: 72,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
