import type { Lang } from '@shared/constants';
import { getCollection, type CollectionEntry } from 'astro:content';
import { readingTime } from './readingTime';

export type BookFacts = CollectionEntry<'bookFacts'>['data'];
export type PostKind = 'blog' | 'news';
export type Post = CollectionEntry<'blog'> | CollectionEntry<'news'>;

export async function getBooks() {
  const facts = await getCollection('bookFacts');
  return facts.map((f) => f.data).sort((a, b) => a.order - b.order);
}

export async function getBookText(slug: string, lang: Lang) {
  const all = await getCollection('bookText');
  const id = (e: { id: string }) => e.id.replace(/^books\//, '');
  return all.find((e) => id(e) === `${slug}/${lang}`) ?? all.find((e) => id(e).startsWith(`${slug}/`));
}

export function postLang(p: Post): Lang {
  return p.id.split('/')[0] as Lang;
}
export function postSlug(p: Post): string {
  return p.id.split('/').slice(1).join('/');
}

export async function getPosts(kind: PostKind, lang?: Lang): Promise<Post[]> {
  const all = (await getCollection(kind, (e) => !e.data.draft)) as Post[];
  return all
    .filter((p) => !lang || postLang(p) === lang)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/** Path (language-neutral) of the same post in the other language, or null. */
export async function translationPath(kind: PostKind, post: Post): Promise<string | null> {
  const key = post.data.translationKey;
  if (!key) return null;
  const other = (await getPosts(kind)).find((p) => p.data.translationKey === key && postLang(p) !== postLang(post));
  return other ? `/${kind}/${postSlug(other)}/` : null;
}

export function postMinutes(p: Post): number {
  return readingTime(p.body ?? '');
}

export async function getLatest(lang: Lang, n = 3) {
  const items = [
    ...(await getPosts('news', lang)).map((p) => ({ kind: 'news' as const, post: p })),
    ...(await getPosts('blog', lang)).map((p) => ({ kind: 'blog' as const, post: p })),
  ];
  return items.sort((a, b) => b.post.data.date.getTime() - a.post.data.date.getTime()).slice(0, n);
}

export async function getEvents() {
  return (await getCollection('events')).map((e) => ({ id: e.id, ...e.data })).sort((a, b) => b.start.getTime() - a.start.getTime());
}

export function splitEvents<T extends { start: Date; end?: Date }>(events: T[], now = new Date()) {
  const today = new Date(now.toISOString().slice(0, 10));
  const upcoming = events.filter((e) => (e.end ?? e.start) >= today).sort((a, b) => a.start.getTime() - b.start.getTime());
  const past = events.filter((e) => (e.end ?? e.start) < today);
  return { upcoming, past };
}

export async function getPress(bookSlug?: string) {
  return (await getCollection('press'))
    .map((e) => e.data)
    .filter((p) => !bookSlug || p.bookSlug === bookSlug)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function getTestimonials(bookSlug?: string) {
  return (await getCollection('testimonials')).map((e) => e.data).filter((t) => !bookSlug || t.bookSlug === bookSlug);
}

export async function getFaq(lang: Lang) {
  return (await getCollection('faq')).filter((e) => e.id.startsWith(`${lang}/`)).sort((a, b) => a.data.order - b.data.order);
}

export async function getPage(lang: Lang, name: string) {
  return (await getCollection('pages')).find((e) => e.id === `${lang}/${name}`);
}
