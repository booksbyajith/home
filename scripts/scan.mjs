#!/usr/bin/env node
// Local secret and policy scanner (complements gitleaks in CI).
// Usage: node scripts/scan.mjs [extraDir ...]
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(root);

const BINARY = /\.(png|jpe?g|webp|gif|ico|woff2?|ttf|otf|pdf|zip|gz|jar)$/i;
const SELF = 'scripts/scan.mjs';

const rules = [
  {
    id: 'google-api-key',
    re: /AIza[0-9A-Za-z_-]{35}/g,
    // The Firebase *web* API key is public by design and must be in the built site.
    // It is passed in at build time and allowed only when scanning build output.
    allow: (m) => !!process.env.PUBLIC_FIREBASE_API_KEY && m === process.env.PUBLIC_FIREBASE_API_KEY,
    skipAllowFor: /^(?!site\/dist(-prod)?\/)/,
  },
  { id: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: 'aws-key', re: /AKIA[0-9A-Z]{16}/ },
  { id: 'github-token', re: /gh[pousr]_[0-9A-Za-z]{30,}/ },
  { id: 'slack-token', re: /xox[baprs]-[0-9A-Za-z-]{10,}/ },
  { id: 'telegram-token', re: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/ },
  { id: 'meta-token', re: /\bEAA[A-Za-z0-9]{40,}/ },
  { id: 'service-account', re: /"type":\s*"service_account"/ },
  {
    id: 'email',
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
    allow: (m) =>
      /@(example\.(com|org)|users\.noreply\.github\.com|anthropic\.com|developer\.gserviceaccount\.com|[a-z0-9-]+\.iam\.gserviceaccount\.com)$/i.test(
        m,
      ) ||
      /@(types|astrojs|firebase|fontsource|eslint|playwright|tailwindcss|vitest|lhci|axe-core|vite-pwa|resvg)\//.test(
        m,
      ) ||
      /^[^@]+@\d/.test(m) ||
      /\.(png|jpe?g|webp|svg|js|css|woff2?)$/i.test(m),
  },
  {
    id: 'lk-phone',
    re: /(?<![\d])(?:\+?94|0)\s?7\d[\s-]?\d{3}[\s-]?\d{4}(?![\d])/g,
    allow: (m) =>
      /^(\+?94|0)\s?7[0-9]0{2,}/.test(m.replace(/[\s-]/g, '')) || /0000/.test(m.replace(/[\s-]/g, '')),
    skipPaths: [/^tests\//, /\.test\.ts$/, /^PLAN\.md$/],
  },
  {
    id: 'clinic-keyword',
    re: /\b(clinic|hospital|channell?ing|medical cent(re|er)|nursing home)s?\b/gi,
    skipPaths: [/^PLAN\.md$/, /^scripts\/scan\.mjs$/],
  },
  {
    id: 'jspdf-text',
    re: /\b(pdf|doc)\.text\(/g,
    onlyPaths: [/^site\/src\//],
  },
];

function trackedFiles() {
  return execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' }).split('\n').filter(Boolean);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = new Set(trackedFiles());
for (const extra of process.argv.slice(2)) for (const f of walk(extra)) files.add(path.relative(root, f));

let hits = 0;
for (const file of files) {
  if (BINARY.test(file) || file === 'pnpm-lock.yaml') continue;
  let text;
  try {
    if (statSync(file).size > 5_000_000) continue;
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split('\n');
  for (const rule of rules) {
    if (file === SELF && rule.id !== 'email') continue;
    if (rule.skipPaths?.some((r) => r.test(file))) continue;
    if (rule.onlyPaths && !rule.onlyPaths.some((r) => r.test(file))) continue;
    lines.forEach((line, i) => {
      const re = new RegExp(
        rule.re.source,
        rule.re.flags.includes('g') ? rule.re.flags : rule.re.flags + 'g',
      );
      for (const m of line.matchAll(re)) {
        if (rule.allow?.(m[0]) && !(rule.skipAllowFor && rule.skipAllowFor.test(file))) continue;
        hits++;
        console.log(`${file}:${i + 1}  [${rule.id}]  ${m[0].slice(0, 60)}`);
      }
    });
  }
}

if (hits) {
  console.error(`\nscan: ${hits} finding(s).`);
  process.exit(1);
}
console.log(`scan: ${files.size} files clean.`);
