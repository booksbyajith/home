import { format } from '../../i18n/index';
import type { I18nKey } from '../../i18n/si';

export type MiniDict = Partial<Record<I18nKey, string>>;

export function makeT(dict: MiniDict) {
  return (key: I18nKey, vars?: Record<string, string | number>) => format(dict[key] ?? key, vars);
}
