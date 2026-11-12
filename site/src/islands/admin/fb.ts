import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { getFirebaseApp } from '../../lib/firebaseApp';

let ready: Promise<{ auth: Auth; db: Firestore }> | null = null;

/** Auth + Firestore for the admin panel only. Public pages never load these modules. */
export function adminFirebase() {
  ready ??= (async () => {
    const [app, authMod, fsMod] = await Promise.all([
      getFirebaseApp(),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    const auth = authMod.getAuth(app);
    const db = fsMod.getFirestore(app);
    if (__USE_EMULATORS__) {
      authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      fsMod.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
    return { auth, db };
  })();
  return ready;
}

export type Ts = { toDate(): Date; toMillis(): number } | null | undefined;
export const ms = (t: Ts) => (t && typeof t.toMillis === 'function' ? t.toMillis() : 0);
