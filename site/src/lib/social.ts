import { l10nText as tl } from '@shared/l10n';
import { format } from '../i18n';
import { fetchPublicConfig } from './publicData';

/** Story of the week and reels: filled from config/public. Facebook embeds load only on click. */
export function initSocial(): void {
  const root = document.querySelector<HTMLElement>('[data-social]');
  if (!root) return;
  const lang = (root.dataset.lang ?? 'si') as 'si' | 'en';
  void fetchPublicConfig().then((cfg) => {
    if (!cfg) return;
    const story = cfg.social.storyOfWeek;
    if (story?.url) {
      const s = root.querySelector<HTMLElement>('[data-story]')!;
      s.querySelector('[data-story-title]')!.textContent = tl(story.title, lang);
      s.querySelector('[data-story-blurb]')!.textContent = tl(story.blurb, lang);
      s.querySelector<HTMLAnchorElement>('[data-story-link]')!.href = story.url;
      s.hidden = false;
    }
    const items = [...cfg.social.reels, ...cfg.social.videos].filter((r) => r.url);
    if (!items.length) return;
    const list = root.querySelector('[data-reel-list]')!;
    const tpl = document.querySelector<HTMLTemplateElement>('[data-reel-template]')!;
    for (const item of items) {
      const node = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      const title = tl(item.title, lang);
      node.querySelector('[data-reel-title]')!.textContent = title;
      const btn = node.querySelector<HTMLButtonElement>('[data-reel-play]')!;
      btn.setAttribute('aria-label', format(root.dataset.playLabel ?? '', { title }));
      btn.addEventListener('click', () => {
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(item.url)}&show_text=false&autoplay=true`;
        iframe.title = title;
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.className = 'absolute inset-0 h-full w-full border-0';
        btn.replaceWith(iframe);
      });
      list.appendChild(node);
    }
    root.querySelector<HTMLElement>('[data-reels]')!.hidden = false;
  });
}
