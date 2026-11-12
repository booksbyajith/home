import { fetchReviews } from './publicData';

/** Render approved reader reviews (public, moderated) into [data-reviews]. */
export function initReviews(): void {
  const root = document.querySelector<HTMLElement>('[data-reviews]');
  const tpl = document.querySelector<HTMLTemplateElement>('[data-review-template]');
  if (!root || !tpl) return;
  const run = async () => {
    const reviews = await fetchReviews(root.dataset.reviews ?? '');
    if (!reviews.length) return;
    const list = root.querySelector('[data-reviews-list]')!;
    for (const r of reviews) {
      const node = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      node.querySelector('[data-review-stars]')!.textContent = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
      node.querySelector('[data-review-stars]')!.setAttribute('aria-label', `${r.rating}/5`);
      node.querySelector('[data-review-text]')!.textContent = r.text;
      node.querySelector('[data-review-name]')!.textContent = r.displayName;
      node.setAttribute('lang', r.lang);
      list.appendChild(node);
    }
    root.querySelector<HTMLElement>('[data-reviews-empty]')!.hidden = true;
  };
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      void run();
    }
  });
  io.observe(root);
}
