#!/usr/bin/env node
// Loads KEY=VALUE pairs from an env file into the environment (without overriding
// variables that are already set), then runs the given command.
//   node scripts/with-env.mjs .env.emulator pnpm --filter site build
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const [file, ...cmd] = process.argv.slice(2);
if (!file || !cmd.length) {
  console.error('Usage: with-env.mjs <env-file> <command...>');
  process.exit(1);
}
if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
const child = spawn(cmd[0], cmd.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' });
child.on('exit', (code) => process.exit(code ?? 1));
