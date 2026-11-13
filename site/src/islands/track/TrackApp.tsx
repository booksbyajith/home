import type { Lang } from '@shared/constants';
import { ORDER_ID_REGEX } from '@shared/constants';
import { formatLKR } from '@shared/pricing';
import type { OrderStatus } from '@shared/types';
import { useEffect, useState } from 'preact/hooks';
import { formatDate } from '../../i18n/index';
import type { I18nKey } from '../../i18n/si';
import { call, callError } from '../../lib/firebase';
import { myOrders, removeMyOrder, type MyOrder } from '../../lib/myOrders';
import { Field, describedBy } from '../shared/Field';
import { makeT, type MiniDict } from '../shared/i18n';
import { useHydrated } from '../shared/useHydrated';

interface TrackResult {
  orderId: string;
  status: OrderStatus;
  timeline: { status: OrderStatus; at: number }[];
  courier: string | null;
  trackingNo: string | null;
  trackingUrl: string | null;
}

interface Props {
  lang: Lang;
  dict: MiniDict;
}

const FLOW: OrderStatus[] = [
  'pending_verification',
  'acknowledged',
  'payment_verified',
  'packed',
  'dispatched',
  'delivered',
];

export default function TrackApp({ lang, dict }: Props) {
  const t = makeT(dict);
  const [orderId, setOrderId] = useState('');
  const [last4, setLast4] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<I18nKey | null>(null);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [mine, setMine] = useState<MyOrder[]>([]);
  const hydrated = useHydrated();

  const lookup = async (id: string, digits: string) => {
    const oid = id.trim().toUpperCase();
    if (!ORDER_ID_REGEX.test(oid) || !/^\d{4}$/.test(digits.trim())) {
      setError('track.notFound');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await call<unknown, TrackResult>('trackOrder', { orderId: oid, phoneLast4: digits.trim() }));
    } catch (e) {
      const ce = callError(e);
      setError(
        ce.code === 'LOCKED' || ce.status === 'resource-exhausted' ? 'track.locked' : 'track.notFound',
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const list = myOrders();
    setMine(list);
    const id = decodeURIComponent(location.hash.slice(1)).toUpperCase();
    if (ORDER_ID_REGEX.test(id)) {
      setOrderId(id);
      const known = list.find((o) => o.orderId === id);
      if (known) {
        setLast4(known.phoneLast4);
        void lookup(id, known.phoneLast4);
      }
    }
  }, []);

  const pick = (o: MyOrder) => {
    setOrderId(o.orderId);
    setLast4(o.phoneLast4);
    history.replaceState(null, '', `#${o.orderId}`);
    void lookup(o.orderId, o.phoneLast4);
  };

  const reached = (s: OrderStatus) => result?.timeline.find((x) => x.status === s);
  const offFlow = result && (result.status === 'rejected' || result.status === 'cancelled');

  return (
    <div class="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <form
          class="card p-4"
          noValidate
          method="post"
          data-hydrated={hydrated ? 'true' : 'false'}
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(orderId, last4);
          }}
        >
          <div class="grid gap-x-4 sm:grid-cols-2">
            <Field id="t-order" label={t('track.orderId')}>
              <input
                id="t-order"
                class="field-input font-mono uppercase"
                value={orderId}
                onInput={(e) => setOrderId((e.currentTarget as HTMLInputElement).value)}
                placeholder="AJ-0000-XXXX"
                autocomplete="off"
                autocapitalize="characters"
                maxLength={12}
              />
            </Field>
            <Field id="t-last4" label={t('track.last4')}>
              <input
                id="t-last4"
                class="field-input"
                value={last4}
                onInput={(e) =>
                  setLast4((e.currentTarget as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4))
                }
                inputMode="numeric"
                maxLength={4}
                autocomplete="off"
                aria-describedby={describedBy('t-last4', undefined, null)}
              />
            </Field>
          </div>
          <button class="btn-primary" type="submit" disabled={!hydrated || busy} data-track-submit>
            {busy ? '…' : t('track.submit')}
          </button>
          {error && (
            <p class="field-error" role="alert" data-testid="track-error">
              {t(error)}
            </p>
          )}
        </form>

        {result && (
          <section class="card mt-6 p-5" aria-labelledby="tl-h" data-testid="track-result">
            <p class="font-mono text-xl font-bold">{result.orderId}</p>
            <p class="mt-1 text-lg">
              <span class="badge bg-maroon text-white" data-testid="track-status">
                {t(`status.${result.status}` as I18nKey)}
              </span>
            </p>
            <p class="mt-2 text-ink-soft">{t(`status.desc.${result.status}` as I18nKey)}</p>
            <h2 id="tl-h" class="mt-5 font-sans text-lg font-semibold">
              {t('track.timeline')}
            </h2>
            <ol class="mt-3 space-y-3 border-l-2 border-line pl-5">
              {(offFlow ? result.timeline.map((x) => x.status) : FLOW).map((s) => {
                const hit = reached(s);
                return (
                  <li
                    class={`relative ${hit ? '' : 'text-ink-soft'}`}
                    data-step-status={s}
                    data-reached={hit ? 'true' : 'false'}
                  >
                    <span
                      class={`absolute top-2 -left-[27px] h-3 w-3 rounded-full ${hit ? 'bg-maroon' : 'border-2 border-line bg-paper'}`}
                      aria-hidden="true"
                    />
                    <span class="font-semibold">{t(`status.${s}` as I18nKey)}</span>
                    {hit && (
                      <span class="ml-2 text-sm">
                        {formatDate(lang, hit.at, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            {result.courier && (
              <dl class="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt class="font-semibold">{t('track.courier')}</dt>
                <dd data-testid="track-courier">{result.courier}</dd>
                <dt class="font-semibold">{t('track.trackingNo')}</dt>
                <dd class="font-mono" data-testid="track-number">
                  {result.trackingNo}
                </dd>
              </dl>
            )}
            {result.trackingUrl && (
              <p class="mt-3">
                <a href={result.trackingUrl} target="_blank" rel="noopener">
                  {t('track.courierLink')} ↗
                </a>
              </p>
            )}
          </section>
        )}
      </div>
      <aside>
        <h2 class="font-sans text-lg font-semibold">{t('track.myOrders')}</h2>
        {mine.length === 0 ? (
          <p class="mt-2 text-ink-soft">{t('track.myOrders.none')}</p>
        ) : (
          <ul class="mt-2 space-y-2" data-testid="my-orders">
            {mine.map((o) => (
              <li class="card p-3">
                <p class="font-mono font-semibold">{o.orderId}</p>
                <p class="text-sm text-ink-soft">
                  {formatDate(lang, o.createdAt)} · {formatLKR(o.totalLKR)}
                </p>
                <p class="text-sm">{o.titles.join(', ')}</p>
                <div class="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="btn-secondary min-h-9 px-3 py-0"
                    onClick={() => pick(o)}
                    data-my-track={o.orderId}
                  >
                    {t('track.myOrders.track')}
                  </button>
                  <button
                    type="button"
                    class="btn-quiet min-h-9 px-3 py-0 text-sm"
                    onClick={() => {
                      removeMyOrder(o.orderId);
                      setMine(myOrders());
                    }}
                  >
                    {t('track.myOrders.remove')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
