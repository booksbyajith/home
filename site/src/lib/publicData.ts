import { mergePublicConfig } from '@shared/defaults';
import type { BookDoc, PublicConfig } from '@shared/types';
import { env } from './env';

type FsValue = Record<string, unknown>;

/** Convert a Firestore REST "Value" into a plain JS value. */
export function decodeFirestoreValue(v: FsValue | undefined): unknown {
  if (!v) return undefined;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('referenceValue' in v) return v.referenceValue;
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('bytesValue' in v) return v.bytesValue;
  if ('arrayValue' in v) {
    const values = ((v.arrayValue as { values?: FsValue[] }).values ?? []) as FsValue[];
    return values.map(decodeFirestoreValue);
  }
  if ('mapValue' in v) return decodeFields((v.mapValue as { fields?: Record<string, FsValue> }).fields);
  return undefined;
}

export function decodeFields(fields: Record<string, FsValue> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(fields ?? {})) out[k] = decodeFirestoreValue(val);
  return out;
}

function base(): string {
  const host = __USE_EMULATORS__ ? 'http://127.0.0.1:8080' : 'https://firestore.googleapis.com';
  return `${host}/v1/projects/${env.firebase.projectId}/databases/(default)/documents`;
}

const TTL = 5 * 60 * 1000;

function cacheGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: T };
    return Date.now() - at < TTL ? data : null;
  } catch {
    return null;
  }
}

function cacheSet(key: string, data: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage unavailable */
  }
}

async function getJson(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${base()}/${path}${__USE_EMULATORS__ ? '' : `?key=${env.firebase.apiKey}`}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchPublicConfig(opts: { fresh?: boolean } = {}): Promise<PublicConfig | null> {
  const key = 'aj.cfg.v1';
  if (!opts.fresh) {
    const hit = cacheGet<PublicConfig>(key);
    if (hit) return hit;
  }
  const json = (await getJson('config/public')) as { fields?: Record<string, FsValue> } | null;
  if (!json?.fields) return null;
  const cfg = mergePublicConfig(decodeFields(json.fields) as Partial<PublicConfig>);
  cacheSet(key, cfg);
  return cfg;
}

export async function fetchBooks(opts: { fresh?: boolean } = {}): Promise<Record<string, BookDoc> | null> {
  const key = 'aj.books.v1';
  if (!opts.fresh) {
    const hit = cacheGet<Record<string, BookDoc>>(key);
    if (hit) return hit;
  }
  const json = (await getJson('books')) as { documents?: { name: string; fields: Record<string, FsValue> }[] } | null;
  if (!json?.documents) return null;
  const out: Record<string, BookDoc> = {};
  for (const d of json.documents) {
    const data = decodeFields(d.fields) as unknown as BookDoc;
    out[data.slug ?? d.name.split('/').pop()!] = data;
  }
  cacheSet(key, out);
  return out;
}

export interface PublicReview {
  id: string;
  displayName: string;
  rating: number;
  text: string;
  lang: 'si' | 'en' | 'ta';
  approvedAt: string;
}

export async function fetchReviews(slug: string): Promise<PublicReview[]> {
  const json = (await getJson(`books/${slug}/reviews`)) as {
    documents?: { name: string; fields: Record<string, FsValue> }[];
  } | null;
  return (json?.documents ?? [])
    .map((d) => ({ id: d.name.split('/').pop()!, ...(decodeFields(d.fields) as Omit<PublicReview, 'id'>) }))
    .sort((a, b) => (a.approvedAt < b.approvedAt ? 1 : -1));
}
