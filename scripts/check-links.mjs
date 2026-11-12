#!/usr/bin/env node
// Checks every internal href/src/srcset in the built site resolves to a file under the base path.
//   node scripts/check-links.mjs site/dist
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'site/dist');
const base = (() => {
  try {
    return new URL(process.env.SITE_URL ?? '').pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
})();

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : [];
  });
}

const detectedBase =
  base ||
  (() => {
    const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
    const m = html.match(/<link rel="canonical" href="https?:\/\/[^/]+([^"]*)"/);
    return m ? m[1].replace(/\/+$/, '') : '';
  })();

const bad = [];
let checked = 0;
for (const file of walk(dist)) {
  const html = readFileSync(file, 'utf8');
  const refs = [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const s of html.matchAll(/\ssrcset="([^"]+)"/g))
    refs.push(...s[1].split(',').map((x) => x.trim().split(/\s+/)[0]));
  for (const ref of refs) {
    if (!ref.startsWith('/') || ref.startsWith('//')) continue;
    checked++;
    const clean = decodeURI(ref.split(/[?#]/)[0]);
    if (detectedBase && !clean.startsWith(detectedBase + '/') && clean !== detectedBase) {
      bad.push(`${path.relative(dist, file)}: ${ref} (missing base ${detectedBase})`);
      continue;
    }
    const rel = clean.slice(detectedBase.length);
    const target = path.join(dist, rel);
    const ok = rel.endsWith('/')
      ? existsSync(path.join(target, 'index.html'))
      : existsSync(target) || existsSync(target + '.html');
    if (!ok) bad.push(`${path.relative(dist, file)}: ${ref}`);
  }
}
if (bad.length) {
  console.error(bad.join('\n'));
  console.error(`\ncheck-links: ${bad.length} broken of ${checked}`);
  process.exit(1);
}
console.log(`check-links: ${checked} internal links ok (base "${detectedBase}")`);
