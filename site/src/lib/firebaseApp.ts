import type { FirebaseApp } from 'firebase/app';
import { env } from './env';

let appPromise: Promise<FirebaseApp> | null = null;

const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Unsigned token accepted by the Functions emulator (it does not verify App Check tokens). */
export function emulatorAppCheckToken(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub: env.firebase.appId,
      aud: [`projects/${env.firebase.projectId}`],
      iss: 'emulator',
      jti: env.appCheckDebugToken,
      iat: now,
      exp: now + 3600,
    }),
  );
  return `${header}.${payload}.emulator`;
}

/** Firebase app with App Check, initialised lazily on first use (never on page load). */
export function getFirebaseApp(): Promise<FirebaseApp> {
  appPromise ??= (async () => {
    const [{ initializeApp, getApps }, appCheck] = await Promise.all([import('firebase/app'), import('firebase/app-check')]);
    const app = getApps()[0] ?? initializeApp(env.firebase);
    if (__USE_EMULATORS__) {
      appCheck.initializeAppCheck(app, {
        provider: new appCheck.CustomProvider({
          getToken: async () => ({ token: emulatorAppCheckToken(), expireTimeMillis: Date.now() + 3_000_000 }),
        }),
        isTokenAutoRefreshEnabled: false,
      });
    } else if (env.recaptchaSiteKey) {
      appCheck.initializeAppCheck(app, {
        provider: new appCheck.ReCaptchaV3Provider(env.recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }
    return app;
  })();
  return appPromise;
}
