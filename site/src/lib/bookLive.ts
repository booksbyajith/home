import { formatLKR, orderability } from '@shared/pricing';
import { fetchBooks } from './publicData';

/** Update every [data-book-live] block with live price and availability from Firestore. */
export function initBookStatus(): void {
  const blocks = document.querySelectorAll<HTMLElement>('[data-book-live]');
  if (!blocks.length || (window as unknown as { __bookLive?: boolean }).__bookLive) return;
  (window as unknown as { __bookLive?: boolean }).__bookLive = true;
  void fetchBooks().then((books) => {
    if (!books) return;
    for (const el of blocks) {
      const book = books[el.dataset.bookLive ?? ''];
      if (!book) continue;
      const labels = JSON.parse(el.dataset.labels ?? '{}') as Record<string, string>;
      const reason = orderability(book, 1);
      const direct = reason === 'ok';
      const price = el.querySelector('[data-price]');
      if (price) price.textContent = book.priceLKR > 0 ? formatLKR(book.priceLKR) : labels.tba;
      const avail = el.querySelector('[data-availability]');
      if (avail)
        avail.textContent = direct
          ? book.preorder
            ? labels.pre
            : book.stock > 0 && book.stock <= 5
              ? labels.low
              : ''
          : book.saleMode === 'direct' && (reason === 'not_in_stock' || reason === 'insufficient_stock')
            ? labels.out
            : book.saleMode === 'external'
              ? ''
              : labels.unavailable;
      const order = el.querySelector<HTMLElement>('[data-action="order"]');
      if (order) order.hidden = !direct;
      const ext = el.querySelector<HTMLAnchorElement>('[data-action="external"]');
      if (ext) {
        ext.hidden = !(book.saleMode === 'external' && book.externalUrl);
        if (book.externalUrl) ext.href = book.externalUrl;
      }
      const notify = el.querySelector<HTMLElement>('[data-action="notify"]');
      if (notify) notify.hidden = direct || book.saleMode === 'external';
      el.dataset.state = direct ? 'orderable' : book.saleMode;
    }
  });
}
