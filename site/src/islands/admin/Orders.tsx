import { l10nText as tl } from '@shared/l10n';
import type { L10n } from '@shared/types';
import { toCsv } from '@shared/csv';
import { districtName } from '@shared/districts';
import { formatLKR } from '@shared/pricing';
import { normaliseSearchQuery } from '@shared/search';
import { ORDER_STATUSES, type OrderDoc, type OrderStatus } from '@shared/types';
import { useEffect, useState } from 'preact/hooks';
import type { I18nKey } from '../../i18n/si';
import { adminFirebase, ms, type Ts } from './fb';
import { downloadText, fmtDate, useAdmin, useT } from './ui';

type Row = OrderDoc & { id: string };
const PAGE = 25;

export function ordersCsv(rows: Row[]): string {
  return toCsv(rows, [
    { header: 'orderId', value: (r) => r.orderId },
    { header: 'date', value: (r) => new Date(ms(r.createdAt as Ts)).toISOString() },
    { header: 'name', value: (r) => r.customer.name },
    { header: 'mobile', value: (r) => r.customer.mobile },
    { header: 'whatsapp', value: (r) => r.customer.whatsapp },
    { header: 'addressLine1', value: (r) => r.address.line1 },
    { header: 'addressLine2', value: (r) => r.address.line2 },
    { header: 'city', value: (r) => r.address.city },
    { header: 'district', value: (r) => districtName(r.address.districtId, 'en') },
    { header: 'postalCode', value: (r) => r.address.postalCode },
    { header: 'country', value: (r) => r.address.country ?? '' },
    { header: 'landmark', value: (r) => r.address.landmark },
    { header: 'items', value: (r) => r.items.map((i) => `${i.title.en} x${i.qty}`).join('; ') },
    { header: 'totalQty', value: (r) => r.totalQty },
    { header: 'totalLKR', value: (r) => r.totals.grandTotalLKR },
    { header: 'status', value: (r) => r.status },
    { header: 'courier', value: (r) => r.dispatch?.courier },
    { header: 'trackingNo', value: (r) => r.dispatch?.trackingNo },
  ]);
}

