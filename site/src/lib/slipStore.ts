/** The bank slip is a file, so it lives in IndexedDB (localStorage cannot hold binary data). */
export interface StoredSlip {
  blob: Blob;
  name: string;
  type: string;
  size: number;
  savedAt: number;
}

async function store() {
  const { createStore, get, set, del } = await import('idb-keyval');
  return { s: createStore('aj-order', 'draft'), get, set, del };
}

export async function saveSlip(slip: StoredSlip): Promise<boolean> {
  try {
    const { s, set } = await store();
    await set('slip.v1', slip, s);
    return true;
  } catch {
    return false;
  }
}

export async function loadSlip(): Promise<StoredSlip | null> {
  try {
    const { s, get } = await store();
    return ((await get('slip.v1', s)) as StoredSlip | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function clearSlip(): Promise<void> {
  try {
    const { s, del } = await store();
    await del('slip.v1', s);
  } catch {
    /* ignore */
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^;]*;base64,/, ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
