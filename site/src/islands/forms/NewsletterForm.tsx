import type { Lang } from '@shared/constants';
import { emailSchema } from '@shared/email';
import { useState } from 'preact/hooks';
import { makeT, type MiniDict } from '../shared/i18n';
import { Honeypot } from './Honeypot';
import { useCallableForm } from './useForm';
import { useHydrated } from '../shared/useHydrated';

export default function NewsletterForm({
  lang,
  dict,
  source,
}: {
  lang: Lang;
  dict: MiniDict;
  source: string;
}) {
  const t = makeT(dict);
  const id = `nl-${source}`;
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState('');
  const [invalid, setInvalid] = useState(false);
  const f = useCallableForm('subscribeNewsletter');
  const hydrated = useHydrated();
  if (f.done)
    return (
      <p class="font-semibold text-success" role="status" data-form-done="newsletter">
        ✓ {t('newsletter.done')}
      </p>
    );
  return (
    <form
      class="relative"
      noValidate
      data-form="newsletter"
      data-hydrated={hydrated ? 'true' : 'false'}
      method="post"
      onSubmit={(e) => {
        e.preventDefault();
        const ok = emailSchema.safeParse(email).success;
        setInvalid(!ok);
        if (ok && consent) void f.submit({ email, lang, consent: true, source }, hp);
      }}
    >
      <Honeypot value={hp} onInput={setHp} />
      <div class="flex flex-wrap items-stretch gap-2">
        <label for={`${id}-email`} class="sr-only">
          {t('newsletter.email')}
        </label>
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autocomplete="email"
          class="field-input min-w-0 flex-[1_1_13rem]"
          placeholder={t('newsletter.email')}
          value={email}
          onInput={(e) => setEmail((e.currentTarget as HTMLInputElement).value)}
          aria-invalid={invalid ? true : undefined}
        />
        <button
          class="btn-primary flex-none px-5 whitespace-nowrap"
          type="submit"
          disabled={!hydrated || f.busy || !consent}
        >
          {t('newsletter.submit')}
        </button>
      </div>
      <div class="mt-2 flex items-start gap-2 text-sm">
        <input
          id={`${id}-consent`}
          type="checkbox"
          class="mt-1 h-5 w-5 accent-maroon"
          checked={consent}
          onChange={(e) => setConsent((e.currentTarget as HTMLInputElement).checked)}
        />
        <label for={`${id}-consent`}>{t('newsletter.consent')}</label>
      </div>
      {(invalid || f.error) && (
        <p class="field-error" role="alert">
          {invalid ? t('form.error.email') : t(f.error!)}
        </p>
      )}
    </form>
  );
}
