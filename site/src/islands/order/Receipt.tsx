import type { Lang } from '@shared/constants';
import { formatLKR } from '@shared/pricing';
import { forwardRef } from 'preact/compat';
import { formatDate } from '../../i18n/index';
import type { ReceiptData } from '../../lib/myOrders';
import type { I18nKey } from '../../i18n/si';

interface Props {
  lang: Lang;
  r: ReceiptData;
  qr: string | null;
  qrUrl: string;
  t: (k: I18nKey, v?: Record<string, string | number>) => string;
  siteName: string;
}

/** Printable receipt. Rendered off-screen and rasterised for the JPG/PDF downloads. */
export const Receipt = forwardRef<HTMLDivElement, Props>(function Receipt(
  { lang, r, qr, qrUrl, t, siteName },
  ref,
) {
  return (
    <div
      ref={ref}
      data-testid="receipt"
      lang={lang}
      class="pointer-events-none fixed top-0 left-[-10000px] w-[720px] bg-white p-10 font-sans text-[17px] leading-relaxed text-ink"
      aria-hidden="true"
    >
      <div class="flex items-start justify-between border-b-4 border-maroon pb-4">
        <div>
          <p class="font-serif text-2xl font-bold text-maroon">{siteName}</p>
          <p class="text-xl font-semibold">{t('receipt.title')}</p>
        </div>
        <div class="text-right">
          <p class="text-sm text-ink-soft">{t('receipt.orderId')}</p>
          <p class="font-mono text-2xl font-bold">{r.orderId}</p>
        </div>
      </div>
      <dl class="mt-4 grid grid-cols-2 gap-2">
        <div>
          <dt class="text-sm text-ink-soft">{t('receipt.date')}</dt>
          <dd>{formatDate(lang, r.createdAt, { hour: '2-digit', minute: '2-digit' })}</dd>
        </div>
        <div>
          <dt class="text-sm text-ink-soft">{t('receipt.phone')}</dt>
          <dd>{r.phoneMasked}</dd>
        </div>
        <div>
          <dt class="text-sm text-ink-soft">{t('receipt.status')}</dt>
          <dd>{t(`status.${r.status}` as I18nKey)}</dd>
        </div>
      </dl>
      <table class="mt-6 w-full border-collapse">
        <thead>
          <tr class="border-b border-line text-left text-sm text-ink-soft">
            <th class="py-2 font-normal">{t('receipt.items')}</th>
            <th class="py-2 text-center font-normal">{t('receipt.qty')}</th>
            <th class="py-2 text-right font-normal">{t('receipt.total')}</th>
          </tr>
        </thead>
        <tbody>
          {r.items.map((i) => (
            <tr class="border-b border-line">
              <td class="py-2 pr-4" data-testid="receipt-title">
                {i.title[lang] || i.title.en}
              </td>
              <td class="py-2 text-center">{i.qty}</td>
              <td class="py-2 text-right whitespace-nowrap">{formatLKR(i.lineTotalLKR)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl class="mt-3 ml-auto w-72 space-y-1">
        <div class="flex justify-between">
          <dt>{t('order.summary.subtotal')}</dt>
          <dd>{formatLKR(r.totals.subtotalLKR)}</dd>
        </div>
        {r.totals.bundleDiscountLKR > 0 && (
          <div class="flex justify-between">
            <dt>{t('order.summary.bundle')}</dt>
            <dd>−{formatLKR(r.totals.bundleDiscountLKR)}</dd>
          </div>
        )}
        {r.totals.signedSurchargeLKR > 0 && (
          <div class="flex justify-between">
            <dt>{t('order.summary.signed')}</dt>
            <dd>{formatLKR(r.totals.signedSurchargeLKR)}</dd>
          </div>
        )}
        <div class="flex justify-between">
          <dt>{t('order.summary.delivery')}</dt>
          <dd>{formatLKR(r.totals.deliveryFeeLKR)}</dd>
        </div>
        <div class="flex justify-between border-t-2 border-ink pt-1 text-lg font-bold">
          <dt>{t('receipt.total')}</dt>
          <dd>{formatLKR(r.totals.grandTotalLKR)}</dd>
        </div>
      </dl>
      <div class="mt-8 flex items-center gap-5 border-t border-line pt-5">
        {qr && <img src={qr} alt="" width={140} height={140} data-qr-url={qrUrl} data-testid="receipt-qr" />}
        <div>
          <p class="font-semibold">{t('receipt.scan')}</p>
          <p class="text-sm break-all text-ink-soft">{qrUrl}</p>
          <p class="mt-3 font-serif text-maroon">{t('receipt.thanks')}</p>
        </div>
      </div>
    </div>
  );
});
