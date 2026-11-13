/**
 * Packing page for staff (/staff/). Shows only the orders the admin has verified, prints
 * postal labels (6 per A4, with cut lines and a QR code) and marks orders as packed by scanning
 * a label's QR code. Staff have no access to the admin panel or to other orders.
 */
import type { Lang } from '@shared/constants';
import { l10nText as tl } from '@shared/l10n';
import type { User } from 'firebase/auth';
import type { ComponentType } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Dict, I18nKey } from '../../i18n/si';
import { call, callError } from '../../lib/firebase';
import { adminFirebase } from '../admin/fb';

interface StaffOrder {
  orderId: string;
  status: 'payment_verified' | 'packed';
  verifiedAt: number;
  name: string;
  phone: string;
  addressLines: string[];
  items: { title: { si: string; en: string; ta?: string }; qty: number }[];
  signedCopy: boolean;
  dedicationNote: string | null;
}

interface Props {
  dicts: Record<Lang, Partial<Dict>>;
  siteUrl: string;
  senderName: string;
}

type AuthState = 'loading' | 'signedOut' | 'notStaff' | 'staff';
const ORDER_ID = /AJ-\d{4}-[2-9A-HJKMNP-TV-Z]{4}/;

export default function StaffApp({ dicts, siteUrl, senderName }: Props) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return (localStorage.getItem('aj.staffLang') as Lang) || 'si';
    } catch {
      return 'si';
    }
  });
  const t = (k: I18nKey, vars?: Record<string, string | number>) => {
    let s = (dicts[lang][k] ?? dicts.en[k] ?? k) as string;
    for (const [n, v] of Object.entries(vars ?? {})) s = s.replace(`{${n}}`, String(v));
    return s;
  };
  const [state, setState] = useState<AuthState>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [EmuSignIn, setEmuSignIn] = useState<ComponentType | null>(null);
  const [orders, setOrders] = useState<StaffOrder[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [focus, setFocus] = useState<string | null>(null); // order opened from a scan or a QR link
  const [scanning, setScanning] = useState(false);
  const [printSet, setPrintSet] = useState<StaffOrder[]>([]);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem('aj.staffLang', lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const checkClaim = async (u: User | null, force = false) => {
    if (!u) return setState('signedOut');
    const r = await u.getIdTokenResult(force);
    setState(r.claims.staff === true || r.claims.admin === true ? 'staff' : 'notStaff');
  };

  useEffect(() => {
    let unsub = () => {};
    void adminFirebase().then(async ({ auth }) => {
      const { onAuthStateChanged } = await import('firebase/auth');
      unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        void checkClaim(u);
      });
    });
    if (__USE_EMULATORS__) void import('../admin/EmulatorSignIn').then((m) => setEmuSignIn(() => m.default));
    // A label's QR code opens /staff/#/scan/AJ-…: show that order.
    const fromHash = () => setFocus(location.hash.match(ORDER_ID)?.[0] ?? null);
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => {
      unsub();
      window.removeEventListener('hashchange', fromHash);
    };
  }, []);

  const load = async () => {
    try {
      const r = await call<Record<string, never>, { orders: StaffOrder[] }>('staffOrders', {});
      setOrders(r.orders);
    } catch {
      setMsg({ kind: 'err', text: t('staff.error') });
    }
  };
  useEffect(() => {
    if (state === 'staff') void load();
  }, [state]);

  const markPacked = async (orderId: string) => {
    setBusy(orderId);
    setMsg(null);
    try {
      await call('updateOrderStatus', { orderId, to: 'packed' });
      setOrders((os) => os?.map((o) => (o.orderId === orderId ? { ...o, status: 'packed' } : o)) ?? os);
      setMsg({ kind: 'ok', text: `${orderId}: ${t('staff.done')}` });
    } catch (e) {
      const c = callError(e);
      setMsg({
        kind: 'err',
        text: c.code === 'INVALID_TRANSITION' ? t('staff.notInList') : t('staff.error'),
      });
    } finally {
      setBusy(null);
    }
  };

  const print = (list: StaffOrder[]) => {
    setPrintSet(list);
    // Let the labels render (and their QR codes load) before printing.
    setTimeout(() => window.print(), 400);
  };

  const signIn = async () => {
    const { auth } = await adminFirebase();
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    await signInWithPopup(auth, new GoogleAuthProvider()).catch(() => undefined);
  };
  const signOut = async () => {
    const { auth } = await adminFirebase();
    const { signOut: so } = await import('firebase/auth');
    await so(auth);
  };

  const LANG_LABEL: Record<Lang, string> = { si: 'සිංහල', en: 'English', ta: 'தமிழ்' };
  const langs = (
    <span class="flex">
      {(['si', 'en', 'ta'] as Lang[])
        .filter((l) => l !== lang)
        .map((l) => (
          <button
            type="button"
            class="btn-quiet min-h-9 px-2.5 py-1 text-sm"
            lang={l}
            onClick={() => setLang(l)}
          >
            {LANG_LABEL[l]}
          </button>
        ))}
    </span>
  );

  if (state === 'loading') return <p class="p-6">…</p>;

  if (state !== 'staff')
    return (
      <div class="flex min-h-[80vh] items-center justify-center p-4" data-staff-state={state}>
        <div class="card w-full max-w-sm p-6 text-center">
          <div class="flex justify-end">{langs}</div>
          <h1 class="mt-2 text-2xl font-bold">{t('staff.title')}</h1>
          {state === 'signedOut' ? (
            <>
              <p class="mt-2 text-sm text-ink-soft">{t('staff.signInHint')}</p>
              <button type="button" class="btn-primary mt-6 w-full" onClick={signIn} data-google-signin>
                {t('admin.signIn')}
              </button>
              {EmuSignIn && <EmuSignIn />}
            </>
          ) : (
            <>
              <p class="mt-4 rounded-md border border-danger bg-white p-4 font-semibold" role="alert">
                {t('staff.notStaff')}
              </p>
              <div class="mt-4 flex justify-center gap-3">
                <button type="button" class="btn-secondary" onClick={() => checkClaim(user, true)}>
                  {t('admin.checkAgain')}
                </button>
                <button type="button" class="btn-quiet" onClick={signOut}>
                  {t('admin.signOut')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );

  const toPack = (orders ?? []).filter((o) => o.status === 'payment_verified');
  const packed = (orders ?? []).filter((o) => o.status === 'packed');
  const focused = focus ? (orders ?? []).find((o) => o.orderId === focus) : undefined;
  const dateFmt = new Intl.DateTimeFormat(lang === 'si' ? 'si-LK' : lang === 'ta' ? 'ta-LK' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  });

  const card = (o: StaffOrder, big = false) => (
    <li class={`card p-4 ${big ? 'border-2 border-maroon' : ''}`} data-staff-order={o.orderId}>
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <span class="font-mono text-lg font-bold">{o.orderId}</span>
        <span class="text-sm text-ink-soft">
          {t('staff.verifiedOn', { date: dateFmt.format(o.verifiedAt) })}
        </span>
      </div>
      <p class="mt-1 font-semibold">{o.name}</p>
      <p class="text-sm text-ink-soft [overflow-wrap:anywhere]">{o.addressLines.join(', ')}</p>
      <ul class="mt-2 text-sm">
        {o.items.map((i) => (
          <li>
            📖 {tl(i.title, lang)} × {i.qty}
          </li>
        ))}
      </ul>
      {o.signedCopy && (
        <p class="mt-1 text-sm font-semibold text-maroon">
          ✍ {t('staff.signed')}
          {o.dedicationNote && `: “${o.dedicationNote}”`}
        </p>
      )}
      <div class="mt-3 flex flex-wrap gap-2">
        {o.status === 'payment_verified' ? (
          <button
            type="button"
            class="btn-primary"
            disabled={busy === o.orderId}
            onClick={() => void markPacked(o.orderId)}
            data-mark-packed={o.orderId}
          >
            ✓ {t('staff.markPacked')}
          </button>
        ) : (
          <span class="badge self-center bg-success/10 text-success">✓ {t('status.packed')}</span>
        )}
        <button type="button" class="btn-secondary" onClick={() => print([o])}>
          🖨 {t('staff.printOne')}
        </button>
      </div>
    </li>
  );

  return (
    <div class="min-h-screen" data-staff-state="staff">
      <header class="no-print sticky top-0 z-10 border-b border-line bg-paper-dark/95 backdrop-blur">
        <div class="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-2">
          <h1 class="font-serif text-xl font-bold">{t('staff.title')}</h1>
          <div class="flex items-center gap-1">
            {langs}
            <button
              type="button"
              class="btn-quiet min-h-9 border border-line px-2.5 py-1"
              onClick={signOut}
              aria-label={t('admin.signOut')}
              title={t('admin.signOut')}
            >
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
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"></path>
                <path d="M10 17l-5-5 5-5M5 12h11"></path>
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main class="no-print mx-auto max-w-2xl space-y-4 px-4 py-4">
        <div class="grid grid-cols-2 gap-3">
          <button
            type="button"
            class="btn-primary min-h-14 text-lg"
            disabled={!toPack.length}
            onClick={() => print(toPack)}
            data-print-all
          >
            🖨 {t('staff.printAll', { n: toPack.length })}
          </button>
          <button
            type="button"
            class="btn-secondary min-h-14 text-lg"
            onClick={() => setScanning(true)}
            data-scan
          >
            📷 {t('staff.scan')}
          </button>
        </div>
        <p class="text-center text-sm text-ink-soft">{t('staff.printHint')}</p>

        {msg && (
          <p
            class={`rounded-lg p-3 font-semibold ${msg.kind === 'ok' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}
            role={msg.kind === 'ok' ? 'status' : 'alert'}
            data-staff-msg={msg.kind}
          >
            {msg.text}
          </p>
        )}

        {focus && orders && (
          <section aria-label={focus}>
            {focused ? (
              <ul>{card(focused, true)}</ul>
            ) : (
              <p class="rounded-lg bg-danger/10 p-3 font-semibold text-danger">
                {focus}: {t('staff.notInList')}
              </p>
            )}
          </section>
        )}

        <section>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold">
              {t('staff.toPack')} ({toPack.length})
            </h2>
            <button type="button" class="btn-quiet min-h-9 px-3 text-sm" onClick={() => void load()}>
              ↻ {t('staff.refresh')}
            </button>
          </div>
          {orders === null ? (
            <p class="mt-2">…</p>
          ) : toPack.length ? (
            <ul class="mt-2 space-y-3">{toPack.map((o) => card(o))}</ul>
          ) : (
            <p class="mt-2 text-ink-soft">{t('staff.none')}</p>
          )}
        </section>

        {packed.length > 0 && (
          <section>
            <h2 class="text-lg font-bold">
              {t('staff.packedList')} ({packed.length})
            </h2>
            <ul class="mt-2 space-y-3">{packed.map((o) => card(o))}</ul>
          </section>
        )}
      </main>

      {scanning && (
        <Scanner
          t={t}
          onClose={() => setScanning(false)}
          onFound={(id) => {
            setScanning(false);
            location.hash = `#/scan/${id}`;
            const o = orders?.find((x) => x.orderId === id);
            if (o?.status === 'payment_verified') void markPacked(id);
          }}
        />
      )}

      <Labels orders={printSet} siteUrl={siteUrl} senderName={senderName} lang={lang} />
    </div>
  );
}

