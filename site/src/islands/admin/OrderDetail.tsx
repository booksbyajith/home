import { l10nText as tl } from '@shared/l10n';
import { OVERSEAS, regionLine } from '@shared/districts';
import { formatLKR } from '@shared/pricing';
import { TRANSITIONS, requiredFields, templateKeyFor } from '@shared/status';
import { bookTitles, buildTrackUrl, buildWaUrl, buildMapsUrl, renderTemplate } from '@shared/templates';
import type { AuditEvent, OrderDoc, OrderStatus, PrivateConfig, PublicConfig } from '@shared/types';
import { useEffect, useState } from 'preact/hooks';
import type { I18nKey } from '../../i18n/si';
import { call, callError } from '../../lib/firebase';
import { adminFirebase, ms, type Ts } from './fb';
import { Section, fmtDate, useAdmin, useT } from './ui';

const ACTION: Record<OrderStatus, I18nKey> = {
  acknowledged: 'admin.action.acknowledge',
  payment_verified: 'admin.action.verify',
  dispatched: 'admin.action.dispatch',
  delivered: 'admin.action.deliver',
  rejected: 'admin.action.reject',
  cancelled: 'admin.action.cancel',
  pending_verification: 'admin.action.reopen',
};

export function OrderDetail({ orderId }: { orderId: string }) {
  const t = useT();
  const { lang, siteUrl } = useAdmin();
  const [order, setOrder] = useState<OrderDoc | null | undefined>(undefined);
  const [audit, setAudit] = useState<(AuditEvent & { id: string })[]>([]);
  const [pub, setPub] = useState<PublicConfig | null>(null);
  const [priv, setPriv] = useState<PrivateConfig | null>(null);
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [courier, setCourier] = useState('');
  const [courierOther, setCourierOther] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [waUrl, setWaUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [slip, setSlip] = useState<{ url: string; type: string } | null>(null);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    void (async () => {
      const { db } = await adminFirebase();
      const fs = await import('firebase/firestore');
      unsubs.push(
        fs.onSnapshot(fs.doc(db, 'orders', orderId), (s) =>
          setOrder(s.exists() ? (s.data() as OrderDoc) : null),
        ),
      );
      unsubs.push(
        fs.onSnapshot(
          fs.query(fs.collection(db, 'orders', orderId, 'audit'), fs.orderBy('at', 'desc')),
          (s) => setAudit(s.docs.map((d) => ({ id: d.id, ...(d.data() as AuditEvent) }))),
        ),
      );
      setPub((await fs.getDoc(fs.doc(db, 'config/public'))).data() as PublicConfig);
      setPriv((await fs.getDoc(fs.doc(db, 'config/private'))).data() as PrivateConfig);
    })();
    return () => unsubs.forEach((u) => u());
  }, [orderId]);

  if (order === undefined) return <p>…</p>;
  if (order === null) return <p>{t('admin.orders.none')}</p>;

  const resendUrl = (() => {
    const key = templateKeyFor(order.status);
    if (!key || !priv || !order.customer.whatsapp) return null;
    const tpl = priv.templates[key]?.[order.lang] || priv.templates[key]?.en;
    if (!tpl) return null;
    const text = renderTemplate(tpl, {
      name: order.customer.name,
      orderId: order.orderId,
      bookTitles: bookTitles(order.items, order.lang),
      total: formatLKR(order.totals.grandTotalLKR),
      courier: order.dispatch?.courier ?? '',
      trackingNo: order.dispatch?.trackingNo ?? '',
      trackingUrl: buildTrackUrl(siteUrl, order.lang, order.orderId),
      facebookUrl: pub?.contact.facebookPageUrl ?? '',
      reason: order.rejection?.reason ?? '',
    });
    return buildWaUrl(order.customer.whatsapp, text);
  })();

  const act = async (to: OrderStatus) => {
    const need = requiredFields(to);
    const c = courier === '__other' ? courierOther.trim() : courier;
    const data: Record<string, string> = { orderId, to };
    if (need.includes('courier') || to === 'dispatched') {
      if (!c || !trackingNo.trim()) return setErr(t('admin.error.missing'));
      data.courier = c;
      data.trackingNo = trackingNo.trim();
    }
    if (to === 'rejected' && reason.trim().length < 3) return setErr(t('admin.error.missing'));
    if ((to === 'rejected' || to === 'cancelled') && reason.trim()) data.reason = reason.trim();
    setErr(null);
    setWaUrl(null);
    // Open the WhatsApp tab synchronously (inside the click) so pop-up blockers allow it.
    const win = templateKeyFor(to) ? window.open('', '_blank') : null;
    setBusy(true);
    try {
      const r = await call<Record<string, string>, { waUrl: string | null }>('updateOrderStatus', data);
      setWaUrl(r.waUrl);
      if (win && r.waUrl) win.location.href = r.waUrl;
      else win?.close();
      setPending(null);
      setReason('');
    } catch (e) {
      win?.close();
      const ce = callError(e);
      setErr(
        ce.code === 'INVALID_TRANSITION'
          ? t('admin.error.transition')
          : ce.code === 'MISSING_FIELDS'
            ? t('admin.error.missing')
            : `${ce.status} ${ce.code ?? ''}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const start = (to: OrderStatus) => {
    setErr(null);
    if (to === 'dispatched' || to === 'rejected' || to === 'cancelled') setPending(to);
    else void act(to);
  };

  const viewSlip = async () => {
    const r = await call<{ orderId: string }, { url: string; contentType: string }>('getSlipUrl', {
      orderId,
    });
    let url = r.url;
    if (url.startsWith('data:')) {
      // Emulator only: decode locally (fetching a data: URL is blocked by the CSP's connect-src).
      const bin = atob(url.slice(url.indexOf(',') + 1));
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      url = URL.createObjectURL(new Blob([bytes], { type: r.contentType }));
    }
    if (r.contentType === 'application/pdf') window.open(url, '_blank', 'noopener');
    setSlip({ url, type: r.contentType });
  };

  const addNote = async () => {
    if (!note.trim()) return;
    await call('addOrderNote', { orderId, note: note.trim() });
    setNote('');
  };

  const a = order.address;
  const next = TRANSITIONS[order.status];

  return (
    <div data-screen="order-detail" data-order-status={order.status}>
      <p>
        <a href="#/orders">← {t('admin.nav.orders')}</a>
      </p>
      <div class="mt-2 flex flex-wrap items-center gap-3">
        <h1 class="font-mono text-2xl font-bold">{order.orderId}</h1>
        <span class="badge bg-maroon text-white" data-testid="detail-status">
          {t(`status.${order.status}` as I18nKey)}
        </span>
        {order.totalMismatch && (
          <span class="badge bg-warn-bg text-danger">{t('admin.orders.mismatch')}</span>
        )}
        {order.anonymisedAt && <span class="badge bg-paper-dark">{t('admin.order.anonymised')}</span>}
      </div>
      <p class="text-sm text-ink-soft">{fmtDate(lang, ms(order.createdAt as Ts))}</p>

      <Section title={t('admin.action.confirm')} id="actions">
        <div class="flex flex-wrap gap-2">
          {next.map((to) => (
            <button
              type="button"
              class={to === 'rejected' || to === 'cancelled' ? 'btn-secondary' : 'btn-primary'}
              onClick={() => start(to)}
              disabled={busy}
              data-action-to={to}
            >
              {t(ACTION[to])}
            </button>
          ))}
          {resendUrl && (
            <a class="btn-quiet" href={resendUrl} target="_blank" rel="noopener" data-testid="resend-wa">
              {t('admin.action.resend')} ↗
            </a>
          )}
        </div>
        {pending === 'dispatched' && (
          <div class="mt-4 grid gap-3 md:grid-cols-3" data-testid="dispatch-form">
            <div>
              <label class="field-label text-sm" for="d-courier">
                {t('admin.field.courier')}
              </label>
              <select
                id="d-courier"
                class="field-input"
                value={courier}
                onChange={(e) => setCourier((e.currentTarget as HTMLSelectElement).value)}
              >
                <option value="">—</option>
                {(pub?.couriers ?? []).map((c) => (
                  <option value={c.name}>{c.name}</option>
                ))}
                <option value="__other">{t('admin.field.courierOther')}</option>
              </select>
              {courier === '__other' && (
                <input
                  class="field-input mt-2"
                  aria-label={t('admin.field.courierOther')}
                  value={courierOther}
                  onInput={(e) => setCourierOther((e.currentTarget as HTMLInputElement).value)}
                />
              )}
            </div>
            <div>
              <label class="field-label text-sm" for="d-tracking">
                {t('admin.field.trackingNo')}
              </label>
              <input
                id="d-tracking"
                class="field-input"
                value={trackingNo}
                onInput={(e) => setTrackingNo((e.currentTarget as HTMLInputElement).value)}
              />
            </div>
            <div class="flex items-end">
              <button
                type="button"
                class="btn-primary"
                onClick={() => act('dispatched')}
                disabled={busy}
                data-confirm-action
              >
                {t('admin.action.confirm')}
              </button>
            </div>
          </div>
        )}
        {(pending === 'rejected' || pending === 'cancelled') && (
          <div class="mt-4">
            <label class="field-label text-sm" for="d-reason">
              {t('admin.field.reason')}
            </label>
            <textarea
              id="d-reason"
              class="field-input"
              rows={2}
              value={reason}
              onInput={(e) => setReason((e.currentTarget as HTMLTextAreaElement).value)}
            />
            <button
              type="button"
              class="btn-primary mt-2"
              onClick={() => act(pending)}
              disabled={busy}
              data-confirm-action
            >
              {t('admin.action.confirm')}
            </button>
          </div>
        )}
        {err && (
          <p class="field-error" role="alert">
            {err}
          </p>
        )}
        {waUrl && (
          <p class="mt-3">
            <a class="btn-primary" href={waUrl} target="_blank" rel="noopener" data-testid="wa-link">
              {t('admin.action.sendWhatsapp')} ↗
            </a>
          </p>
        )}
      </Section>

      <div class="grid gap-x-6 lg:grid-cols-2">
        <Section title={t('admin.order.customer')}>
          <p class="font-semibold">{order.customer.name}</p>
          <p>
            📞 <a href={`tel:+${order.customer.mobile}`}>+{order.customer.mobile}</a>
          </p>
          <p>
            WhatsApp:{' '}
            <a href={buildWaUrl(order.customer.whatsapp, '')} target="_blank" rel="noopener">
              +{order.customer.whatsapp}
            </a>
          </p>
          {order.customer.email && <p>✉ {order.customer.email}</p>}
          <p class="text-sm text-ink-soft">{{ si: 'සිංහල', en: 'English', ta: 'தமிழ்' }[order.lang]}</p>
        </Section>
        <Section title={t('admin.order.address')}>
          <p data-testid="detail-address">
            {[a.line1, a.line2, a.city].filter(Boolean).join(', ')}
            <br />
            {regionLine(a, lang)}
          </p>
          {a.landmark && <p class="text-sm">{a.landmark}</p>}
          {order.geo && (
            <p class="mt-2">
              <a
                href={buildMapsUrl(order.geo.lat, order.geo.lng)}
                target="_blank"
                rel="noopener"
                data-testid="maps-link"
              >
                📍 {t('admin.order.map')} (±{order.geo.accuracyM} m)
              </a>
            </p>
          )}
        </Section>
      </div>

      <Section title={t('admin.order.items')}>
        <ul>
          {order.items.map((i) => (
            <li class="flex justify-between">
              <span>
                {tl(i.title, lang)} × {i.qty}
                {i.preorder && ' (pre-order)'}
              </span>
              <span>{formatLKR(i.lineTotalLKR)}</span>
            </li>
          ))}
        </ul>
        <p class="mt-2 flex justify-between border-t border-line pt-2 font-bold">
          <span>{t('order.summary.total')}</span>
          <span>{formatLKR(order.totals.grandTotalLKR)}</span>
        </p>
        <p class="text-sm text-ink-soft">
          {t('order.summary.delivery')}:{' '}
          {a.districtId === OVERSEAS
            ? t('order.summary.deliveryOverseas')
            : formatLKR(order.totals.deliveryFeeLKR)}{' '}
          · {t('order.summary.bundle')}: {formatLKR(order.totals.bundleDiscountLKR)}
        </p>
        {order.signedCopy && <p class="mt-2 font-semibold">✍ {t('admin.order.signed')}</p>}
        {order.dedicationNote && (
          <p class="mt-1">
            {t('admin.order.dedication')}: {order.dedicationNote}
          </p>
        )}
        {order.dispatch && (
          <p class="mt-2">
            {order.dispatch.courier} · <span class="font-mono">{order.dispatch.trackingNo}</span>
          </p>
        )}
        {order.rejection && <p class="mt-2 text-danger">{order.rejection.reason}</p>}
      </Section>

      <Section title={t('admin.order.slip')}>
        {order.slip ? (
          <>
            <button type="button" class="btn-secondary" onClick={viewSlip} data-view-slip>
              {order.slip.contentType === 'application/pdf'
                ? t('admin.order.openPdf')
                : t('admin.order.viewSlip')}
            </button>
            {slip && slip.type.startsWith('image/') && (
              <img
                src={slip.url}
                alt={t('admin.order.slip')}
                class="mt-3 max-h-[70vh] w-auto rounded border border-line"
                data-testid="slip-image"
              />
            )}
            {slip && slip.type === 'application/pdf' && (
              <p class="mt-2">
                <a href={slip.url} target="_blank" rel="noopener">
                  {t('admin.order.openPdf')} ↗
                </a>
              </p>
            )}
          </>
        ) : (
          <p class="text-ink-soft">—</p>
        )}
      </Section>

      <div class="grid gap-x-6 lg:grid-cols-2">
        <Section title={t('admin.order.timeline')}>
          <ol class="space-y-1">
            {order.statusHistory.map((h) => (
              <li>
                <strong>{t(`status.${h.status}` as I18nKey)}</strong> — {fmtDate(lang, ms(h.at as Ts))}
              </li>
            ))}
          </ol>
        </Section>
        <Section title={t('admin.order.notes')}>
          <textarea
            class="field-input"
            rows={2}
            aria-label={t('admin.order.addNote')}
            value={note}
            onInput={(e) => setNote((e.currentTarget as HTMLTextAreaElement).value)}
          />
          <button type="button" class="btn-secondary mt-2" onClick={addNote}>
            {t('admin.order.addNote')}
          </button>
        </Section>
      </div>

      <Section title={t('admin.order.audit')}>
        <ul class="space-y-2 text-sm" data-testid="audit-log">
          {audit.map((e) => (
            <li class="border-b border-line pb-1">
              <span class="text-ink-soft">{fmtDate(lang, ms(e.at as Ts))}</span> · <strong>{e.type}</strong>
              {e.from || e.to ? ` ${e.from ?? '∅'} → ${e.to}` : ''} · {e.by?.email ?? 'customer'}
              {e.note && <span class="block">{e.note}</span>}
              {e.meta && (
                <span class="block text-ink-soft">
                  {Object.entries(e.meta)
                    .map(([k, v]) => `${k}: ${String(v)}`)
                    .join(', ')}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
