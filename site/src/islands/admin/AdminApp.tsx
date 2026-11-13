import type { Lang } from '@shared/constants';
import type { User } from 'firebase/auth';
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { Dict, I18nKey } from '../../i18n/si';
import { Books } from './Books';
import { Dashboard } from './Dashboard';
import { adminFirebase } from './fb';
import { Maintenance } from './Maintenance';
import { OrderDetail } from './OrderDetail';
import { Orders } from './Orders';
import { PrintView } from './PrintView';
import { Alerts, Enquiries, Reviews, Subscribers } from './Records';
import { Settings } from './Settings';
import { Ctx, useT } from './ui';

interface Props {
  dicts: Record<Lang, Partial<Dict>>;
  base: string;
  siteUrl: string;
}

type AuthState = 'loading' | 'signedOut' | 'notAdmin' | 'admin';

function useHashRoute() {
  const [hash, setHash] = useState(typeof location === 'undefined' ? '#/' : location.hash || '#/');
  useEffect(() => {
    const on = () => setHash(location.hash || '#/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const [path, query = ''] = hash.slice(1).split('?');
  return { path: path || '/', params: new URLSearchParams(query) };
}

const NAV: [string, I18nKey][] = [
  ['/', 'admin.nav.dashboard'],
  ['/orders', 'admin.nav.orders'],
  ['/books', 'admin.nav.books'],
  ['/settings', 'admin.nav.settings'],
  ['/reviews', 'admin.nav.reviews'],
  ['/subscribers', 'admin.nav.subscribers'],
  ['/alerts', 'admin.nav.alerts'],
  ['/enquiries', 'admin.nav.enquiries'],
  ['/maintenance', 'admin.nav.maintenance'],
];

export default function AdminApp({ dicts, base, siteUrl }: Props) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return (localStorage.getItem('aj.adminLang') as Lang) || 'si';
    } catch {
      return 'si';
    }
  });
  const [state, setState] = useState<AuthState>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [EmuSignIn, setEmuSignIn] = useState<ComponentType | null>(null);
  const route = useHashRoute();

  const checkClaim = async (u: User | null, force = false) => {
    if (!u) return setState('signedOut');
    const r = await u.getIdTokenResult(force);
    setState(r.claims.admin === true ? 'admin' : 'notAdmin');
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem('aj.adminLang', lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  useEffect(() => {
    let unsub = () => {};
    void adminFirebase().then(async ({ auth }) => {
      const { onAuthStateChanged } = await import('firebase/auth');
      unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        void checkClaim(u);
      });
    });
    if (__USE_EMULATORS__) void import('./EmulatorSignIn').then((m) => setEmuSignIn(() => m.default));
    return () => unsub();
  }, []);

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

  return (
    <Ctx.Provider value={{ lang, dicts, base, siteUrl }}>
      <Shell
        state={state}
        user={user}
        route={route}
        onSignIn={signIn}
        onSignOut={signOut}
        onCheck={() => checkClaim(user, true)}
        lang={lang}
        setLang={setLang}
        EmuSignIn={EmuSignIn}
      />
    </Ctx.Provider>
  );
}

