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
  const langBtn = (
    <button type="button" class="btn-quiet px-3" onClick={() => p.setLang(p.lang === 'si' ? 'en' : 'si')}>
      {p.lang === 'si' ? 'English' : 'සිංහල'}
    </button>
  );

  if (state === 'loading') return <p class="p-6">…</p>;

  if (state !== 'admin')
    return (
      <div class="mx-auto max-w-md p-6" data-admin-state={state}>
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold">{t('admin.title')}</h1>
          {langBtn}
        </div>
        {state === 'signedOut' && (
          <>
            <button type="button" class="btn-primary mt-6" onClick={p.onSignIn} data-google-signin>
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
        <div class="container-page flex flex-wrap items-center justify-between gap-2 py-2">
          <a href="#/" class="font-serif text-lg font-bold text-ink no-underline">
            {t('admin.title')}
          </a>
          <div class="flex items-center gap-2">
            <span class="hidden text-sm text-ink-soft sm:inline">{p.user?.email}</span>
            {langBtn}
            <button type="button" class="btn-quiet px-3" onClick={p.onSignOut}>
              {t('admin.signOut')}
            </button>
          </div>
        </div>
        <nav class="container-page overflow-x-auto pb-2" aria-label={t('admin.title')}>
          {/* Equal-width tabs so switching language never moves them; a highlight slides to the active tab. */}
          <ul
            class="relative grid min-w-max grid-flow-col auto-cols-[8.5rem] sm:auto-cols-[9.5rem]"
            data-admin-tabs
          >
            <li
              aria-hidden="true"
              class="pointer-events-none absolute inset-y-0 left-0 rounded bg-maroon transition-transform duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${100 / NAV.length}%`, transform: `translateX(${activeIndex * 100}%)` }}
              data-tab-indicator
            />
            {NAV.map(([h, k], i) => {
              const active = i === activeIndex;
              return (
                <li class="relative">
                  <a
                    href={`#${h}`}
                    aria-current={active ? 'page' : undefined}
                    class={`block truncate rounded px-2 py-2 text-center no-underline transition-colors duration-300 ${active ? 'text-white' : 'text-ink hover:bg-paper'}`}
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
