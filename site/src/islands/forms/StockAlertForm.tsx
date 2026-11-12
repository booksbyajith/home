import type { Lang } from '@shared/constants';
import { emailSchema, whatsappSchema } from '@shared/schemas';
import { useState } from 'preact/hooks';
import { Field } from '../shared/Field';
import { makeT, type MiniDict } from '../shared/i18n';
import { Honeypot } from './Honeypot';
import { useCallableForm } from './useForm';
import { useHydrated } from '../shared/useHydrated';

export default function StockAlertForm({ lang, dict, slug }: { lang: Lang; dict: MiniDict; slug: string }) {
  const t = makeT(dict);
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState('');
  const [invalid, setInvalid] = useState(false);
  const f = useCallableForm('requestStockAlert');
  const hydrated = useHydrated();
  if (f.done)
    return (
      <p class="font-semibold text-success" role="status" data-form-done="stock-alert">
        ✓ {t('book.notify.done')}
      </p>
    );
  return (
    <form
      class="relative mt-3"
      noValidate
      data-form="stock-alert"
      data-hydrated={hydrated ? 'true' : 'false'}
      method="post"
      onSubmit={(e) => {
        e.preventDefault();
        const okW = !whatsapp || whatsappSchema.safeParse(whatsapp).success;
        const okE = !email || emailSchema.safeParse(email).success;
        const ok = okW && okE && !!(whatsapp || email);
        setInvalid(!ok);
        if (ok && consent) void f.submit({ slug, lang, whatsapp, email, consent: true }, hp);
      }}
    >
      <Honeypot value={hp} onInput={setHp} />
      <div class="grid gap-x-4 sm:grid-cols-2">
        <Field id={`sa-wa-${slug}`} label={t('order.field.whatsapp')}>
          <input
            id={`sa-wa-${slug}`}
            type="tel"
            inputMode="tel"
            class="field-input"
            value={whatsapp}
            onInput={(e) => setWhatsapp((e.currentTarget as HTMLInputElement).value)}
          />
        </Field>
        <Field id={`sa-em-${slug}`} label={t('order.field.email')}>
          <input
            id={`sa-em-${slug}`}
            type="email"
            inputMode="email"
            class="field-input"
            value={email}
            onInput={(e) => setEmail((e.currentTarget as HTMLInputElement).value)}
          />
        </Field>
      </div>
      <div class="mb-3 flex items-start gap-2 text-sm">
        <input
          id={`sa-c-${slug}`}
          type="checkbox"
          class="mt-1 h-5 w-5 accent-maroon"
          checked={consent}
          onChange={(e) => setConsent((e.currentTarget as HTMLInputElement).checked)}
        />
        <label for={`sa-c-${slug}`}>{t('bulk.consent')}</label>
      </div>
      <button class="btn-primary" type="submit" disabled={!hydrated || f.busy || !consent}>
        {t('book.notify.submit')}
      </button>
      {(invalid || f.error) && (
        <p class="field-error" role="alert">
          {invalid ? t('form.error.phone') : t(f.error!)}
        </p>
      )}
    </form>
  );
}
