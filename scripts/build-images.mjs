#!/usr/bin/env node
// Builds responsive AVIF and WebP variants of covers, sample pages and the author portrait into
// site/public/_gen/ and writes site/src/generated/images.json with each source's size.
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'site/public');
const out = path.join(pub, '_gen');
const WIDTHS = [320, 640, 960];
const DIRS = ['covers', 'samples', 'author', 'news'];

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(jpe?g|png|webp)$/i.test(n) ? [p] : [];
  });
}

const manifest = {};
for (const d of DIRS) {
  for (const file of walk(path.join(pub, d))) {
    const rel = path.relative(pub, file).split(path.sep).join('/');
    const meta = await sharp(file).metadata();
    const variants = [];
    for (const w of WIDTHS.filter((w) => w < (meta.width ?? 0)).concat(
      meta.width && meta.width <= 960 ? [meta.width] : [],
    )) {
      const target = path.join(out, rel.replace(/\.[a-z]+$/i, `-${w}.webp`));
      const avifTarget = target.replace(/\.webp$/, '.avif');
      const srcTime = statSync(file).mtimeMs;
      const stale = (t) => !existsSync(t) || statSync(t).mtimeMs < srcTime;
      // AVIF first in <picture>: about half the size of WebP for these images.
      if (stale(avifTarget)) {
        mkdirSync(path.dirname(avifTarget), { recursive: true });
        await sharp(file).resize({ width: w }).avif({ quality: 55, effort: 4 }).toFile(avifTarget);
      }
      if (stale(target)) {
        mkdirSync(path.dirname(target), { recursive: true });
        // Fine paper and cloth textures compress badly; if a variant is over budget, a very light
        // denoise (invisible at this size) roughly halves it.
        const budget = w * 200;
        let buf = await sharp(file).resize({ width: w }).webp({ quality: 76, effort: 6 }).toBuffer();
        if (buf.length > budget)
          buf = await sharp(file).resize({ width: w }).blur(0.8).webp({ quality: 72, effort: 6 }).toBuffer();
        writeFileSync(target, buf);
      }
      variants.push(w);
    }
    manifest['/' + rel] = {
      width: meta.width,
      height: meta.height,
      variants: [...new Set(variants)].sort((a, b) => a - b),
    };
  }
}
mkdirSync(path.join(root, 'site/src/generated'), { recursive: true });
writeFileSync(path.join(root, 'site/src/generated/images.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`build-images: ${Object.keys(manifest).length} images`);