/** Camera view that reads a label's QR code (BarcodeDetector where available, else jsQR). */
function Scanner(p: { t: (k: I18nKey) => string; onClose: () => void; onFound: (orderId: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const Detector = (
          window as unknown as {
            BarcodeDetector?: new (o: object) => {
              detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]>;
            };
          }
        ).BarcodeDetector;
        const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;
        const jsQR = detector ? null : (await import('jsqr')).default;
        const tick = async () => {
          if (stopped || !video.current) return;
          const v = video.current;
          let text: string | null = null;
          if (v.readyState >= 2) {
            if (detector) text = (await detector.detect(v).catch(() => []))[0]?.rawValue ?? null;
            else if (jsQR && ctx) {
              canvas.width = v.videoWidth;
              canvas.height = v.videoHeight;
              ctx.drawImage(v, 0, 0);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              text = jsQR(img.data, img.width, img.height)?.data ?? null;
            }
          }
          const id = text?.match(ORDER_ID)?.[0];
          if (id) return p.onFound(id);
          raf = requestAnimationFrame(() => void tick());
        };
        void tick();
      } catch {
        setErr(true);
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);
  return (
    <div
      class="no-print fixed inset-0 z-50 flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
    >
      <video ref={video} class="min-h-0 flex-1 object-cover" playsInline muted />
      <div class="space-y-3 p-4 text-center">
        <p>{err ? p.t('staff.cameraError') : p.t('staff.scanHelp')}</p>
        <button type="button" class="btn-secondary w-full bg-white" onClick={p.onClose}>
          {p.t('staff.close')}
        </button>
      </div>
    </div>
  );
}

