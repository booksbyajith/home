import type { Lang } from '@shared/constants';
import { LANGS } from './paths';

/** Language-neutral path of this page in each language; null = no counterpart in that language. */
export type Alternates = Partial<Record<Lang, string | null>>;

export function resolveAlternates(lang: Lang, neutral: string, alternates?: Alternates): Record<Lang, string | null> {
  const out = {} as Record<Lang, string | null>;
  for (const l of LANGS) out[l] = l === lang ? neutral : alternates && l in alternates ? (alternates[l] ?? null) : neutral;
  return out;
}
