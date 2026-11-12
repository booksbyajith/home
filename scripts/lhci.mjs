#!/usr/bin/env node
// Serves the emulator build with `astro preview`, runs Lighthouse CI, then stops the server.
// Run inside `firebase emulators:exec` (pnpm test:lhci) so the pages can read Firestore.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'tests/package.json'));
const { chromium } = require('@playwright/test');
const URL = 'http://127.0.0.1:4321/booksbyajith/';

const server = spawn('node', ['scripts/with-env.mjs', '.env.emulator', 'pnpm', '--dir', 'site', 'preview'], {
  cwd: root,
  stdio: 'ignore',
});
const stop = () => server.kill('SIGTERM');
process.on('exit', stop);

for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(URL)).ok) break;
  } catch {
    /* not up yet */
  }
  await new Promise((r) => setTimeout(r, 1000));
}

const lhci = spawn('pnpm', ['exec', 'lhci', 'autorun', '--config=lighthouserc.cjs'], {
  cwd: path.join(root, 'tests'),
  stdio: 'inherit',
  env: { ...process.env, LHCI_CHROME_PATH: chromium.executablePath() },
});
lhci.on('exit', (code) => {
  stop();
  process.exit(code ?? 1);
});
