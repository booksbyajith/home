import type { Lang } from './constants.js';
import type { L10n } from './types.js';

/** Text for a language, falling back to English, then Sinhala (Tamil is optional in content and settings). */
export function l10nText(v: L10n | null | undefined, lang: Lang): string {
  if (!v) return '';
  return (v[lang] || v.en || v.si || '').toString();
}
