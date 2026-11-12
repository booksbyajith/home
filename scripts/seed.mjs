#!/usr/bin/env node
// Seeds books/* and config/* in Firestore.
//   node scripts/seed.mjs --emulator [--fixtures]   local emulators (project demo-ajith)
//   node scripts/seed.mjs --project <id>            production (Application Default Credentials)
// Without --fixtures it only creates missing documents and never overwrites.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function readBooks() {
  const dir = path.join(root, 'site/src/content/books');
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => parseYaml(readFileSync(path.join(dir, d.name, 'book.yaml'), 'utf8')))
    .sort((a, b) => a.order - b.order);
}

export function bookDocFromYaml(b) {
  const d = b.defaults;
  return {
    slug: b.slug,
    title: b.title,
    priceLKR: d.priceLKR,
    saleMode: d.saleMode,
    externalUrl: d.externalUrl ?? null,
    stock: d.stock,
    inStock: d.inStock,
    preorder: d.preorder ?? false,
    preorderNote: null,
    signedCopyAvailable: d.signedCopyAvailable ?? false,
    sortOrder: b.order,
  };
}

/** @param {import('firebase-admin/firestore').Firestore} db */
export async function runSeed(db, { fixtures = false } = {}) {
  const { FieldValue } = await import('firebase-admin/firestore');
  const defaults = await import(path.join(root, 'functions/lib/shared/defaults.js'));
  const createIfMissing = async (ref, data) => {
    const snap = await ref.get();
    if (!snap.exists) await ref.set({ ...data, updatedAt: FieldValue.serverTimestamp() });
    return !snap.exists;
  };
  const created = [];
  for (const b of readBooks()) {
    if (await createIfMissing(db.collection('books').doc(b.slug), bookDocFromYaml(b)))
      created.push(`books/${b.slug}`);
  }
  if (await createIfMissing(db.doc('config/public'), { ...defaults.DEFAULT_PUBLIC_CONFIG, updatedBy: null }))
    created.push('config/public');
  if (
    await createIfMissing(db.doc('config/private'), { ...defaults.DEFAULT_PRIVATE_CONFIG, updatedBy: null })
  )
    created.push('config/private');

  if (fixtures) {
    const fx = JSON.parse(readFileSync(path.join(root, 'tests/helpers/fixtures.json'), 'utf8'));
    await db.doc('config/public').set(fx.config.public, { merge: true });
    await db.doc('config/private').set(fx.config.private, { merge: true });
    for (const [slug, data] of Object.entries(fx.books))
      await db.collection('books').doc(slug).set(data, { merge: true });
  }
  return created;
}

async function main() {
  const args = process.argv.slice(2);
  const emulator = args.includes('--emulator');
  const fixtures = args.includes('--fixtures');
  const pIdx = args.indexOf('--project');
  const projectId = emulator ? 'demo-ajith' : args[pIdx + 1];
  if (!projectId) {
    console.error('Usage: seed.mjs --emulator [--fixtures] | --project <id>');
    process.exit(1);
  }
  if (fixtures && !emulator) {
    console.error('--fixtures is only allowed with --emulator.');
    process.exit(1);
  }
  if (emulator) {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= '127.0.0.1:9199';
  }
  const { initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = initializeApp({ projectId });
  const created = await runSeed(getFirestore(app), { fixtures });
  console.log(
    created.length ? `Created: ${created.join(', ')}` : 'Nothing to create; existing documents kept.',
  );
  if (fixtures) console.log('Applied test fixtures.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
