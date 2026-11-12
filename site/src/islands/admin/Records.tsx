import { toCsv } from '@shared/csv';
import { buildOrderUrl, buildWaUrl, renderTemplate } from '@shared/templates';
import type { PrivateConfig } from '@shared/types';
import { useEffect, useState } from 'preact/hooks';
import { call } from '../../lib/firebase';
import { adminFirebase, ms, type Ts } from './fb';
import { Section, downloadText, fmtDate, useAdmin, useT } from './ui';

type Doc = Record<string, unknown> & { id: string };

function useCollection(name: string, orderField: string) {
  const [rows, setRows] = useState<Doc[] | null>(null);
  useEffect(() => {
    let unsub = () => {};
    void (async () => {
      const { db } = await adminFirebase();
      const fs = await import('firebase/firestore');
      unsub = fs.onSnapshot(
        fs.query(fs.collection(db, name), fs.orderBy(orderField, 'desc'), fs.limit(200)),
        (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      );
    })();
    return () => unsub();
  }, [name]);
  return rows;
}

export function Reviews() {
  const t = useT();
  const { lang } = useAdmin();
  const rows = useCollection('review_submissions', 'createdAt');
  const act = (id: string, action: string) => call('moderateReview', { id, action });
  return (
    <div data-screen="reviews">
      {(rows ?? []).map((r) => (
        <Section title={`${String(r.displayName)} · ${'★'.repeat(Number(r.rating))}`} id={`review-${r.id}`}>
          <p class="text-sm text-ink-soft">
            {String(r.slug)} · {fmtDate(lang, ms(r.createdAt as Ts))} ·{' '}
            <span data-review-status>{String(r.status)}</span>
          </p>
          <p class="mt-2 whitespace-pre-line">{String(r.text)}</p>
          <div class="mt-3 flex gap-2">
            {r.status !== 'approved' && (
              <button
                type="button"
                class="btn-primary min-h-9 px-3 py-0"
                onClick={() => act(r.id, 'approve')}
                data-approve
              >
                {t('admin.reviews.approve')}
              </button>
            )}
            {r.status === 'pending' && (
              <button
                type="button"
                class="btn-secondary min-h-9 px-3 py-0"
                onClick={() => act(r.id, 'reject')}
              >
                {t('admin.reviews.reject')}
              </button>
            )}
            {r.status === 'approved' && (
              <button
                type="button"
                class="btn-secondary min-h-9 px-3 py-0"
                onClick={() => act(r.id, 'unpublish')}
              >
                {t('admin.reviews.unpublish')}
              </button>
            )}
          </div>
        </Section>
      ))}
      {rows?.length === 0 && <p class="text-ink-soft">—</p>}
    </div>
  );
}

export function Subscribers() {
  const t = useT();
  const { lang } = useAdmin();
  const rows = useCollection('newsletter_subscribers', 'consentAt');
  const active = (rows ?? []).filter((r) => !r.unsubscribedAt);
  const csv = () =>
    downloadText(
      toCsv(active, [
        { header: 'email', value: (r) => String(r.email) },
        { header: 'lang', value: (r) => String(r.lang) },
        { header: 'consentAt', value: (r) => new Date(ms(r.consentAt as Ts)).toISOString() },
        { header: 'source', value: (r) => String(r.source) },
      ]),
      'subscribers.csv',
    );
  return (
    <div data-screen="subscribers">
      <button type="button" class="btn-secondary mb-4" onClick={csv} data-export-subs>
        {t('admin.subs.export')} ({active.length})
      </button>
      <ul class="space-y-1">
        {(rows ?? []).map((r) => (
          <li class={`card flex flex-wrap justify-between gap-2 p-2 ${r.unsubscribedAt ? 'opacity-60' : ''}`}>
            <span>{String(r.email)}</span>
            <span class="text-sm text-ink-soft">
              {String(r.lang)} · {fmtDate(lang, ms(r.consentAt as Ts), false)}
              {r.unsubscribedAt ? ' · ✕' : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Alerts() {
  const t = useT();
  const { lang, siteUrl } = useAdmin();
  const rows = useCollection('stock_alerts', 'createdAt');
  const [tpl, setTpl] = useState<PrivateConfig['templates'] | null>(null);
  useEffect(() => {
    void (async () => {
      const { db } = await adminFirebase();
      const fs = await import('firebase/firestore');
      setTpl(
        ((await fs.getDoc(fs.doc(db, 'config/private'))).data() as PrivateConfig | undefined)?.templates ??
          null,
      );
    })();
  }, []);
  return (
    <div data-screen="alerts">
      {(rows ?? []).map((r) => {
        const c = r.contact as { whatsapp: string | null; email: string | null };
        const l = (r.lang as 'si' | 'en') ?? 'si';
        const text = tpl
          ? renderTemplate(tpl.back_in_stock[l], {
              bookTitles: String(r.slug),
              orderUrl: buildOrderUrl(siteUrl, l, String(r.slug)),
            })
          : '';
        return (
          <div
            class={`card mb-2 flex flex-wrap items-center justify-between gap-2 p-3 ${r.notifiedAt ? 'opacity-60' : ''}`}
          >
            <span>
              <strong>{String(r.slug)}</strong> · {c.whatsapp ? `+${c.whatsapp}` : c.email} ·{' '}
              {fmtDate(lang, ms(r.createdAt as Ts), false)}
            </span>
            <span class="flex gap-2">
              {c.whatsapp && (
                <a
                  class="btn-secondary min-h-9 px-3 py-0"
                  href={buildWaUrl(c.whatsapp, text)}
                  target="_blank"
                  rel="noopener"
                >
                  WhatsApp ↗
                </a>
              )}
              {!r.notifiedAt && (
                <button
                  type="button"
                  class="btn-quiet min-h-9 px-3 py-0"
                  onClick={() =>
                    call('adminUpdateRecord', {
                      collection: 'stock_alerts',
                      id: r.id,
                      action: 'mark_notified',
                    })
                  }
                >
                  {t('admin.alerts.markNotified')}
                </button>
              )}
            </span>
          </div>
        );
      })}
      {rows?.length === 0 && <p class="text-ink-soft">—</p>}
    </div>
  );
}

export function Enquiries() {
  const t = useT();
  const { lang } = useAdmin();
  const rows = useCollection('enquiries', 'createdAt');
  return (
    <div data-screen="enquiries">
      {(rows ?? []).map((r) => (
        <Section title={`${String(r.organisation)} (${String(r.kind)})`} id={`enq-${r.id}`}>
          <p class="text-sm text-ink-soft">
            {fmtDate(lang, ms(r.createdAt as Ts))} {r.handledAt ? '· ✓' : ''}
          </p>
          <p>
            {String(r.contactName)} · +{String(r.phone)} {r.email ? `· ${String(r.email)}` : ''}
          </p>
          <p>{(r.books as { slug: string; qty: number }[]).map((b) => `${b.slug} × ${b.qty}`).join(', ')}</p>
          {r.message ? <p class="mt-1 whitespace-pre-line">{String(r.message)}</p> : null}
          <div class="mt-2 flex gap-2">
            {!r.handledAt && (
              <button
                type="button"
                class="btn-secondary min-h-9 px-3 py-0"
                onClick={() =>
                  call('adminUpdateRecord', { collection: 'enquiries', id: r.id, action: 'mark_handled' })
                }
              >
                {t('admin.enquiries.markHandled')}
              </button>
            )}
            <a
              class="btn-quiet min-h-9 px-3 py-0"
              href={buildWaUrl(String(r.phone), '')}
              target="_blank"
              rel="noopener"
            >
              WhatsApp ↗
            </a>
          </div>
        </Section>
      ))}
      {rows?.length === 0 && <p class="text-ink-soft">—</p>}
    </div>
  );
}
