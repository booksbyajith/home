import type { ComponentChildren } from 'preact';

interface Props {
  id: string;
  label: string;
  error?: string | null;
  hint?: string;
  optional?: string;
  children: ComponentChildren;
}

/** Label + control + hint + error, with aria wiring done by the caller via ids. */
export function Field({ id, label, error, hint, optional, children }: Props) {
  return (
    <div class="mb-4">
      <label for={id} class="field-label">
        {label}
        {optional && <span class="ml-1 text-sm font-normal text-ink-soft">({optional})</span>}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} class="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} class="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(id: string, hint?: string, error?: string | null) {
  return [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined;
}
