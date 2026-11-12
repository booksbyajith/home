import type { Lang } from '@shared/constants';
import { env } from './env';

export const LANGS: readonly Lang[] = ['si', 'en', 'ta'];
/** URL prefix per language: Sinhala is the default at the root. */
export const LANG_PREFIX: Record<Lang, string> = { si: '', en: '/en', ta: '/ta' };

/** Normalise to a path that starts and ends with "/" (fragment and query kept). */
function norm(path: string): string {
  const m = path.match(/^([^?#]*)(.*)$/)!;
  let p = m[1] || '/';
  if (!p.startsWith('/')) p = '/' + p;
  if (!p.endsWith('/') && !/\.[a-z0-9]+$/i.test(p)) p += '/';
  return p + m[2];
}

/** Site-internal link with base path and language prefix. href('en', '/books/') -> '/booksbyajith/en/books/' */
export function href(lang: Lang, path = '/'): string {
  const p = norm(path);
  return `${env.base}${LANG_PREFIX[lang]}${p}`;
}

/** Link to a language-neutral path (assets, admin, feeds). */
export function asset(path: string): string {
  return `${env.base}${path.startsWith('/') ? path : '/' + path}`;
}

/** Absolute URL for a path that already includes the base. */
export function absUrl(pathWithBase: string): string {
  return env.origin + pathWithBase;
}

/** Strip base and language prefix from a pathname: '/booksbyajith/en/books/' -> '/books/' */
export function stripLang(pathname: string): string {
  let p = pathname;
  if (env.base && p.startsWith(env.base)) p = p.slice(env.base.length) || '/';
  for (const pre of ['/en', '/ta']) if (p === pre || p.startsWith(pre + '/')) p = p.slice(3) || '/';
  return norm(p);
}

export function langFromPath(pathname: string): Lang {
  const p = env.base && pathname.startsWith(env.base) ? pathname.slice(env.base.length) : pathname;
  if (p === '/en' || p.startsWith('/en/')) return 'en';
  if (p === '/ta' || p.startsWith('/ta/')) return 'ta';
  return 'si';
}

export function altHref(pathname: string, target: Lang): string {
  return href(target, stripLang(pathname));
}

/** getStaticPaths helper for the [...lang] folder. */
export function langPaths() {
  return LANGS.map((lang) => ({ params: { lang: langParam(lang) }, props: { lang } }));
}

/** The [...lang] route parameter for a language (undefined = Sinhala at the root). */
export function langParam(lang: Lang): string | undefined {
  return lang === 'si' ? undefined : lang;
}
