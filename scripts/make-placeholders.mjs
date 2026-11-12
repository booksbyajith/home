#!/usr/bin/env node
// Generates clearly-labelled placeholder images (covers, sample pages, author portrait, icons).
// Run once; the output is committed. Replace the files with real images later (see MANUAL_SETUP.md).
//   node scripts/make-placeholders.mjs [--force]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse } from 'yaml';
import { textImage } from './lib-fonts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'site/public');
const force = process.argv.includes('--force');
const COLORS = ['#7a1f1f', '#1f4e5f', '#4a3b12'];

async function card(file, w, h, bg, lines, fg = '#ffffff') {
  if (existsSync(file) && !force) return;
  mkdirSync(path.dirname(file), { recursive: true });
  const layers = [];
  let y = Math.round(h * 0.18);
  for (const [text, size] of lines) {
    const img = await textImage(sharp, text, {
      size,
      width: Math.round(w * 0.8),
      color: fg,
      align: 'centre',
    });
    layers.push({ input: img.data, left: Math.max(0, Math.round((w - img.width) / 2)), top: y });
    y += img.height + Math.round(size * 0.8);
  }
  const border = Buffer.from(
    `<svg width="${w}" height="${h}"><rect x="24" y="24" width="${w - 48}" height="${h - 48}" fill="none" stroke="${fg}" stroke-opacity="0.5" stroke-width="4"/></svg>`,
  );
  await sharp({ create: { width: w, height: h, channels: 3, background: bg } })
    .composite([{ input: border }, ...layers])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(file);
  console.log('wrote', path.relative(root, file));
}

const booksDir = path.join(root, 'site/src/content/books');
const books = readdirSync(booksDir)
  .map((d) => parse(readFileSync(path.join(booksDir, d, 'book.yaml'), 'utf8')))
  .sort((a, b) => a.order - b.order);

for (const [i, b] of books.entries()) {
  const bg = COLORS[i % COLORS.length];
  for (const c of b.covers) {
    await card(
      path.join(pub, 'covers', c.file),
      1200,
      1800,
      c.kind === 'front' ? bg : '#efe6d2',
      [
        [b.title.si, 64],
        [b.title.en, 44],
        [`PLACEHOLDER — ${c.kind} — ${c.file}`, 30],
      ],
      c.kind === 'front' ? '#ffffff' : '#1f1b16',
    );
  }
  for (const [n, s] of b.samples.entries()) {
    await card(
      path.join(pub, 'samples', b.slug, s.file),
      1200,
      1700,
      '#fffdf8',
      [
        [b.title.si, 52],
        [`Sample page ${n + 1}`, 40],
        [`PLACEHOLDER — samples/${b.slug}/${s.file}`, 28],
      ],
      '#1f1b16',
    );
  }
}

await card(path.join(pub, 'author/author-portrait.jpg'), 1200, 1500, '#4a4136', [
  ['ආචාර්ය අජිත් අමරසිංහ', 64],
  ['Dr. Ajith Amarasinghe', 48],
  ['PLACEHOLDER — author/author-portrait.jpg', 30],
]);

// Icons
const iconDir = path.join(pub, 'icons');
mkdirSync(iconDir, { recursive: true });
const svg = (size, pad = 0) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><rect width="64" height="64" rx="${pad ? 0 : 12}" fill="#7a1f1f"/><g transform="translate(${pad} ${pad}) scale(${(64 - 2 * pad) / 64})"><path d="M14 18c6-3 12-3 18 1v29c-6-4-12-4-18-1z" fill="#f8f3e7"/><path d="M50 18c-6-3-12-3-18 1v29c6-4 12-4 18-1z" fill="#efe6d2"/></g></svg>`,
  );
writeFileSync(path.join(iconDir, 'favicon.svg'), svg(64).toString());
const pngs = [
  ['favicon-32.png', 32, 0],
  ['apple-touch-icon.png', 180, 0],
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 10],
];
for (const [name, size, pad] of pngs) {
  const f = path.join(iconDir, name);
  if (existsSync(f) && !force) continue;
  await sharp(svg(size, pad)).png().toFile(f);
  console.log('wrote', path.relative(root, f));
}
