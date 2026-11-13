import { readJson, remove, writeJson } from './storage';

export const DRAFT_KEY = 'aj.orderDraft.v1';
export const DRAFT_VERSION = 1;

export interface DraftFields {
  name: string;
  mobile: string;
  whatsappSame: boolean;
  whatsapp: string;
  email: string;
  line1: string;
  line2: string;
  city: string;
  districtId: string;
  postalCode: string;
  country: string;
  /** Order number chosen before payment (its dash-free form is the bank reference). */
  orderId: string;
  landmark: string;
  signedCopy: boolean;
  dedicationNote: string;
}

export interface DraftGeo {
  lat: number;
  lng: number;
  accuracyM: number;
  capturedAt: number;
}

export interface Draft {
  v: number;
  updatedAt: number;
  step: number;
  cart: { slug: string; qty: number }[];
  fields: DraftFields;
  geo: DraftGeo | null;
  slipMeta: { name: string; type: string; size: number } | null;
  consent: boolean;
}

export const emptyFields = (): DraftFields => ({
  name: '',
  mobile: '',
  whatsappSame: true,
  whatsapp: '',
  email: '',
  line1: '',
  line2: '',
  city: '',
  districtId: '',
  postalCode: '',
  country: '',
  orderId: '',
  landmark: '',
  signedCopy: false,
  dedicationNote: '',
});

export function loadDraft(): Draft | null {
  const d = readJson<Draft>(DRAFT_KEY);
  if (!d || d.v !== DRAFT_VERSION || !d.fields || !Array.isArray(d.cart)) return null;
  return { ...d, fields: { ...emptyFields(), ...d.fields } };
}

/** A draft is worth restoring when the customer has entered anything. */
export function isMeaningful(d: Draft | null): boolean {
  if (!d) return false;
  const f = d.fields;
  return (
    d.step > 0 ||
    !!d.slipMeta ||
    !!d.geo ||
    // District and country alone don't count: they can be pre-filled from the device time zone.
    [f.name, f.mobile, f.email, f.line1, f.city, f.postalCode, f.landmark, f.dedicationNote].some((v) => v.trim())
  );
}

export function saveDraftNow(d: Omit<Draft, 'v' | 'updatedAt'>): void {
  writeJson(DRAFT_KEY, { ...d, v: DRAFT_VERSION, updatedAt: Date.now() });
}

export function clearDraftJson(): void {
  remove(DRAFT_KEY);
}

/** Debounced saver that also flushes when the page is hidden or closed. */
export function createDraftSaver(delay = 400) {
  let pending: Omit<Draft, 'v' | 'updatedAt'> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (pending) saveDraftNow(pending);
    pending = null;
  };
  const onHide = () => flush();
  if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
  }
  return {
    save(d: Omit<Draft, 'v' | 'updatedAt'>) {
      pending = d;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    flush,
    cancel() {
      pending = null;
      if (timer) clearTimeout(timer);
    },
    dispose() {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    },
  };
}
