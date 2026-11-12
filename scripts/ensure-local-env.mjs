#!/usr/bin/env node
// Creates functions/.secret.local from the committed example when missing (emulator secrets only).
import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const target = path.join(root, 'functions/.secret.local');
if (!existsSync(target)) {
  copyFileSync(path.join(root, 'functions/.secret.local.example'), target);
  console.log('Created functions/.secret.local from the example (emulator values).');
}
