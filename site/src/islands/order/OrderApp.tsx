import { l10nText as tl } from '@shared/l10n';
import type { Lang } from '@shared/constants';
import { MAX_QTY_PER_BOOK } from '@shared/constants';
import { newOrderId, paymentRef } from '@shared/orderRef';
import { DISTRICTS, OVERSEAS, districtName, regionLine } from '@shared/districts';
import { maskPhone } from '@shared/mask';
import { computeTotals, formatLKR, orderability } from '@shared/pricing';
import { domesticMobileError, orderAddressSchema, orderCustomerSchema } from '@shared/schemas';
import type { BookDoc, L10n, OrderItem, PublicConfig, Totals } from '@shared/types';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { I18nKey } from '../../i18n/si';
import {
  clearDraftJson,
  createDraftSaver,
  emptyFields,
  isMeaningful,
  loadDraft,
  type DraftFields,
} from '../../lib/draft';
import { guessCountryName } from '../../lib/guessCountry';
import { loadPhoneRules, usePhoneRules } from '../shared/phoneRules';
import { call, callError, orderErrorKey } from '../../lib/firebase';
import { prepareSlip } from '../../lib/imageCompress';
import { addMyOrder, saveReceipt } from '../../lib/myOrders';
import { fetchBooks, fetchPublicConfig } from '../../lib/publicData';
import { blobToBase64, clearSlip, loadSlip, saveSlip } from '../../lib/slipStore';
import { Field, describedBy } from '../shared/Field';
import { makeT, type MiniDict } from '../shared/i18n';

export interface OrderBook {
  slug: string;
  title: L10n;
  cover: string;
  defaults: Pick<BookDoc, 'priceLKR' | 'saleMode' | 'stock' | 'inStock' | 'preorder' | 'signedCopyAvailable'>;
}

interface Props {
  lang: Lang;
  dict: MiniDict;
  books: OrderBook[];
  successHref: string;
  privacyHref: string;
  contactHref: string;
  /** Commercial Bank's logo (site/public/icons/bank-logo.*), shown when the bank is Commercial Bank. */
  bankLogo?: string;
}

interface Slip {
  blob: Blob;
  name: string;
  type: string;
  size: number;
  url: string;
}

interface CreateOrderResult {
  orderId: string;
  createdAt: number;
  status: 'pending_verification';
  items: OrderItem[];
  totals: Totals;
  phoneMasked: string;
  totalMismatch: boolean;
}

const STEPS: I18nKey[] = [
  'order.step.books',
  'order.step.details',
  'order.step.payment',
  'order.step.review',
];

const FIELD_ERROR: Record<string, I18nKey> = {
  name: 'order.error.name',
  mobile: 'order.error.mobile',
  whatsapp: 'order.error.whatsapp',
  email: 'order.error.email',
  postalCode: 'order.error.postalCode',
  districtId: 'order.error.district',
  country: 'order.error.country',
};

function validateDetails(f: DraftFields): Record<string, I18nKey> {
  const errors: Record<string, I18nKey> = {};
  const c = orderCustomerSchema.safeParse({
    name: f.name,
    mobile: f.mobile,
    whatsapp: f.whatsappSame ? f.mobile : f.whatsapp,
    email: f.email,
  });
  const a = orderAddressSchema.safeParse({
    line1: f.line1,
    line2: f.line2,
    city: f.city,
    districtId: f.districtId,
    postalCode: f.postalCode,
    country: f.districtId === OVERSEAS ? f.country : '',
    landmark: f.landmark,
  });
  for (const issue of [...(c.success ? [] : c.error.issues), ...(a.success ? [] : a.error.issues)]) {
    const key = String(issue.path[0] ?? '');
    if (!errors[key]) errors[key] = FIELD_ERROR[key] ?? 'order.error.required';
  }
  if (c.success && a.success && domesticMobileError(f.districtId, c.data.mobile))
    errors.mobile = 'order.error.mobile';
  if (f.districtId === OVERSEAS && errors.postalCode) errors.postalCode = 'order.error.postalCodeOverseas';
  if (f.whatsappSame && errors.mobile) delete errors.whatsapp;
  return errors;
}

