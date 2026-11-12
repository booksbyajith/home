#!/usr/bin/env node
// Generates 1200x630 Open Graph JPGs into site/public/og/ (git-ignored):
//   default-<lang>.jpg, book-<slug>-<lang>.jpg, <news|blog>-<slug>-<lang>.jpg
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse } from 'yaml';
import { textImage } from './lib-fonts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site');
const out = path.join(site, 'public/og');
mkdirSync(out, { recursive: true });
const W = 1200;
const H = 630;
const NAME = { si: 'වෛද්‍ය අජිත් අමරසිංහ', en: 'Dr. Ajith Amarasinghe', ta: 'வைத்தியர் அஜித் அமரசிங்க' };
const LANGS = ['si', 'en', 'ta'];
const TAG = {
  si: 'ඉතිහාස පබැඳුම',
  en: 'Research on the history of Sri Lanka',
  ta: 'இலங்கை வரலாறு பற்றிய ஆய்வுகள்',
};

const scriptMtime = statSync(fileURLToPath(import.meta.url)).mtimeMs;
const fresh = (file, ...sources) =>
  existsSync(file) &&
  sources.every((s) => !s || statSync(file).mtimeMs > statSync(s).mtimeMs) &&
  statSync(file).mtimeMs > scriptMtime;

async function render(file, { title, subtitle, lang, cover }) {
  const band = Buffer.from(
    `<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#f8f3e7"/><rect width="${W}" height="14" fill="#7a1f1f"/><rect y="${H - 14}" width="${W}" height="14" fill="#9a6b12"/></svg>`,
  );
  const layers = [{ input: band, left: 0, top: 0 }];
  let textLeft = 80;
  if (cover && existsSync(cover)) {
    const img = await sharp(cover).resize({ height: 500, width: 340, fit: 'cover' }).toBuffer();
    layers.push({ input: img, left: 70, top: 65 });
    textLeft = 470;
  }
  const textWidth = W - textLeft - 70;
  const t = await textImage(sharp, title, {
    size: title.length > 40 ? 50 : 60,
    width: textWidth,
    color: '#1f1b16',
  });
  let y = 110;
  layers.push({ input: t.data, left: textLeft, top: y });
  y += t.height + 24;
  if (subtitle) {
    const s = await textImage(sharp, subtitle, {
      size: 30,
      width: textWidth,
      color: '#4a4136',
      serif: false,
      bold: false,
    });
    layers.push({ input: s.data, left: textLeft, top: Math.min(y, H - 200) });
  }
  const name = await textImage(sharp, NAME[lang], { size: 34, width: textWidth, color: '#7a1f1f' });
  layers.push({ input: name.data, left: textLeft, top: H - 70 - name.height });
  await sharp({ create: { width: W, height: H, channels: 3, background: '#f8f3e7' } })
    .composite(layers)
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(file);
}

let count = 0;
for (const lang of LANGS) {
  const f = path.join(out, `default-${lang}.jpg`);
  if (!fresh(f)) await render(f, { title: NAME[lang], subtitle: TAG[lang], lang });
  count++;
}

const booksDir = path.join(site, 'src/content/books');
for (const dir of readdirSync(booksDir)) {
  const yamlFile = path.join(booksDir, dir, 'book.yaml');
  const b = parse(readFileSync(yamlFile, 'utf8'));
  const front = b.covers.find((c) => c.kind === 'front');
  const cover = front ? path.join(site, 'public/covers', front.file) : null;
  for (const lang of LANGS) {
    const f = path.join(out, `book-${b.slug}-${lang}.jpg`);
    const award = b.awards?.[0]?.[lang];
    if (!fresh(f, yamlFile, cover))
      await render(f, { title: b.title[lang] ?? b.title.en, subtitle: award ?? TAG[lang], lang, cover });
    count++;
  }
}

function frontmatter(file) {
  const m = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/);
  return m ? parse(m[1]) : {};
}
for (const kind of ['news', 'blog']) {
  for (const lang of LANGS) {
    const dir = path.join(site, 'src/content', kind, lang);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).filter((n) => /\.mdx?$/.test(n))) {
      const src = path.join(dir, name);
      const fm = frontmatter(src);
      const slug = name.replace(/\.mdx?$/, '');
      const f = path.join(out, `${kind}-${slug}-${lang}.jpg`);
      const cover = fm.cover ? path.join(site, 'public', fm.cover) : null;
      if (!fresh(f, src))
        await render(f, {
          title: fm.title,
          subtitle: fm.description,
          lang,
          cover: cover && existsSync(cover) ? cover : null,
        });
      count++;
    }
  }
}
console.log(`build-og: ${count} images`);
