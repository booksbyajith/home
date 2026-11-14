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

const PORTRAIT = path.join(site, 'public/author/author-portrait.jpg');
const COVERS = [
  'portuguese-era-1505-1594-front.jpg',
  'chinese-expedition-front.jpg',
  'finding-sinhabahu-front.jpg',
]
  .map((f) => path.join(site, 'public/covers', f))
  .filter((f) => existsSync(f));

const frame = () =>
  Buffer.from(
    `<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fbf7ef"/><rect width="${W}" height="14" fill="#6f4626"/><rect y="${H - 14}" width="${W}" height="14" fill="#845d16"/></svg>`,
  );

/** A book cover with a soft shadow, as a PNG of (w + 2*pad) x (h + 2*pad). */
async function shadowed(file, w, h, pad = 18) {
  const img = await sharp(file).resize({ width: w, height: h, fit: 'cover' }).toBuffer();
  const shadow = Buffer.from(
    `<svg width="${w + 2 * pad}" height="${h + 2 * pad}"><defs><filter id="b"><feGaussianBlur stdDeviation="${pad / 2.5}"/></filter></defs><rect x="${pad + 4}" y="${pad + 8}" width="${w}" height="${h}" fill="#2b1d12" opacity="0.45" filter="url(#b)"/></svg>`,
  );
  return sharp(shadow)
    .composite([{ input: img, left: pad, top: pad }])
    .png()
    .toBuffer();
}

/** The author's photo in a circle with a gold ring. */
async function roundPortrait(d) {
  const ring = 4;
  const img = await sharp(PORTRAIT)
    .resize({ width: d, height: d, fit: 'cover', position: 'top' })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}"/></svg>`,
        ),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();
  const D = d + 2 * ring;
  return sharp(
    Buffer.from(
      `<svg width="${D}" height="${D}"><circle cx="${D / 2}" cy="${D / 2}" r="${D / 2}" fill="#b08a3e"/></svg>`,
    ),
  )
    .composite([{ input: img, left: ring, top: ring }])
    .png()
    .toBuffer();
}

/** Site-wide card: the author's portrait on the right, name, tagline and the book covers. */
async function renderDefault(file, { title, subtitle }) {
  const layers = [{ input: frame(), left: 0, top: 0 }];
  const pw = 430;
  if (existsSync(PORTRAIT)) {
    const ph = H - 28;
    const photo = await sharp(PORTRAIT)
      .resize({ width: pw, height: ph, fit: 'cover', position: 'top' })
      .composite([
        {
          // Fade the photo's left edge into the paper colour.
          input: Buffer.from(
            `<svg width="${pw}" height="${ph}"><defs><linearGradient id="g"><stop offset="0" stop-color="#fbf7ef" stop-opacity="1"/><stop offset="0.28" stop-color="#fbf7ef" stop-opacity="0"/></linearGradient></defs><rect width="${pw}" height="${ph}" fill="url(#g)"/></svg>`,
          ),
        },
      ])
      .toBuffer();
    layers.push({ input: photo, left: W - pw, top: 14 });
  }
  const textW = W - pw - 90;
  const t = await textImage(sharp, title, {
    size: title.length > 30 ? 46 : 56,
    width: textW,
    color: '#1f1b16',
  });
  layers.push({ input: t.data, left: 70, top: 60 });
  if (subtitle) {
    const s = await textImage(sharp, subtitle, {
      size: 28,
      width: textW,
      color: '#6f4626',
      serif: false,
      bold: false,
    });
    layers.push({ input: s.data, left: 70, top: 60 + t.height + 14 });
  }
  // The books side by side.
  const cw = 174;
  const ch = 261;
  let x = 52;
  for (const c of COVERS) {
    layers.push({ input: await shadowed(c, cw, ch), left: x, top: H - 14 - ch - 60 });
    x += cw + 12;
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: '#fbf7ef' } })
    .composite(layers)
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(file);
}

/** A book or post: its cover on the left, the title, and the author's round photo and name. */
async function render(file, { title, subtitle, lang, cover }) {
  if (!cover || !existsSync(cover)) return renderDefault(file, { title, subtitle });
  const layers = [{ input: frame(), left: 0, top: 0 }];
  layers.push({ input: await shadowed(cover, 330, 490), left: 52, top: 52 });
  const textLeft = 470;
  const textWidth = W - textLeft - 70;
  const t = await textImage(sharp, title, {
    size: title.length > 40 ? 48 : 58,
    width: textWidth,
    color: '#1f1b16',
  });
  layers.push({ input: t.data, left: textLeft, top: 90 });
  if (subtitle) {
    const s = await textImage(sharp, subtitle, {
      size: 28,
      width: textWidth,
      color: '#4a4136',
      serif: false,
      bold: false,
    });
    layers.push({ input: s.data, left: textLeft, top: Math.min(90 + t.height + 22, H - 260) });
  }
  const d = 104;
  const name = await textImage(sharp, NAME[lang], { size: 32, width: textWidth - d - 30, color: '#6f4626' });
  const rowTop = H - 64 - d;
  if (existsSync(PORTRAIT)) layers.push({ input: await roundPortrait(d), left: textLeft, top: rowTop });
  layers.push({
    input: name.data,
    left: textLeft + d + 30,
    top: Math.round(rowTop + (d + 8 - name.height) / 2),
  });
  await sharp({ create: { width: W, height: H, channels: 3, background: '#fbf7ef' } })
    .composite(layers)
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(file);
}

let count = 0;
for (const lang of LANGS) {
  const f = path.join(out, `default-${lang}.jpg`);
  if (!fresh(f, PORTRAIT)) await renderDefault(f, { title: NAME[lang], subtitle: TAG[lang] });
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