export function Orders() {
  const t = useT();
  const { lang } = useAdmin();
  const init = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const [status, setStatus] = useState<OrderStatus | ''>((init.get('status') as OrderStatus) || '');
  const [book, setBook] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [limitN, setLimitN] = useState(PAGE);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [books, setBooks] = useState<{ slug: string; title: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    void (async () => {
      const { db } = await adminFirebase();
      const fs = await import('firebase/firestore');
      const snap = await fs.getDocs(fs.collection(db, 'books'));
      setBooks(snap.docs.map((d) => ({ slug: d.id, title: tl(d.get('title') as L10n, lang) })));
    })();
  }, [lang]);

  useEffect(() => {
    let unsub = () => {};
    void (async () => {
      const { db } = await adminFirebase();
      const fs = await import('firebase/firestore');
      const c: import('firebase/firestore').QueryConstraint[] = [];
      if (search) c.push(fs.where('search', 'array-contains', normaliseSearchQuery(search)));
      else {
        if (status) c.push(fs.where('status', '==', status));
        if (book) c.push(fs.where('bookSlugs', 'array-contains', book));
      }
      if (from)
        c.push(fs.where('createdAt', '>=', fs.Timestamp.fromDate(new Date(`${from}T00:00:00+05:30`))));
      if (to)
        c.push(
          fs.where(
            'createdAt',
            '<',
            fs.Timestamp.fromMillis(new Date(`${to}T00:00:00+05:30`).getTime() + 86400_000),
          ),
        );
      const qy = fs.query(
        fs.collection(db, 'orders'),
        ...c,
        fs.orderBy('createdAt', 'desc'),
        fs.limit(limitN),
      );
      unsub = fs.onSnapshot(qy, (snap) => {
        let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) }));
        if (search && status) list = list.filter((r) => r.status === status);
        if (search && book) list = list.filter((r) => r.bookSlugs.includes(book));
        setRows(list);
      });
    })();
    return () => unsub();
  }, [status, book, from, to, search, limitN]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const chosen = (rows ?? []).filter((r) => selected.size === 0 || selected.has(r.id));

  return (
    <div data-screen="orders">
      <form
        class="card mb-4 grid items-end gap-3 p-3 md:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <div class="md:col-span-2">
          <label class="field-label text-sm" for="o-q">
            {t('admin.orders.search')}
          </label>
          <input
            id="o-q"
            class="field-input"
            value={q}
            onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)}
            onBlur={() => setSearch(q.trim())}
            data-order-search
          />
        </div>
        <div>
          <label class="field-label text-sm" for="o-status">
            {t('admin.orders.filter.status')}
          </label>
          <select
            id="o-status"
            class="field-input"
            value={status}
            onChange={(e) => setStatus((e.currentTarget as HTMLSelectElement).value as OrderStatus)}
          >
            <option value="">{t('admin.orders.filter.all')}</option>
            {ORDER_STATUSES.map((s) => (
              <option value={s}>{t(`status.${s}` as I18nKey)}</option>
            ))}
          </select>
        </div>
        <div>
          <label class="field-label text-sm" for="o-book">
            {t('admin.orders.filter.book')}
          </label>
          <select
            id="o-book"
            class="field-input"
            value={book}
            onChange={(e) => setBook((e.currentTarget as HTMLSelectElement).value)}
          >
            <option value="">{t('admin.orders.filter.all')}</option>
            {books.map((b) => (
              <option value={b.slug}>{b.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label class="field-label text-sm" for="o-from">
            {t('admin.orders.filter.from')}
          </label>
          <input
            id="o-from"
            type="date"
            class="field-input"
            value={from}
            onInput={(e) => setFrom((e.currentTarget as HTMLInputElement).value)}
          />
        </div>
        <div>
          <label class="field-label text-sm" for="o-to">
            {t('admin.orders.filter.to')}
          </label>
          <input
            id="o-to"
            type="date"
            class="field-input"
            value={to}
            onInput={(e) => setTo((e.currentTarget as HTMLInputElement).value)}
          />
        </div>
        <button type="submit" hidden />
      </form>

      <div class="mb-3 flex flex-wrap items-center gap-2">
        {selected.size > 0 && (
          <span class="badge bg-paper-dark">{t('admin.orders.selected', { n: selected.size })}</span>
        )}
        <button
          type="button"
          class="btn-secondary min-h-9 px-3 py-1"
          onClick={() =>
            downloadText(ordersCsv(chosen), `orders-${new Date().toISOString().slice(0, 10)}.csv`)
          }
          data-export-csv
        >
          {t('admin.orders.exportCsv')}
        </button>
        <a
          class="btn-secondary min-h-9 px-3 py-1"
          href={`#/print?ids=${chosen.map((r) => r.id).join(',')}`}
          data-print-labels
        >
          {t('admin.orders.printLabels')}
        </a>
      </div>

      {rows === null ? (
        <p>…</p>
      ) : rows.length === 0 ? (
        <p class="text-ink-soft">{t('admin.orders.none')}</p>
      ) : (
        <ul class="space-y-2" data-testid="order-list">
          {rows.map((r) => (
            <li class="card flex items-start gap-3 p-3" data-order-row={r.id}>
              <input
                type="checkbox"
                class="mt-1 h-5 w-5 accent-maroon"
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
                aria-label={r.id}
              />
              <a href={`#/orders/${r.id}`} class="flex-1 text-ink no-underline">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="font-mono font-semibold">{r.id}</span>
                  <span class="badge bg-paper-dark" data-row-status={r.status}>
                    {t(`status.${r.status}` as I18nKey)}
                  </span>
                </div>
                <div class="mt-1 flex flex-wrap justify-between gap-2 text-sm">
                  <span>
                    {r.customer.name} · {districtName(r.address.districtId, lang)}
                  </span>
                  <span>
                    {fmtDate(lang, ms(r.createdAt as Ts))} ·{' '}
                    <strong>{formatLKR(r.totals.grandTotalLKR)}</strong>
                    {r.totalMismatch && (
                      <span class="badge ml-2 bg-warn-bg text-danger">{t('admin.orders.mismatch')}</span>
                    )}
                  </span>
                </div>
                <p class="text-sm text-ink-soft">
                  {r.items.map((i) => `${tl(i.title, lang)} ×${i.qty}`).join(', ')}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
      {rows && rows.length >= limitN && (
        <button type="button" class="btn-secondary mt-4" onClick={() => setLimitN((n) => n + PAGE)}>
          {t('admin.orders.loadMore')}
        </button>
      )}
    </div>
  );
}
