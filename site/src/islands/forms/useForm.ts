import { useState } from 'preact/hooks';
import type { I18nKey } from '../../i18n/si';
import { call, formErrorKey } from '../../lib/firebase';

/** Submit state for small public forms that call one callable. */
export function useCallableForm<T>(name: string) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<I18nKey | null>(null);
  const submit = async (data: T, honeypot: string) => {
    if (honeypot) {
      setDone(true); // silently accept bots
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await call<T, { ok: true }>(name, data);
      setDone(true);
    } catch (e) {
      setError(formErrorKey(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, done, error, setError, submit };
}