/** Printable postal labels: 6 per A4 page (2 × 3), dashed cut lines, QR code for scanning. */
function Labels(p: { orders: StaffOrder[]; siteUrl: string; senderName: string; lang: Lang }) {
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const key = p.orders.map((o) => o.orderId).join(',');
  useEffect(() => {
    if (!p.orders.length) return;
    void import('qrcode').then(async (QR) => {
      const out: Record<string, string> = {};
      for (const o of p.orders)
        out[o.orderId] = await QR.toDataURL(`${p.siteUrl.replace(/\/$/, '')}/staff/#/scan/${o.orderId}`, {
          margin: 0,
          width: 240,
          errorCorrectionLevel: 'M',
        });
      setQrs(out);
    });
  }, [key]);
  const pages = useMemo(() => {
    const out: StaffOrder[][] = [];
    for (let i = 0; i < p.orders.length; i += 6) out.push(p.orders.slice(i, i + 6));
    return out;
  }, [key]);
  return (
    <div class="print-only" aria-hidden="true" data-labels={p.orders.length}>
      {pages.map((page) => (
        <div class="label-page">
          {page.map((o) => (
            <div class="label-cell" data-label={o.orderId}>
              <div class="label-to">
                <p class="label-small">TO</p>
                <p class="label-name">{o.name}</p>
                {o.addressLines.map((l) => (
                  <p>{l}</p>
                ))}
                <p>☎ {o.phone}</p>
              </div>
              <div class="label-foot">
                {qrs[o.orderId] && <img src={qrs[o.orderId]} alt="" class="label-qr" />}
                <div>
                  <p class="label-id">{o.orderId}</p>
                  <p class="label-small">
                    {o.items.map((i) => `${tl(i.title, 'en')} × ${i.qty}`).join(' · ')}
                    {o.signedCopy ? ' · ✍ signed' : ''}
                  </p>
                  <p class="label-small">FROM: {p.senderName}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
