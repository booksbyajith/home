import rss from '@astrojs/rss';
import type { Lang } from '@shared/constants';
import { t } from '../i18n';
import { getPosts, postSlug } from './content';
import { absUrl, href } from './paths';

export async function feed(lang: Lang) {
  const items = [
    ...(await getPosts('news', lang)).map((p) => ({ p, kind: 'news' as const })),
    ...(await getPosts('blog', lang)).map((p) => ({ p, kind: 'blog' as const })),
  ].sort((a, b) => b.p.data.date.getTime() - a.p.data.date.getTime());
  return rss({
    title: t(lang, 'rss.title'),
    description: t(lang, 'rss.description'),
    site: absUrl(href(lang, '/')),
    customData: `<language>${{ si: 'si-LK', en: 'en-GB', ta: 'ta-LK' }[lang]}</language>`,
    items: items.map(({ p, kind }) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.date,
      link: absUrl(href(lang, `/${kind}/${postSlug(p)}/`)),
      categories: p.data.tags,
    })),
  });
}
