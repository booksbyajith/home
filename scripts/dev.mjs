#!/usr/bin/env node
// Local development: builds functions (watch), starts the emulators, seeds fixtures, runs astro dev.
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTS = {
  auth: 9099,
  functions: 5001,
  firestore: 8080,
  storage: 9199,
  ui: 4000,
  hub: 4400,
  site: 4321,
};

const inUse = (port) =>
  new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' }, () => (s.destroy(), resolve(true)));
    s.on('error', () => resolve(false));
  });

for (const [name, port] of Object.entries(PORTS)) {
  if (await inUse(port)) {
    console.error(
      `Port ${port} (${name}) is already in use. Stop the process using it (e.g. "lsof -i :${port}") and retry.`,
    );
    process.exit(1);
  }
}

const run = (cmd, args, opts = {}) => spawn(cmd, args, { cwd: root, stdio: 'inherit', ...opts });
const wait = (p) => new Promise((r) => p.on('exit', (c) => r(c)));

if ((await wait(run('node', ['scripts/ensure-local-env.mjs']))) !== 0) process.exit(1);
if ((await wait(run('pnpm', ['--filter', 'functions', 'build']))) !== 0) process.exit(1);

const children = [
  run('pnpm', ['--filter', 'functions', 'watch']),
  run('pnpm', ['exec', 'firebase', 'emulators:start', '--project', 'demo-ajith']),
];

for (let i = 0; i < 120 && !(await inUse(PORTS.functions)); i++)
  await new Promise((r) => setTimeout(r, 1000));
await new Promise((r) => setTimeout(r, 3000));
await wait(run('node', ['scripts/seed.mjs', '--emulator', '--fixtures']));
children.push(run('node', ['scripts/with-env.mjs', '.env.emulator', 'pnpm', '--filter', 'site', 'dev']));

console.log('\n  Site:          http://127.0.0.1:4321/booksbyajith/');
console.log('  Admin:         http://127.0.0.1:4321/booksbyajith/admin/');
console.log('  Emulator UI:   http://127.0.0.1:4000/\n');

const stop = () => {
  for (const c of children) c.kill('SIGINT');
  setTimeout(() => process.exit(0), 1500);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