function Shell(p: {
  state: AuthState;
  user: User | null;
  route: { path: string; params: URLSearchParams };
  onSignIn: () => void;
  onSignOut: () => void;
  onCheck: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  EmuSignIn: ComponentType | null;
}) {
  const t = useT();
  const { state, route } = p;
  const LANG_LABEL: Record<Lang, string> = { si: 'සිංහල', en: 'English', ta: 'தமிழ்' };
  const langBtn = (
    <span class="flex">
      {(['si', 'en', 'ta'] as Lang[])
        .filter((l) => l !== p.lang)
        .map((l) => (
          <button
            type="button"
            class="btn-quiet min-h-9 px-2.5 py-1 text-sm sm:px-3"
            lang={l}
            onClick={() => p.setLang(l)}
            data-admin-lang={l}
          >
            {LANG_LABEL[l]}
          </button>
        ))}
    </span>
  );

  if (state === 'loading') return <p class="p-6">…</p>;

  if (state !== 'admin')
    return (
      <div class="flex min-h-[80vh] items-center justify-center p-4" data-admin-state={state}>
        <div class="card w-full max-w-sm p-6 text-center sm:p-8">
          <div class="flex justify-end">{langBtn}</div>
          <img
            src={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/author/author-halftone.webp`}
            alt=""
            class="mx-auto mt-2 h-20 w-20 rounded-full border border-line bg-sepia object-cover object-[52%_15%]"
          />
          <h1 class="mt-4 text-2xl font-bold">{t('admin.title')}</h1>
          {state === 'signedOut' && (
            <>
              <p class="mt-2 text-sm text-ink-soft">{t('admin.signInHint')}</p>
              <button type="button" class="btn-primary mt-6 w-full" onClick={p.onSignIn} data-google-signin>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path
                    fill="#FFC107"
                    d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
                  ></path>
                  <path
                    fill="#FF3D00"
                    d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                  ></path>
                  <path
                    fill="#4CAF50"
                    d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
                  ></path>
                  <path
                    fill="#1976D2"
                    d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
                  ></path>
                </svg>
                {t('admin.signIn')}
              </button>
              {p.EmuSignIn && <p.EmuSignIn />}
            </>
          )}
          {state === 'notAdmin' && (
            <>
              <p
                class="mt-6 rounded-md border border-danger bg-white p-4 font-semibold"
                role="alert"
                data-testid="not-authorised"
              >
                {t('admin.notAuthorised')}
              </p>
              <div class="mt-4 flex gap-3">
                <button type="button" class="btn-secondary" onClick={p.onCheck}>
                  {t('admin.checkAgain')}
                </button>
                <button type="button" class="btn-quiet" onClick={p.onSignOut}>
                  {t('admin.signOut')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );

  const path = route.path;
  const activeIndex = Math.max(
    0,
    NAV.findIndex(([h]) => (h === '/' ? path === '/' : path.startsWith(h))),
  );
  const orderMatch = path.match(/^\/orders\/(AJ-\d{4}-[A-Z0-9]{4})$/);
  let screen;
  if (path === '/') screen = <Dashboard />;
  else if (orderMatch) screen = <OrderDetail orderId={orderMatch[1]} />;
  else if (path === '/orders') screen = <Orders />;
  else if (path === '/print') screen = <PrintView params={route.params} />;
  else if (path === '/books') screen = <Books />;
  else if (path === '/settings') screen = <Settings />;
  else if (path === '/reviews') screen = <Reviews />;
  else if (path === '/subscribers') screen = <Subscribers />;
  else if (path === '/alerts') screen = <Alerts />;
  else if (path === '/enquiries') screen = <Enquiries />;
  else if (path === '/maintenance') screen = <Maintenance />;
  else screen = <Dashboard />;

  return (
    <div class="min-h-screen" data-admin-state="admin">
      <header class="no-print border-b border-line bg-paper-dark">
        <div class="container-page flex items-center justify-between gap-2 py-2">
          <a href="#/" class="min-w-0 truncate font-serif text-lg font-bold text-ink no-underline sm:text-xl">
            {t('admin.title')}
          </a>
          <div class="flex shrink-0 items-center gap-1">
            <span class="mr-1 hidden text-sm text-ink-soft lg:inline">{p.user?.email}</span>
            {langBtn}
            <button
              type="button"
              class="btn-quiet min-h-9 border border-line px-2.5 py-1 text-sm"
              onClick={p.onSignOut}
              aria-label={t('admin.signOut')}
              title={t('admin.signOut')}
              data-admin-signout
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
              <span class="hidden sm:inline">{t('admin.signOut')}</span>
            </button>
          </div>
        </div>
        <nav class="container-page pb-2" aria-label={t('admin.title')}>
          {/* Equal-width tabs that always fit (no scrolling), so switching language never moves them.
              One row with a sliding highlight on large screens; equal rows on smaller screens. */}
          <ul class="relative grid grid-cols-3 gap-1 sm:grid-cols-5 lg:grid-cols-9 lg:gap-0" data-admin-tabs>
            <li
              aria-hidden="true"
              class="pointer-events-none absolute inset-y-0 left-0 hidden rounded-full bg-maroon transition-transform duration-300 ease-out motion-reduce:transition-none lg:block"
              style={{ width: `${100 / NAV.length}%`, transform: `translateX(${activeIndex * 100}%)` }}
              data-tab-indicator
            />
            {NAV.map(([h, k], i) => {
              const active = i === activeIndex;
              return (
                <li class="relative min-w-0">
                  <a
                    href={`#${h}`}
                    aria-current={active ? 'page' : undefined}
                    class={`flex min-h-12 items-center justify-center rounded-full px-2 py-1 text-center text-sm leading-tight [overflow-wrap:anywhere] no-underline transition-colors duration-300 xl:text-base ${
                      active ? 'bg-maroon text-white lg:bg-transparent' : 'text-ink hover:bg-paper'
                    }`}
                    title={t(k)}
                  >
                    {t(k)}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main class="container-page py-6">{screen}</main>
    </div>
  );
}
