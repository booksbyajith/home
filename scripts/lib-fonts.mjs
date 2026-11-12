import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fs = (pkg, file) => path.join(root, 'site/node_modules/@fontsource', pkg, 'files', file);

export const FONTS = {
  serifSinhalaBold: fs('noto-serif-sinhala', 'noto-serif-sinhala-sinhala-700-normal.woff'),
  serifLatinBold: fs('noto-serif-sinhala', 'noto-serif-sinhala-latin-700-normal.woff'),
  sansSinhala: fs('noto-sans-sinhala', 'noto-sans-sinhala-sinhala-400-normal.woff'),
  sansLatin: fs('noto-sans-sinhala', 'noto-sans-sinhala-latin-400-normal.woff'),
  serifTamilBold: fs('noto-serif-tamil', 'noto-serif-tamil-tamil-700-normal.woff'),
  sansTamil: fs('noto-sans-tamil', 'noto-sans-tamil-tamil-400-normal.woff'),
};

const SINHALA = /[\u0D80-\u0DFF]/;
const TAMIL = /[\u0B80-\u0BFF]/;

/** Escape text for Pango markup. */
export const pango = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Render a block of text to a transparent PNG buffer using sharp + a bundled font. */
export async function textImage(
  sharp,
  text,
  { size = 48, width = 1000, bold = true, color = '#1f1b16', serif = true, align = 'left' } = {},
) {
  // Pick the font for the text's main script. Fonts registered by earlier
  // calls stay available to Pango as fallbacks for mixed-script text.
  const script = TAMIL.test(text) ? 'tamil' : SINHALA.test(text) ? 'sinhala' : 'latin';
  const fontfile = {
    tamil: serif ? FONTS.serifTamilBold : FONTS.sansTamil,
    sinhala: serif ? FONTS.serifSinhalaBold : FONTS.sansSinhala,
    latin: serif ? FONTS.serifLatinBold : FONTS.sansLatin,
  }[script];
  const family =
    script === 'tamil'
      ? serif
        ? 'Noto Serif Tamil'
        : 'Noto Sans Tamil'
      : serif
        ? 'Noto Serif Sinhala'
        : 'Noto Sans Sinhala';
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
