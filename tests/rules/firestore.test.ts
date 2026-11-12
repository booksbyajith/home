import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ajith-rules',
    firestore: {
      rules: readFileSync(resolve(import.meta.dirname, '../../firebase/firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => env?.cleanup());

const PUBLIC = ['books/b1', 'books/b1/reviews/r1', 'config/public'];
const ADMIN_ONLY = [
  'config/private',
  'orders/AJ-2611-7K3Q',
  'orders/AJ-2611-7K3Q/audit/e1',
  'newsletter_subscribers/x',
  'stock_alerts/x',
  'enquiries/x',
  'review_submissions/x',
  'notification_failures/x',
  'dev_outbox/x',
];
const NOBODY = ['rate_limits/x', 'notification_log/x', 'anything/else', 'orders/AJ-2611-7K3Q/other/y'];

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const p of [...PUBLIC, ...ADMIN_ONLY, ...NOBODY]) await setDoc(doc(ctx.firestore(), p), { v: 1 });
  });
});

type Who = 'anon' | 'user' | 'admin' | 'adminFalse';
const db = (who: Who) => {
  if (who === 'anon') return env.unauthenticatedContext().firestore();
  if (who === 'user') return env.authenticatedContext('user1', { email: 'user@example.com' }).firestore();
  if (who === 'adminFalse') return env.authenticatedContext('user2', { admin: false }).firestore();
  return env.authenticatedContext('admin1', { admin: true }).firestore();
};
const WHO: Who[] = ['anon', 'user', 'admin'];

describe('public documents', () => {
  for (const path of PUBLIC)
    for (const who of WHO) {
      it(`${who} can read ${path}`, async () => {
        await assertSucceeds(getDoc(doc(db(who), path)));
      });
      it(`${who} cannot write ${path}`, async () => {
        await assertFails(setDoc(doc(db(who), path), { v: 2 }));
        await assertFails(updateDoc(doc(db(who), path), { v: 2 }));
        await assertFails(deleteDoc(doc(db(who), path)));
      });
    }
});

describe('admin-only documents', () => {
  for (const path of ADMIN_ONLY)
    for (const who of WHO) {
      it(`${who} ${who === 'admin' ? 'can' : 'cannot'} read ${path}`, async () => {
        const p = getDoc(doc(db(who), path));
        await (who === 'admin' ? assertSucceeds(p) : assertFails(p));
      });
      it(`${who} cannot write ${path}`, async () => {
        await assertFails(setDoc(doc(db(who), path), { v: 2 }));
        await assertFails(deleteDoc(doc(db(who), path)));
      });
    }
});

describe('server-only documents', () => {
  for (const path of NOBODY)
    for (const who of WHO) {
      it(`${who} cannot read or write ${path}`, async () => {
        await assertFails(getDoc(doc(db(who), path)));
        await assertFails(setDoc(doc(db(who), path), { v: 2 }));
      });
    }
});

describe('queries and claims', () => {
  it('non-admin cannot list orders', async () => {
    await assertFails(getDocs(collection(db('user'), 'orders')));
    await assertFails(getDocs(collection(db('anon'), 'orders')));
  });
  it('admin can list orders', async () => {
    await assertSucceeds(getDocs(collection(db('admin'), 'orders')));
  });
  it('admin:false claim is denied', async () => {
    await assertFails(getDoc(doc(db('adminFalse'), 'orders/AJ-2611-7K3Q')));
  });
  it('anyone can list books', async () => {
    await assertSucceeds(getDocs(collection(db('anon'), 'books')));
  });
  it('nobody can create a new order', async () => {
    await assertFails(setDoc(doc(db('admin'), 'orders/AJ-2611-ZZZZ'), { status: 'delivered' }));
  });
});
