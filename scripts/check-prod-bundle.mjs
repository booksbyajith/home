#!/usr/bin/env node
// Verifies a production-mode build contains no emulator-only code or values.
//   node scripts/check-prod-bundle.mjs site/dist-prod
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] ?? 'site/dist-prod');
const FORBIDDEN = [
  'emulator-signin',
  'Emulator sign-in',
  'demo-ajith',
  'demo-api-key',
  '127.0.0.1:',
  '00000000-0000-4000-8000-000000000000',
];

function walk(d) {
  return readdirSync(d).flatMap((n) => {
    const p = path.join(d, n);
    return statSync(p).isDirectory()
      ? walk(p)
      : /\.(html|js|mjs|css|json|xml|webmanifest)$/.test(n)
        ? [p]
        : [];
  });
}

const hits = [];
const files = walk(dir);
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const s of FORBIDDEN) if (text.includes(s)) hits.push(`${path.relative(dir, f)}: contains "${s}"`);
}
if (hits.length) {
  console.error(hits.join('\n'));
  process.exit(1);
}
console.log(`check-prod-bundle: ${files.length} files clean`);
