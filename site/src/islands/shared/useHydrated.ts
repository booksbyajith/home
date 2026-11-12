import { useEffect, useState } from 'preact/hooks';

/** False during server render and until the island has hydrated in the browser. */
export function useHydrated(): boolean {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}
