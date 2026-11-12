import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { runSeed } from '../../scripts/seed.mjs';

export const PROJECT = 'demo-ajith';
export const REGION = 'asia-south1';
export const BUCKET = 'demo-ajith.appspot.com';
export const API_KEY = 'demo-api-key';
export const APP_ID = '1:000000000000:web:demo';
const FS = 'http://127.0.0.1:8080';
const AUTH = 'http://127.0.0.1:9099';
const FN = `http://127.0.0.1:5001/${PROJECT}/${REGION}`;

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= '127.0.0.1:9199';
process.env.GCLOUD_PROJECT ??= PROJECT;

const app = getApps()[0] ?? initializeApp({ projectId: PROJECT, storageBucket: BUCKET });
export const db = getFirestore(app);
export const adminAuth = getAuth(app);
export const bucket = getStorage(app).bucket(BUCKET);

export async function clearFirestore(): Promise<void> {
  const r = await fetch(`${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
    method: 'DELETE',
  });
  if (!r.ok) throw new Error(`clear firestore ${r.status}`);
}

export async function resetAll(): Promise<void> {
  await clearFirestore();
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await bucket.deleteFiles({ force: true }).catch(() => undefined);
  await runSeed(db, { fixtures: true });
}

const b64url = (s: string) => Buffer.from(s).toString('base64url');

/** Unsigned App Check token; the Functions emulator decodes it without verification. */
export function appCheckToken(): string {
  const now = Math.floor(Date.now() / 1000);
  return `${b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${b64url(
    JSON.stringify({ sub: APP_ID, aud: [`projects/${PROJECT}`], iss: 'emulator', iat: now, exp: now + 3600 }),
  )}.emulator`;
}

export interface CallResult<T = any> {
  status: number;
  result?: T;
  error?: {
    status: string;
    message: string;
    details?: { code?: string; fields?: string[]; slugs?: string[] };
  };
}

export async function call<T = any>(
  name: string,
  data: unknown,
  opts: { idToken?: string; appCheck?: boolean; headers?: Record<string, string> } = {},
): Promise<CallResult<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...opts.headers };
  if (opts.appCheck !== false) headers['X-Firebase-AppCheck'] = appCheckToken();
  if (opts.idToken) headers.Authorization = `Bearer ${opts.idToken}`;
  const res = await fetch(`${FN}/${name}`, { method: 'POST', headers, body: JSON.stringify({ data }) });
  const body = (await res.json().catch(() => ({}))) as { result?: T; error?: CallResult['error'] };
  return { status: res.status, ...body };
}

export async function signIn(email: string, password: string): Promise<string> {
  const r = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const j = (await r.json()) as { idToken?: string };
  if (!j.idToken) throw new Error('sign-in failed');
  return j.idToken;
}

export async function createUser(email: string, admin: boolean): Promise<string> {
  const password = 'password-123';
  const user = await adminAuth.createUser({ email, password, displayName: email.split('@')[0] });
  if (admin) await adminAuth.setCustomUserClaims(user.uid, { admin: true });
  return signIn(email, password);
}

export const adminToken = () => createUser('admin@example.com', true);
export const userToken = () => createUser('reader@example.com', false);

export async function waitFor<T>(
  fn: () => Promise<T | undefined | null | false>,
  timeoutMs = 15000,
): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 200));
  }
}

export async function outbox(filter?: (d: any) => boolean): Promise<any[]> {
  const snap = await db.collection('dev_outbox').get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return filter ? docs.filter(filter) : docs;
}