export default function OrderApp({
  lang,
  dict,
  books,
  successHref,
  privacyHref,
  contactHref,
  bankLogo,
}: Props) {
  const t = makeT(dict);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [cart, setCart] = useState<{ slug: string; qty: number }[]>([]);
  const [fields, setFields] = useState<DraftFields>(emptyFields());
  const overseas = fields.districtId === OVERSEAS;
  usePhoneRules();
  const [slip, setSlip] = useState<Slip | null>(null);
  const [slipMsg, setSlipMsg] = useState<I18nKey | null>(null);
  const [slipBusy, setSlipBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, I18nKey>>({});
  const [restored, setRestored] = useState(false);
  const [live, setLive] = useState<Record<string, BookDoc> | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const payRef = fields.orderId ? paymentRef(fields.orderId) : '';
  // Commercial Bank's logo replaces the written bank name (the copy button still copies the full name).
  const showBankLogo = !!bankLogo && !!config && /commercial\s+bank/i.test(config.bank.bankName);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<I18nKey | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const saver = useRef<ReturnType<typeof createDraftSaver> | null>(null);
  const done = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // ---- load draft, slip and live data ----
  useEffect(() => {
    saver.current = createDraftSaver(400);
    const d = loadDraft();
    let nextCart = d?.cart ?? [];
    // Outside Sri Lanka (judged by the device time zone): pre-select overseas delivery and
    // fill in the country, unless the customer has already chosen a district. Both stay editable.
    const guessed = guessCountryName(lang);
    const withGuess = (f: DraftFields): DraftFields =>
      guessed && !f.districtId ? { ...f, districtId: OVERSEAS, country: f.country || guessed } : f;
    if (d && isMeaningful(d)) {
      setStep(Math.min(Math.max(d.step, 0), 3));
      setFields(withGuess(d.fields));
      setConsent(!!d.consent);
      setRestored(true);
      if (d.slipMeta) {
        void loadSlip().then((s) => {
          if (s)
            setSlip({
              blob: s.blob,
              name: s.name,
              type: s.type,
              size: s.size,
              url: URL.createObjectURL(s.blob),
            });
          else setSlipMsg('order.draft.slipNotSaved');
        });
      }
    } else {
      setFields((f) => withGuess(f));
    }
    const want = new URLSearchParams(location.search).get('book');
    if (want && books.some((b) => b.slug === want) && !nextCart.some((c) => c.slug === want))
      nextCart = [...nextCart, { slug: want, qty: 1 }];
    setCart(nextCart);
    void Promise.all([fetchBooks({ fresh: true }), fetchPublicConfig({ fresh: true })]).then(([b, c]) => {
      setLive(b);
      setConfig(c);
      setConfigLoaded(true);
    });
    setReady(true);
    return () => saver.current?.dispose();
  }, []);

  // ---- autosave ----
  useEffect(() => {
    if (!ready || done.current) return;
    saver.current?.save({
      step,
      cart,
      fields,
      geo: null,
      slipMeta: slip ? { name: slip.name, type: slip.type, size: slip.size } : null,
      consent,
    });
  }, [ready, step, cart, fields, slip, consent]);

  // ---- the order number is decided when the payment step opens, so it can be the bank reference ----
  useEffect(() => {
    if (step !== 2 || fields.orderId) return;
    const rand = (max: number) => crypto.getRandomValues(new Uint32Array(1))[0] % max;
    setFields((f) => (f.orderId ? f : { ...f, orderId: newOrderId(new Date(), rand) }));
  }, [step, fields.orderId]);

  // ---- move focus to the step heading when the step changes ----
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const bookInfo = (slug: string): BookDoc => {
    const base = books.find((b) => b.slug === slug)!;
    const l = live?.[slug];
    return {
      slug,
      title: base.title,
      externalUrl: null,
      preorderNote: null,
      sortOrder: 0,
      ...base.defaults,
      ...(l ?? {}),
    } as BookDoc;
  };

  const lines = cart
    .filter((c) => books.some((b) => b.slug === c.slug))
    .map((c) => ({ ...c, book: bookInfo(c.slug) }))
    .filter((l) => orderability(l.book, 1) === 'ok' || orderability(l.book, 1) === 'insufficient_stock');

  const totals = useMemo(
    () =>
      config
        ? computeTotals({
            lines: lines.map((l) => ({ slug: l.slug, qty: l.qty, unitPriceLKR: l.book.priceLKR })),
            districtId: fields.districtId,
            signedCopy: fields.signedCopy,
            config,
          })
        : null,
    [
      lines.map((l) => `${l.slug}:${l.qty}:${l.book.priceLKR}`).join(),
      fields.districtId,
      fields.signedCopy,
      config,
    ],
  );

  const ordersOpen = !!config && config.ordersOpen && !!config.bank.accountNumber;
  const signedAvailable =
    !!config?.signedCopy.enabled && lines.length > 0 && lines.every((l) => l.book.signedCopyAvailable);

  const setField = <K extends keyof DraftFields>(k: K, v: DraftFields[K]) => {
    setFields((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined as unknown as I18nKey }));
  };

  const setQty = (slug: string, qty: number) => {
    const book = bookInfo(slug);
    const max = book.preorder ? MAX_QTY_PER_BOOK : Math.min(MAX_QTY_PER_BOOK, Math.max(book.stock, 1));
    setCart((c) => {
      const m = new Map(c.map((x) => [x.slug, x.qty]));
      if (qty <= 0) m.delete(slug);
      else m.set(slug, Math.min(qty, max));
      return books.filter((b) => m.has(b.slug)).map((b) => ({ slug: b.slug, qty: m.get(b.slug)! }));
    });
    setErrors({});
  };

  const startOver = async () => {
    if (!window.confirm(t('order.draft.confirmClear'))) return;
    saver.current?.cancel();
    clearDraftJson();
    await clearSlip();
    if (slip) URL.revokeObjectURL(slip.url);
    setStep(0);
    setCart([]);
    setFields(emptyFields());
    setSlip(null);
    setSlipMsg(null);
    setConsent(false);
    setErrors({});
    setRestored(false);
    setSubmitError(null);
  };

  const onSlip = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setSlipBusy(true);
    setSlipMsg(null);
    const r = await prepareSlip(file);
    setSlipBusy(false);
    if (!r.ok) {
      setSlipMsg(r.reason === 'type' ? 'order.slip.wrongType' : 'order.slip.tooLarge');
      return;
    }
    if (slip) URL.revokeObjectURL(slip.url);
    const name = file.name.slice(0, 120) || 'slip';
    const s: Slip = { blob: r.file, name, type: r.type, size: r.file.size, url: URL.createObjectURL(r.file) };
    setSlip(s);
    setErrors((er) => ({ ...er, slip: undefined as unknown as I18nKey }));
    const saved = await saveSlip({
      blob: r.file,
      name,
      type: r.type,
      size: r.file.size,
      savedAt: Date.now(),
    });
    if (!saved) setSlipMsg('order.draft.slipNotSaved');
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  /** Checks one step; shows its errors and returns false when it can't be left yet. */
  const checkStep = async (st: number): Promise<boolean> => {
    if (st === 0) {
      if (!lines.length) return (setErrors({ cart: 'order.cart.empty' }), false);
      if (lines.some((l) => orderability(l.book, l.qty) !== 'ok'))
        return (setErrors({ cart: 'order.error.outOfStock' }), false);
      if (!fields.districtId) {
        // Arriving at the address step with no district yet: pre-select overseas delivery when the
        // device is outside Sri Lanka (it may not have been known, or was cleared, at page load).
        const country = guessCountryName(lang);
        if (country)
          setFields((f) =>
            f.districtId ? f : { ...f, districtId: OVERSEAS, country: f.country || country },
          );
      }
    }
    if (st === 1) {
      await loadPhoneRules();
      const errs = validateDetails(fields);
      setErrors(errs);
      if (Object.keys(errs).length) {
        const first = Object.keys(errs)[0];
        setTimeout(() => document.getElementById(`f-${first}`)?.focus(), 0);
        return false;
      }
    }
    if (st === 2 && !slip) {
      setErrors({ slip: 'order.slip.required' });
      return false;
    }
    setErrors({});
    return true;
  };

  const next = async () => {
    if (await checkStep(step)) setStep((s) => Math.min(s + 1, 3));
  };

  /** Step tabs: going back is always allowed; going forward checks every step on the way. */
  const goTo = async (target: number) => {
    if (target === step) return;
    if (target < step) {
      setErrors({});
      setStep(target);
      return;
    }
    for (let st = step; st < target; st++) {
      if (!(await checkStep(st))) {
        setStep(st);
        return;
      }
    }
    setStep(target);
  };

  const back = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = async () => {
    if (!consent || !slip || !totals || submitting) return;
    await loadPhoneRules();
    const errs = validateDetails(fields);
    if (Object.keys(errs).length) {
      setErrors(errs);
      setStep(1);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const dataBase64 = await blobToBase64(slip.blob);
      const res = await call<unknown, CreateOrderResult>('createOrder', {
        lang,
        orderId: fields.orderId || undefined,
        items: lines.map((l) => ({ slug: l.slug, qty: l.qty })),
        customer: {
          name: fields.name,
          mobile: fields.mobile,
          whatsapp: fields.whatsappSame ? fields.mobile : fields.whatsapp,
          email: fields.email,
        },
        address: {
          line1: fields.line1,
          line2: fields.line2,
          city: fields.city,
          districtId: fields.districtId,
          postalCode: fields.postalCode,
          country: overseas ? fields.country : '',
          landmark: fields.landmark,
        },
        geo: null,
        signedCopy: signedAvailable && fields.signedCopy,
        dedicationNote: fields.dedicationNote,
        expectedTotalLKR: totals.grandTotalLKR,
        slip: { fileName: slip.name, contentType: slip.type, dataBase64 },
        consent: true,
      });
      done.current = true;
      saver.current?.cancel();
      saveReceipt({
        orderId: res.orderId,
        createdAt: res.createdAt,
        lang,
        items: res.items.map((i) => ({
          title: i.title,
          qty: i.qty,
          unitPriceLKR: i.unitPriceLKR,
          lineTotalLKR: i.lineTotalLKR,
        })),
        totals: res.totals,
        phoneMasked: res.phoneMasked,
        status: res.status,
        totalMismatch: res.totalMismatch,
        expectedTotalLKR: totals.grandTotalLKR,
        overseas,
      });
      addMyOrder({
        orderId: res.orderId,
        createdAt: res.createdAt,
        titles: res.items.map((i) => tl(i.title, lang)),
        totalLKR: res.totals.grandTotalLKR,
        phoneLast4: fields.mobile.replace(/\D/g, '').slice(-4),
        lang,
      });
      clearDraftJson();
      await clearSlip();
      location.assign(`${successHref}#${res.orderId}`);
    } catch (err) {
      const key = orderErrorKey(err);
      const ce = callError(err);
      if (ce.code === 'VALIDATION' && ce.fields.length) {
        const errs: Record<string, I18nKey> = {};
        for (const f of ce.fields) {
          const k = f.split('.').pop()!;
          errs[k] = FIELD_ERROR[k] ?? 'order.error.required';
        }
        setErrors(errs);
      }
      setSubmitError(key);
      setSubmitting(false);
    }
  };

  // ---- rendering helpers ----
  const err = (k: string) => (errors[k] ? t(errors[k]) : null);
  const input = (k: keyof DraftFields, props: Record<string, unknown> = {}, hint?: string) => ({
    id: `f-${k}`,
    name: k,
    class: 'field-input',
    value: fields[k] as string,
    onInput: (e: Event) => setField(k, (e.currentTarget as HTMLInputElement).value as never),
    'aria-invalid': errors[k] ? (true as const) : undefined,
    'aria-describedby': describedBy(`f-${k}`, hint, err(k)),
    ...props,
  });

  const Summary = () =>
    totals && lines.length ? (
      <section class="card p-4" aria-labelledby="sum-h" data-testid="summary">
        <h2 id="sum-h" class="font-sans text-lg font-semibold">
          {t('order.summary.items')}
        </h2>
        <ul class="mt-2 space-y-1">
          {lines.map((l) => (
            <li class="flex justify-between gap-3">
              <span>
                {tl(l.book.title, lang)} × {l.qty}
              </span>
              <span class="whitespace-nowrap">{formatLKR(l.qty * l.book.priceLKR)}</span>
            </li>
          ))}
        </ul>
        <dl class="mt-3 space-y-1 border-t border-line pt-3">
          <div class="flex justify-between">
            <dt>{t('order.summary.subtotal')}</dt>
            <dd>{formatLKR(totals.subtotalLKR)}</dd>
          </div>
          {totals.bundleDiscountLKR > 0 && (
            <div class="flex justify-between text-success">
              <dt>{t('order.summary.bundle')}</dt>
              <dd>−{formatLKR(totals.bundleDiscountLKR)}</dd>
            </div>
          )}
          {totals.signedSurchargeLKR > 0 && (
            <div class="flex justify-between">
              <dt>{t('order.summary.signed')}</dt>
              <dd>{formatLKR(totals.signedSurchargeLKR)}</dd>
            </div>
          )}
          {fields.districtId && (
            <div class="flex justify-between">
              <dt>{t('order.summary.delivery')}</dt>
              <dd>{overseas ? t('order.summary.deliveryOverseas') : formatLKR(totals.deliveryFeeLKR)}</dd>
            </div>
          )}
          <div class="flex justify-between border-t border-line pt-2 text-lg font-bold">
            <dt>{t('order.summary.total')}</dt>
            <dd data-testid="grand-total">{formatLKR(totals.grandTotalLKR)}</dd>
          </div>
        </dl>
      </section>
    ) : null;

  const blocked = configLoaded && !ordersOpen;

  return (
    <div
      class="grid gap-8 lg:grid-cols-[1fr_340px]"
      data-order-app
      data-ready={ready ? 'true' : 'false'}
      data-step={step}
    >
      <div>
        {restored && (
          <div
            class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gold bg-warn-bg p-3"
            role="status"
            data-testid="draft-banner"
          >
            <span>{t('order.draft.restored')}</span>
            <button type="button" class="btn-secondary min-h-9 px-3 py-1" onClick={startOver}>
              {t('order.draft.startOver')}
            </button>
          </div>
        )}
        {blocked && (
          <div class="mb-4 rounded-md border border-danger bg-white p-3" role="alert">
            {t('order.notConfigured')} <a href={contactHref}>{t('nav.contact')}</a>
          </div>
        )}
        {config?.notice && (tl(config.notice, lang) || '').trim() && (
          <div class="mb-4 rounded-md border border-teal bg-white p-3">{tl(config.notice, lang)}</div>
        )}

        <ol
          class="mb-6 grid grid-cols-4 gap-2 text-center text-sm"
          aria-label={t('order.stepOf', { n: step + 1, total: 4 })}
        >
          {STEPS.map((k, i) => (
            <li>
              <button
                type="button"
                onClick={() => void goTo(i)}
                aria-current={i === step ? 'step' : undefined}
                data-step-tab={i}
                class={`block h-full w-full cursor-pointer rounded-md border px-1 py-2 ${i === step ? 'border-maroon bg-maroon text-white' : i < step ? 'border-line bg-paper-dark text-ink hover:border-maroon/50' : 'border-line text-ink hover:bg-paper-dark'}`}
              >
                <span class="block font-semibold">{i + 1}</span>
                <span class="block leading-tight">{t(k)}</span>
              </button>
            </li>
          ))}
        </ol>

        <h2 ref={headingRef} tabIndex={-1} class="text-2xl font-bold">
          {t(STEPS[step])}
          <span class="sr-only"> — {t('order.stepOf', { n: step + 1, total: 4 })}</span>
        </h2>

        {/* ---- Step 1: books ---- */}
        {step === 0 && (
          <div class="mt-4 space-y-3">
            {config?.bundle.enabled && config.bundle.percentOff > 0 && (
              <p class="rounded-md bg-gold/10 p-3">
                {t('order.cart.bundleHint', { n: config.bundle.minQty, percent: config.bundle.percentOff })}
              </p>
            )}
            {books.map((b) => {
              const info = bookInfo(b.slug);
              const qty = cart.find((c) => c.slug === b.slug)?.qty ?? 0;
              const reason = orderability(info, 1);
              const orderable = reason === 'ok';
              const max = info.preorder ? MAX_QTY_PER_BOOK : Math.min(MAX_QTY_PER_BOOK, info.stock);
              return (
                <div
                  class={`card flex gap-3 p-3 ${orderable ? '' : 'bg-paper-dark'}`}
                  data-cart-book={b.slug}
                >
                  <img
                    src={b.cover}
                    alt=""
                    width={64}
                    height={96}
                    class="h-24 w-16 shrink-0 rounded object-cover"
                    loading="lazy"
                  />
                  <div class="flex flex-1 flex-col gap-1">
                    <p class="font-semibold">{tl(b.title, lang)}</p>
                    <p class="text-ink-soft">
                      {info.priceLKR > 0 ? formatLKR(info.priceLKR) : t('books.priceTba')}
                      {info.preorder && orderable && (
                        <span class="badge ml-2 bg-teal/10 text-teal">{t('books.preorder')}</span>
                      )}
                    </p>
                    {!orderable && (
                      <p class="text-sm font-semibold text-ink-soft">
                        {reason === 'not_in_stock' || reason === 'insufficient_stock'
                          ? t('books.outOfStock')
                          : t('order.cart.unavailable')}
                      </p>
                    )}
                    {orderable &&
                      (qty === 0 ? (
                        <button
                          type="button"
                          class="btn-secondary self-start px-4 py-1"
                          onClick={() => setQty(b.slug, 1)}
                          data-add={b.slug}
                        >
                          {t('order.cart.add')}
                        </button>
                      ) : (
                        <div
                          class="flex items-center gap-2"
                          role="group"
                          aria-label={`${t('order.cart.qty')}: ${tl(b.title, lang)}`}
                        >
                          <button
                            type="button"
                            class="btn-secondary h-11 w-11 p-0"
                            onClick={() => setQty(b.slug, qty - 1)}
                            aria-label={t('order.cart.decrease', { title: tl(b.title, lang) })}
                          >
                            −
                          </button>
                          <span
                            class="min-w-8 text-center text-lg font-semibold"
                            data-qty={b.slug}
                            aria-live="polite"
                          >
                            {qty}
                          </span>
                          <button
                            type="button"
                            class="btn-secondary h-11 w-11 p-0"
                            onClick={() => setQty(b.slug, qty + 1)}
                            disabled={qty >= max}
                            aria-label={t('order.cart.increase', { title: tl(b.title, lang) })}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            class="btn-quiet px-3 py-1 text-sm"
                            onClick={() => setQty(b.slug, 0)}
                          >
                            {t('order.cart.remove')}
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
            {err('cart') && (
              <p class="field-error" role="alert">
                {err('cart')}
              </p>
            )}
          </div>
        )}

        {/* ---- Step 2: delivery details ---- */}
        {step === 1 && (
          <form
            class="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
            noValidate
          >
            <Field id="f-name" label={t('order.field.name')} error={err('name')}>
              <input {...input('name', { autocomplete: 'name', required: true, maxLength: 80 })} />
            </Field>
            <Field
              id="f-mobile"
              label={t('order.field.mobile')}
              hint={t('order.field.mobileHint')}
              error={err('mobile')}
            >
              <input
                {...input(
                  'mobile',
                  { type: 'tel', inputMode: 'tel', autocomplete: 'tel', required: true, maxLength: 20 },
                  t('order.field.mobileHint'),
                )}
              />
            </Field>
            <div class="mb-4 flex items-center gap-2">
              <input
                id="f-whatsappSame"
                type="checkbox"
                class="h-5 w-5 accent-maroon"
                checked={fields.whatsappSame}
                onChange={(e) => setField('whatsappSame', (e.currentTarget as HTMLInputElement).checked)}
              />
              <label for="f-whatsappSame">{t('order.field.whatsappSame')}</label>
            </div>
            {!fields.whatsappSame && (
              <Field id="f-whatsapp" label={t('order.field.whatsapp')} error={err('whatsapp')}>
                <input {...input('whatsapp', { type: 'tel', inputMode: 'tel', maxLength: 20 })} />
              </Field>
            )}
            <Field
              id="f-email"
              label={t('order.field.email')}
              hint={t('order.field.emailHint')}
              optional={t('order.field.optional')}
              error={err('email')}
            >
              <input
                {...input(
                  'email',
                  { type: 'email', inputMode: 'email', autocomplete: 'email', maxLength: 120 },
                  t('order.field.emailHint'),
                )}
              />
            </Field>
            <Field id="f-line1" label={t('order.field.line1')} error={err('line1')}>
              <input {...input('line1', { autocomplete: 'address-line1', maxLength: 120 })} />
            </Field>
            <Field
              id="f-line2"
              label={t('order.field.line2')}
              optional={t('order.field.optional')}
              error={err('line2')}
            >
              <input {...input('line2', { autocomplete: 'address-line2', maxLength: 120 })} />
            </Field>
            <div class="grid gap-x-4 sm:grid-cols-2">
              <Field id="f-city" label={t('order.field.city')} error={err('city')}>
                <input {...input('city', { autocomplete: 'address-level2', maxLength: 60 })} />
              </Field>
              <Field id="f-postalCode" label={t('order.field.postalCode')} error={err('postalCode')}>
                <input
                  {...input('postalCode', {
                    inputMode: overseas ? 'text' : 'numeric',
                    autocomplete: 'postal-code',
                    maxLength: overseas ? 12 : 5,
                  })}
                />
              </Field>
            </div>
            <Field id="f-districtId" label={t('order.field.district')} error={err('districtId')}>
              <select
                id="f-districtId"
                name="districtId"
                class="field-input"
                value={fields.districtId}
                onChange={(e) => setField('districtId', (e.currentTarget as HTMLSelectElement).value)}
                aria-invalid={errors.districtId ? 'true' : undefined}
                aria-describedby={describedBy('f-districtId', undefined, err('districtId'))}
              >
                <option value="">{t('order.field.districtPlaceholder')}</option>
                {DISTRICTS.map((d) => (
                  <option value={d.id}>{d[lang]}</option>
                ))}
                <option value={OVERSEAS}>{districtName(OVERSEAS, lang)}</option>
              </select>
            </Field>
            {overseas && (
              <>
                <Field id="f-country" label={t('order.field.country')} error={err('country')}>
                  <input {...input('country', { autocomplete: 'country-name', maxLength: 60 })} />
                </Field>
                <p class="mb-4 rounded-lg bg-warn-bg p-3 text-sm" data-testid="overseas-note">
                  {t('order.overseas.note')}
                </p>
              </>
            )}
            <Field
              id="f-landmark"
              label={t('order.field.landmark')}
              optional={t('order.field.optional')}
              error={err('landmark')}
            >
              <textarea {...input('landmark', { rows: 2, maxLength: 200 })} />
            </Field>

            {signedAvailable && (
              <div class="mb-4 flex items-start gap-2">
                <input
                  id="f-signedCopy"
                  type="checkbox"
                  class="mt-1 h-5 w-5 accent-maroon"
                  checked={fields.signedCopy}
                  onChange={(e) => setField('signedCopy', (e.currentTarget as HTMLInputElement).checked)}
                />
                <label for="f-signedCopy">
                  {t('order.field.signedCopy')}{' '}
                  {config && config.signedCopy.surchargeLKR > 0 && (
                    <span class="text-ink-soft">
                      ({t('order.field.signedCopyFee', { fee: formatLKR(config.signedCopy.surchargeLKR) })})
                    </span>
                  )}
                </label>
              </div>
            )}
            <Field
              id="f-dedicationNote"
              label={t('order.field.dedication')}
              hint={t('order.field.dedicationHint')}
              optional={t('order.field.optional')}
            >
              <textarea
                {...input('dedicationNote', { rows: 2, maxLength: 300 }, t('order.field.dedicationHint'))}
              />
            </Field>
            <button type="submit" hidden />
          </form>
        )}

        {/* ---- Step 3: payment ---- */}
        {step === 2 && (
          <div class="mt-4 space-y-5">
            {totals && (
              <p class="text-xl">
                {t('order.payment.amount')}:{' '}
                <strong data-testid="pay-amount">{formatLKR(totals.grandTotalLKR)}</strong>
              </p>
            )}
            <div class="rounded-md border-2 border-danger bg-white p-3 font-semibold" role="note">
              ⚠ {t('order.payment.warning')}
            </div>
            {config && (
              <section class="card p-4" aria-labelledby="bank-h">
                <h3 id="bank-h" class="flex items-center gap-3 font-sans text-lg font-semibold">
                  <span
                    class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-maroon text-white"
                    aria-hidden="true"
                  >
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M3 9.5L12 4l9 5.5"></path>
                      <path d="M4.5 10v7M9 10v7M15 10v7M19.5 10v7"></path>
                      <path d="M3 20h18"></path>
                    </svg>
                  </span>
                  {t('order.payment.title')}
                </h3>
                <dl class="mt-3 space-y-3" data-testid="bank">
                  {(
                    [
                      ['order.payment.bankName', config.bank.bankName],
                      [
                        'order.payment.branch',
                        [config.bank.branch, config.bank.branchCode].filter(Boolean).join(' / '),
                      ],
                      ['order.payment.accountName', config.bank.accountName],
                      ['order.payment.accountNumber', config.bank.accountNumber],
                      ['order.payment.reference', payRef],
                    ] as [I18nKey, string][]
                  )
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div>
                        <dt class="text-sm text-ink-soft">{t(k)}</dt>
                        <dd class="flex items-center justify-between gap-3 font-semibold">
                          {k === 'order.payment.bankName' && showBankLogo ? (
                            <span class="min-w-0" data-bank-field={k}>
                              <img src={bankLogo} alt={v} class="h-7 w-auto sm:h-8" data-bank-logo />
                            </span>
                          ) : (
                            <span class="min-w-0 break-words" data-bank-field={k}>
                              {v}
                            </span>
                          )}
                          <button
                            type="button"
                            class={`btn-quiet h-10 w-10 shrink-0 border border-line p-0 ${copied === k ? 'text-success' : ''}`}
                            onClick={() => copy(k, v)}
                            aria-label={`${copied === k ? t('site.copied') : t('site.copy')}: ${t(k)}`}
                            title={copied === k ? t('site.copied') : t('site.copy')}
                          >
                            {copied === k ? (
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.4"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M5 12.5l4.5 4.5L19 7.5"></path>
                              </svg>
                            ) : (
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true"
                              >
                                <rect x="9" y="9" width="11" height="11" rx="2"></rect>
                                <path d="M5 15V6a2 2 0 0 1 2-2h9"></path>
                              </svg>
                            )}
                          </button>
                        </dd>
                      </div>
                    ))}
                </dl>
                {payRef && (
                  <p class="mt-2 rounded-lg bg-gold/10 p-3 text-sm" data-testid="pay-ref-hint">
                    {t('order.payment.referenceHint')}
                  </p>
                )}
                <h4 class="mt-4 font-semibold">{t('order.payment.instructions')}</h4>
                <p class="mt-1 whitespace-pre-line">{tl(config.paymentInstructions, lang)}</p>
              </section>
            )}
            <section aria-labelledby="slip-h">
              <h3 id="slip-h" class="font-sans text-lg font-semibold">
                {t('order.slip.title')}
              </h3>
              <p class="field-hint" id="slip-hint">
                {t('order.slip.hint')}
              </p>
              <label class="btn-secondary mt-2 cursor-pointer">
                {slip ? t('order.slip.replace') : t('order.slip.choose')}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  class="sr-only"
                  onChange={onSlip}
                  aria-describedby="slip-hint"
                  data-slip-input
                />
              </label>
              {slipBusy && (
                <p class="mt-2" role="status">
                  {t('order.slip.compressing')}
                </p>
              )}
              {slip && (
                <div class="mt-3 flex items-center gap-3" data-testid="slip-preview">
                  {slip.type.startsWith('image/') ? (
                    <img src={slip.url} alt={slip.name} class="h-28 w-auto rounded border border-line" />
                  ) : (
                    <span class="badge bg-paper-dark">PDF</span>
                  )}
                  <span>
                    <span class="font-semibold text-success">✓ {t('order.slip.ready')}</span>
                    <br />
                    <span class="text-sm text-ink-soft" data-slip-name>
                      {slip.name}
                    </span>
                  </span>
                </div>
              )}
              {(slipMsg || err('slip')) && (
                <p class="field-error" role="alert">
                  {slipMsg ? t(slipMsg) : err('slip')}
                </p>
              )}
            </section>
          </div>
        )}

        {/* ---- Step 4: review ---- */}
        {step === 3 && (
          <div class="mt-4 space-y-4">
            <section class="card p-4">
              <div class="flex justify-between">
                <h3 class="font-sans font-semibold">{t('order.step.details')}</h3>
                <button type="button" class="btn-quiet min-h-9 px-2 py-0 text-sm" onClick={() => setStep(1)}>
                  {t('order.review.edit')}
                </button>
              </div>
              <p class="mt-1" data-testid="review-details">
                {fields.name}
                <br />
                {maskPhone(fields.mobile.replace(/\D/g, ''))}
                <br />
                {[
                  fields.line1,
                  fields.line2,
                  fields.city,
                  regionLine(
                    { districtId: fields.districtId, postalCode: fields.postalCode, country: fields.country },
                    lang,
                  ),
                ]
                  .filter((x) => x.trim())
                  .join(', ')}
              </p>
              {fields.dedicationNote && <p class="mt-1 text-sm">✎ {fields.dedicationNote}</p>}
            </section>
            <section class="card p-4">
              <div class="flex justify-between">
                <h3 class="font-sans font-semibold">{t('order.slip.title')}</h3>
                <button type="button" class="btn-quiet min-h-9 px-2 py-0 text-sm" onClick={() => setStep(2)}>
                  {t('order.review.edit')}
                </button>
              </div>
              <p class="mt-1">{slip ? `✓ ${slip.name}` : t('order.slip.required')}</p>
            </section>
            <div class="flex items-start gap-2">
              <input
                id="f-consent"
                type="checkbox"
                class="mt-1 h-5 w-5 accent-maroon"
                checked={consent}
                onChange={(e) => setConsent((e.currentTarget as HTMLInputElement).checked)}
              />
              <label for="f-consent">
                {t('order.review.consent')}{' '}
                <a href={privacyHref} target="_blank" rel="noopener">
                  ↗
                </a>
              </label>
            </div>
            {submitError && (
              <p class="field-error" role="alert" data-testid="submit-error">
                {t(submitError)}
              </p>
            )}
          </div>
        )}

        <div class="mt-8 flex flex-wrap gap-3">
          {step > 0 && (
            <button type="button" class="btn-secondary" onClick={back} disabled={submitting}>
              ← {t('order.back')}
            </button>
          )}
          {step < 3 && (
            <button type="button" class="btn-primary" onClick={next} disabled={blocked} data-next-step>
              {t('order.next')} →
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              class="btn-primary"
              onClick={submit}
              disabled={!consent || !slip || submitting || blocked || !totals}
              data-submit
            >
              {submitting ? t('order.review.submitting') : t('order.review.submit')}
            </button>
          )}
        </div>
      </div>
      <aside class="lg:sticky lg:top-24 lg:self-start">
        <Summary />
      </aside>
    </div>
  );
}
