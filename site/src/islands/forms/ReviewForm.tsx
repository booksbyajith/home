import type { Lang } from '@shared/constants';
import { useState } from 'preact/hooks';
import { Field } from '../shared/Field';
import { makeT, type MiniDict } from '../shared/i18n';
import { Honeypot } from './Honeypot';
import { useCallableForm } from './useForm';
import { useHydrated } from '../shared/useHydrated';

export default function ReviewForm({ lang, dict, slug }: { lang: Lang; dict: MiniDict; slug: string }) {
  const t = makeT(dict);
  const [name, setName] = useState('');
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState('');
  const [invalid, setInvalid] = useState(false);
  const f = useCallableForm('submitReview');
  const hydrated = useHydrated();
  if (f.done)
    return (
      <p class="font-semibold text-success" role="status" data-form-done="review">
        ✓ {t('review.done')}
      </p>
    );
  return (
    <form
      class="relative card p-4"
      noValidate
      data-form="review"
      data-hydrated={hydrated ? 'true' : 'false'}
      method="post"
      onSubmit={(e) => {
        e.preventDefault();
        const ok = name.trim().length >= 2 && text.trim().length >= 10;
        setInvalid(!ok);
        if (ok && consent) void f.submit({ slug, displayName: name, rating, text, lang, consent: true }, hp);
      }}
    >
      <Honeypot value={hp} onInput={setHp} />
      <Field id={`rv-n-${slug}`} label={t('review.name')}>
        <input
          id={`rv-n-${slug}`}
          class="field-input"
          maxLength={40}
          value={name}
          onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
        />
      </Field>
      <fieldset class="mb-4">
        <legend class="field-label">{t('review.rating')}</legend>
        <div class="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label class="flex h-11 w-11 cursor-pointer items-center justify-center rounded border border-line text-xl has-[:checked]:bg-gold/20">
              <input
                type="radio"
                name={`rating-${slug}`}
                value={n}
                class="sr-only"
                checked={rating === n}
                onChange={() => setRating(n)}
              />
              <span aria-hidden="true">{n <= rating ? '★' : '☆'}</span>
              <span class="sr-only">{n}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field id={`rv-t-${slug}`} label={t('review.text')}>
        <textarea
          id={`rv-t-${slug}`}
          class="field-input"
          rows={4}
          maxLength={1000}
          value={text}
          onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
        />
      </Field>
      <div class="mb-3 flex items-start gap-2 text-sm">
        <input
          id={`rv-c-${slug}`}
          type="checkbox"
          class="mt-1 h-5 w-5 accent-maroon"
          checked={consent}
          onChange={(e) => setConsent((e.currentTarget as HTMLInputElement).checked)}
        />
        <label for={`rv-c-${slug}`}>{t('bulk.consent')}</label>
      </div>
      <button class="btn-primary" type="submit" disabled={!hydrated || f.busy || !consent}>
        {t('review.submit')}
      </button>
      {(invalid || f.error) && (
        <p class="field-error" role="alert">
          {invalid ? t('form.error.required') : t(f.error!)}
        </p>
      )}
    </form>
  );
}
