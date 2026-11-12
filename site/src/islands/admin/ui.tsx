import type { ComponentChildren } from 'preact';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Lang } from '@shared/constants';
import type { L10n } from '@shared/types';
import { format } from '../../i18n/index';
import type { Dict, I18nKey } from '../../i18n/si';

export interface AdminCtx {
  lang: Lang;
  dicts: Record<Lang, Partial<Dict>>;
  base: string;
  siteUrl: string;
}
export const Ctx = createContext<AdminCtx>(null as unknown as AdminCtx);

export function useT() {
  const c = useContext(Ctx);
  return (k: I18nKey, v?: Record<string, string | number>) =>
    format(c.dicts[c.lang][k] ?? c.dicts.en[k] ?? k, v);
}
export const useAdmin = () => useContext(Ctx);

export function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: ComponentChildren;
  id?: string;
}) {
  return (
    <section class="card mb-6 p-4" data-section={id}>
      <h2 class="mb-3 font-sans text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

let uid = 0;
const nextId = () => `a${++uid}`;

export function TextIn(p: {
  label: string;
  value: string;
  onInput: (v: string) => void;
  type?: string;
  area?: boolean;
  rows?: number;
  name?: string;
  required?: boolean;
}) {
  const id = nextId();
  return (
    <div class="mb-3">
      <label for={id} class="field-label text-sm">
        {p.label}
      </label>
      {p.area ? (
        <textarea
          id={id}
          name={p.name}
          class="field-input"
          rows={p.rows ?? 3}
          value={p.value}
          onInput={(e) => p.onInput((e.currentTarget as HTMLTextAreaElement).value)}
        />
      ) : (
        <input
          id={id}
          name={p.name}
          type={p.type ?? 'text'}
          class="field-input"
          value={p.value}
          required={p.required}
          onInput={(e) => p.onInput((e.currentTarget as HTMLInputElement).value)}
        />
      )}
    </div>
  );
}

export function NumIn(p: {
  label: string;
  value: number;
  onInput: (v: number) => void;
  min?: number;
  name?: string;
}) {
  const id = nextId();
  return (
    <div class="mb-3">
      <label for={id} class="field-label text-sm">
        {p.label}
      </label>
      <input
        id={id}
        name={p.name}
        type="number"
        inputMode="numeric"
        min={p.min ?? 0}
        class="field-input"
        value={String(p.value)}
        onInput={(e) => p.onInput(Math.floor(Number((e.currentTarget as HTMLInputElement).value) || 0))}
      />
    </div>
  );
}

export function Toggle(p: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  name?: string;
}) {
  const id = nextId();
  return (
    <div class="mb-3 flex items-center gap-2">
      <input
        id={id}
        name={p.name}
        type="checkbox"
        class="h-5 w-5 accent-maroon"
        checked={p.checked}
        onChange={(e) => p.onChange((e.currentTarget as HTMLInputElement).checked)}
      />
      <label for={id}>{p.label}</label>
    </div>
  );
}

export function L10nIn(p: {
  label: string;
  value: L10n;
  onInput: (v: L10n) => void;
  area?: boolean;
  name?: string;
}) {
  return (
    <fieldset class="mb-2">
      <legend class="field-label text-sm">{p.label}</legend>
      <div class="grid gap-x-3 md:grid-cols-3">
        <TextIn
          label="සිංහල"
          name={p.name && `${p.name}.si`}
          area={p.area}
          value={p.value.si}
          onInput={(si) => p.onInput({ ...p.value, si })}
        />
        <TextIn
          label="English"
          name={p.name && `${p.name}.en`}
          area={p.area}
          value={p.value.en}
          onInput={(en) => p.onInput({ ...p.value, en })}
        />
        <TextIn
          label="தமிழ்"
          name={p.name && `${p.name}.ta`}
          area={p.area}
          value={p.value.ta ?? ''}
          onInput={(ta) => p.onInput({ ...p.value, ta })}
        />
      </div>
    </fieldset>
  );
}

export function SaveBar({
  onSave,
  state,
  label,
}: {
  onSave: () => void;
  state: 'idle' | 'saving' | 'saved' | string;
  label?: string;
}) {
  const t = useT();
  return (
    <div class="mt-2 flex flex-wrap items-center gap-3">
      <button type="button" class="btn-primary" onClick={onSave} disabled={state === 'saving'} data-save>
        {label ?? t('admin.save')}
      </button>
      {state === 'saved' && (
        <span class="font-semibold text-success" role="status">
          ✓ {t('admin.saved')}
        </span>
      )}
      {state !== 'idle' && state !== 'saving' && state !== 'saved' && (
        <span class="field-error" role="alert">
          {state}
        </span>
      )}
    </div>
  );
}

export function downloadText(text: string, filename: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function fmtDate(lang: Lang, ms: number, time = true) {
  if (!ms) return '—';
  return new Intl.DateTimeFormat(lang === 'si' ? 'si-LK' : lang === 'ta' ? 'ta-LK' : 'en-GB', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(ms));
}
