import type { Lang } from '@shared/constants';
import { ORDER_ID_REGEX } from '@shared/constants';
import { formatLKR } from '@shared/pricing';
import { buildWaUrl } from '@shared/templates';
import { useEffect, useRef, useState } from 'preact/hooks';
import { getReceipt, type ReceiptData } from '../../lib/myOrders';
import { fetchPublicConfig } from '../../lib/publicData';
import {
  downloadBlob,
  downloadUrl,
  renderReceiptJpg,
  renderReceiptPdf,
  type RenderedReceipt,
} from '../../lib/receipt';
import { makeT, type MiniDict } from '../shared/i18n';
import { Receipt } from './Receipt';

interface Props {
  lang: Lang;
  dict: MiniDict;
  trackHref: string;
  trackAbsUrl: string;
}

export default function SuccessApp({ lang, dict, trackHref, trackAbsUrl }: Props) {
  const t = makeT(dict);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [wa, setWa] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState<'jpg' | 'pdf' | null>(null);
  const [failed, setFailed] = useState(false);
  const node = useRef<HTMLDivElement>(null);
  const cache = useRef<RenderedReceipt | null>(null);

  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1)).toUpperCase();
    if (!ORDER_ID_REGEX.test(id)) return;
    setOrderId(id);
    setReceipt(getReceipt(id));
    void import('qrcode').then((QR) =>
      QR.toDataURL(`${trackAbsUrl}#${id}`, { margin: 1, width: 280, errorCorrectionLevel: 'M' }).then(setQr),
    );
    void fetchPublicConfig().then((c) => {
      if (c?.contact.whatsappNumber)
        setWa(buildWaUrl(c.contact.whatsappNumber, t('success.waMessage', { orderId: id })));
    });
  }, []);

  const render = async () => {
    if (!cache.current && node.current) cache.current = await renderReceiptJpg(node.current);
    return cache.current!;
  };

  const dl = async (kind: 'jpg' | 'pdf') => {
    if (!orderId) return;
    setBusy(kind);
    setFailed(false);
    try {
      const r = await render();
      if (kind === 'jpg') downloadUrl(r.dataUrl, `receipt-${orderId}.jpg`);
      else downloadBlob(await renderReceiptPdf(r), `receipt-${orderId}.pdf`);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  if (!orderId)
    return (
      <p class="mt-4">
        <a href={trackHref} class="btn-primary">
          {t('success.track')}
        </a>
      </p>
    );

  return (
    <div class="mt-6 space-y-6" data-success-app>
      <div class="card p-5">
        <p class="text-ink-soft">{t('success.orderId')}</p>
        <p class="mt-1 font-mono text-3xl font-bold tracking-wide" data-testid="order-id">
          {orderId}
        </p>
        {receipt && (
          <>
            <ul class="mt-4 space-y-1">
              {receipt.items.map((i) => (
                <li class="flex justify-between gap-3">
                  <span>
                    {i.title[lang] || i.title.en} × {i.qty}
                  </span>
                  <span>{formatLKR(i.lineTotalLKR)}</span>
                </li>
              ))}
            </ul>
            <p class="mt-3 flex justify-between border-t border-line pt-3 text-lg font-bold">
              <span>{t('order.summary.total')}</span>
              <span data-testid="success-total">{formatLKR(receipt.totals.grandTotalLKR)}</span>
            </p>
            {receipt.totalMismatch && (
              <p class="mt-2 text-sm text-ink-soft">
                {t('success.totalChanged', { total: formatLKR(receipt.totals.grandTotalLKR) })}
              </p>
            )}
          </>
        )}
      </div>

      <section>
        <h2 class="text-xl font-bold">{t('success.next.title')}</h2>
        <ol class="mt-2 list-decimal space-y-1 pl-6">
          <li>{t('success.next.verify')}</li>
          <li>{t('success.next.message')}</li>
          <li>{t('success.next.dispatch')}</li>
        </ol>
      </section>

      <div class="flex flex-wrap gap-3">
        {wa && (
          <a href={wa} class="btn-primary" target="_blank" rel="noopener" data-testid="success-wa">
            {t('success.whatsapp')}
          </a>
        )}
        <a href={`${trackHref}#${orderId}`} class="btn-secondary">
          {t('success.track')}
        </a>
      </div>

      {receipt ? (
        <section class="card p-5">
          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="btn-secondary"
              onClick={() => dl('jpg')}
              disabled={!!busy || !qr}
              data-download="jpg"
            >
              {busy === 'jpg' ? t('success.generating') : t('success.downloadJpg')}
            </button>
            <button
              type="button"
              class="btn-secondary"
              onClick={() => dl('pdf')}
              disabled={!!busy || !qr}
              data-download="pdf"
            >
              {busy === 'pdf' ? t('success.generating') : t('success.downloadPdf')}
            </button>
          </div>
          {failed && (
            <p class="field-error" role="alert">
              {t('site.error.generic')}
            </p>
          )}
          <Receipt
            ref={node}
            lang={lang}
            r={receipt}
            qr={qr}
            qrUrl={`${trackAbsUrl}#${orderId}`}
            t={t}
            siteName={t('site.name')}
          />
        </section>
      ) : (
        <p class="text-ink-soft">{t('success.noReceipt')}</p>
      )}
    </div>
  );
}
