import { l10nText as tl } from '@shared/l10n';
import type { BookDoc, SaleMode } from '@shared/types';
import { useEffect, useState } from 'preact/hooks';
import { call, callError } from '../../lib/firebase';
import { adminFirebase } from './fb';
import { L10nIn, NumIn, SaveBar, Section, TextIn, Toggle, useAdmin, useT } from './ui';

function BookEditor({ book }: { book: BookDoc }) {
  const t = useT();
  const { lang } = useAdmin();
  const [b, setB] = useState(book);
  const [state, setState] = useState('idle');
  const set = <K extends keyof BookDoc>(k: K, v: BookDoc[K]) => {
    setB((x) => ({ ...x, [k]: v }));
    setState('idle');
  };
  const save = async () => {
    setState('saving');
    try {
      await call('updateBook', {
        slug: b.slug,
        priceLKR: b.priceLKR,
        saleMode: b.saleMode,
        externalUrl: b.externalUrl || null,
        stock: b.stock,
        inStock: b.inStock,
        preorder: b.preorder,
        preorderNote: b.preorderNote,
        signedCopyAvailable: b.signedCopyAvailable,
      });
      setState('saved');
    } catch (e) {
      const ce = callError(e);
      setState(`${ce.code ?? ce.status} ${ce.fields.join(', ')}`);
    }
  };
  return (
    <Section title={tl(b.title, lang)} id={`book-${b.slug}`}>
      <div class="grid gap-x-4 md:grid-cols-3">
        <NumIn
          label={t('admin.books.price')}
          name="priceLKR"
          value={b.priceLKR}
          onInput={(v) => set('priceLKR', v)}
        />
        <NumIn label={t('admin.books.stock')} name="stock" value={b.stock} onInput={(v) => set('stock', v)} />
        <div class="mb-3">
          <label class="field-label text-sm" for={`mode-${b.slug}`}>
            {t('admin.books.saleMode')}
          </label>
          <select
            id={`mode-${b.slug}`}
            name="saleMode"
            class="field-input"
            value={b.saleMode}
            onChange={(e) => set('saleMode', (e.currentTarget as HTMLSelectElement).value as SaleMode)}
          >
            <option value="direct">{t('admin.books.mode.direct')}</option>
            <option value="external">{t('admin.books.mode.external')}</option>
            <option value="unavailable">{t('admin.books.mode.unavailable')}</option>
          </select>
        </div>
      </div>
      {b.saleMode === 'external' && (
        <TextIn
          label={t('admin.books.externalUrl')}
          type="url"
          value={b.externalUrl ?? ''}
          onInput={(v) => set('externalUrl', v)}
        />
      )}
      <div class="flex flex-wrap gap-x-6">
        <Toggle
          label={t('admin.books.inStock')}
          name="inStock"
          checked={b.inStock}
          onChange={(v) => set('inStock', v)}
        />
        <Toggle label={t('admin.books.preorder')} checked={b.preorder} onChange={(v) => set('preorder', v)} />
        <Toggle
          label={t('admin.books.signed')}
          checked={b.signedCopyAvailable}
          onChange={(v) => set('signedCopyAvailable', v)}
        />
      </div>
      {b.preorder && (
        <L10nIn
          label={t('admin.books.preorderNote')}
          value={b.preorderNote ?? { si: '', en: '' }}
          onInput={(v) => set('preorderNote', v)}
        />
      )}
      <SaveBar onSave={save} state={state} />
    </Section>
  );
}

export function Books() {
  const [books, setBooks] = useState<BookDoc[] | null>(null);
  useEffect(() => {
    void (async () => {
      const { db } = await adminFirebase();
      const fs = await import('firebase/firestore');
      const snap = await fs.getDocs(fs.collection(db, 'books'));
      setBooks(snap.docs.map((d) => d.data() as BookDoc).sort((a, b) => a.sortOrder - b.sortOrder));
    })();
  }, []);
  return (
    <div data-screen="books">{books ? books.map((b) => <BookEditor key={b.slug} book={b} />) : '…'}</div>
  );
}
