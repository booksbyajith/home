import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});
const { DRAFT_KEY, clearDraftJson, emptyFields, isMeaningful, loadDraft, saveDraftNow } = await import('./draft');

const base = () => ({ step: 1, cart: [{ slug: 'a', qty: 2 }], fields: { ...emptyFields(), name: 'Test' }, geo: null, slipMeta: null, consent: false });

describe('draft', () => {
  beforeEach(() => store.clear());
  it('saves and loads', () => {
    saveDraftNow(base());
    const d = loadDraft()!;
    expect(d.fields.name).toBe('Test');
    expect(d.cart).toEqual([{ slug: 'a', qty: 2 }]);
    expect(d.v).toBe(1);
  });
  it('discards other versions', () => {
    store.set(DRAFT_KEY, JSON.stringify({ ...base(), v: 99 }));
    expect(loadDraft()).toBeNull();
  });
  it('fills new fields with defaults', () => {
    store.set(DRAFT_KEY, JSON.stringify({ ...base(), v: 1, fields: { name: 'X' } }));
    expect(loadDraft()!.fields.whatsappSame).toBe(true);
  });
  it('clears', () => {
    saveDraftNow(base());
    clearDraftJson();
    expect(loadDraft()).toBeNull();
  });
  it('meaningful only when the customer typed something', () => {
    expect(isMeaningful({ ...base(), step: 0, fields: emptyFields(), v: 1, updatedAt: 0 })).toBe(false);
    expect(isMeaningful({ ...base(), v: 1, updatedAt: 0 })).toBe(true);
  });
  it('survives broken storage', () => {
    store.set(DRAFT_KEY, '{not json');
    expect(loadDraft()).toBeNull();
  });
});
