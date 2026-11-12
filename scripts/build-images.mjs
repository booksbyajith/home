#!/usr/bin/env node
// Builds responsive WebP variants of covers, sample pages and the author portrait into
// site/public/_gen/ and writes site/src/generated/images.json with each source's size.
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'site/public');
const out = path.join(pub, '_gen');
const WIDTHS = [320, 640, 960];
const DIRS = ['covers', 'samples', 'author'];

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
      const srcTime = statSync(file).mtimeMs;
      if (!existsSync(target) || statSync(target).mtimeMs < srcTime) {
        mkdirSync(path.dirname(target), { recursive: true });
        await sharp(file).resize({ width: w }).webp({ quality: 78 }).toFile(target);
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
