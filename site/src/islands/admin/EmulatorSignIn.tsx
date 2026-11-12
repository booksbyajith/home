import { useState } from 'preact/hooks';
import { adminFirebase } from './fb';

/** Exists only in emulator builds (imported behind __USE_EMULATORS__). Production uses Google sign-in only. */
export default function EmulatorSignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  return (
    <form
      class="card mt-6 p-4"
      data-testid="emulator-signin"
      method="post"
      onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        try {
          const { auth } = await adminFirebase();
          const { signInWithEmailAndPassword } = await import('firebase/auth');
          await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <p class="font-semibold">Emulator sign-in (local development only)</p>
      <label class="field-label mt-2 text-sm" for="emu-email">
        Email
      </label>
      <input
        id="emu-email"
        class="field-input"
        value={email}
        onInput={(e) => setEmail((e.currentTarget as HTMLInputElement).value)}
      />
      <label class="field-label mt-2 text-sm" for="emu-pass">
        Password
      </label>
      <input
        id="emu-pass"
        type="password"
        class="field-input"
        value={password}
        onInput={(e) => setPassword((e.currentTarget as HTMLInputElement).value)}
      />
      <button class="btn-secondary mt-3" type="submit">
        Sign in
      </button>
      {error && <p class="field-error">{error}</p>}
    </form>
  );
}
