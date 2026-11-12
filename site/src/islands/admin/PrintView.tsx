import { l10nText as tl } from '@shared/l10n';
import { districtName } from '@shared/districts';
import { formatLKR } from '@shared/pricing';
import type { OrderDoc } from '@shared/types';
import { useEffect, useState } from 'preact/hooks';
import { adminFirebase } from './fb';
import { Toggle, useAdmin, useT } from './ui';

export function PrintView({ params }: { params: URLSearchParams }) {
  const t = useT();
  const { lang } = useAdmin();
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean);
  const [mode, setMode] = useState<'sheet' | 'single'>('sheet');
  const [slips, setSlips] = useState(false);
  const [orders, setOrders] = useState<OrderDoc[]>([]);

  useEffect(() => {
    void (async () => {
      const { db } = await adminFirebase();
      const fs = await import('firebase/firestore');
      const docs = await Promise.all(ids.map((id) => fs.getDoc(fs.doc(db, 'orders', id))));
      setOrders(docs.filter((d) => d.exists()).map((d) => d.data() as OrderDoc));
    })();
  }, [params.get('ids')]);

  const label = (o: OrderDoc) => (
    <div class="print-label-box" data-label={o.orderId}>
      <p class="font-bold">{o.customer.name}</p>
      <p>{o.address.line1}</p>
      {o.address.line2 && <p>{o.address.line2}</p>}
      <p>{o.address.city}</p>
      <p>
        {districtName(o.address.districtId, lang)} {o.address.postalCode}
      </p>
      <p>📞 0{o.customer.mobile.slice(2)}</p>
      <p class="mt-1 font-mono text-xs">{o.orderId}</p>
    </div>
  );

  const pages: OrderDoc[][] = [];
  for (let i = 0; i < orders.length; i += 8) pages.push(orders.slice(i, i + 8));

  return (
    <div data-screen="print">
      <div class="no-print mb-4 flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2">
          <input type="radio" name="pmode" checked={mode === 'sheet'} onChange={() => setMode('sheet')} />{' '}
          {t('admin.print.sheet')}
        </label>
        <label class="flex items-center gap-2">
          <input type="radio" name="pmode" checked={mode === 'single'} onChange={() => setMode('single')} />{' '}
          {t('admin.print.single')}
        </label>
        <Toggle label={t('admin.print.packingSlip')} checked={slips} onChange={setSlips} />
        <button type="button" class="btn-primary" onClick={() => window.print()}>
          {t('admin.print.print')}
        </button>
      </div>
      {mode === 'sheet'
        ? pages.map((p) => (
            <div class="print-sheet" data-sheet>
              {p.map(label)}
            </div>
          ))
        : orders.map((o) => <div class="print-single">{label(o)}</div>)}
      {slips &&
        orders.map((o) => (
          <div class="print-packing" data-packing={o.orderId}>
            <h2 class="text-xl font-bold">{o.orderId}</h2>
            <p>{o.customer.name}</p>
            <table class="mt-3 w-full">
              <tbody>
                {o.items.map((i) => (
                  <tr class="border-b border-line">
                    <td class="py-1">{tl(i.title, lang)}</td>
                    <td class="py-1 text-center">× {i.qty}</td>
                    <td class="py-1 text-right">{formatLKR(i.lineTotalLKR)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p class="mt-2 text-right font-bold">{formatLKR(o.totals.grandTotalLKR)}</p>
            {o.signedCopy && <p>✍ {t('admin.order.signed')}</p>}
            {o.dedicationNote && <p>{o.dedicationNote}</p>}
          </div>
        ))}
    </div>
  );
}
