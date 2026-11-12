import { useEffect } from 'preact/hooks';

let loading: Promise<unknown> | null = null;

/** Load the strict international phone rules (about 35 KB) once; resolves when installed. */
export function loadPhoneRules(): Promise<unknown> {
  loading ??= import('@shared/phoneStrict').catch(() => {
    loading = null; // offline: keep the basic check; the server still applies the strict one
  });
  return loading;
}

/** Fetch the phone rules as soon as the visitor starts using a form (first tap, click or key). */
export function usePhoneRules(): void {
  useEffect(() => {
    const go = () => void loadPhoneRules();
    const opts = { once: true, passive: true, capture: true } as const;
    for (const ev of ['focusin', 'pointerdown', 'keydown'] as const) document.addEventListener(ev, go, opts);
    return () => {
      for (const ev of ['focusin', 'pointerdown', 'keydown'] as const)
        document.removeEventListener(ev, go, { capture: true });
    };
  }, []);
}
