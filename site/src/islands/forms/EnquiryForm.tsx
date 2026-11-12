import { l10nText as tl } from '@shared/l10n';
import type { Lang } from '@shared/constants';
import { ENQUIRY_KINDS, submitEnquirySchema } from '@shared/schemas';
import type { L10n } from '@shared/types';
import { useState } from 'preact/hooks';
import type { I18nKey } from '../../i18n/si';
import { Field } from '../shared/Field';
import { makeT, type MiniDict } from '../shared/i18n';
import { Honeypot } from './Honeypot';
import { useCallableForm } from './useForm';
import { useHydrated } from '../shared/useHydrated';

interface Props {
  lang: Lang;
  dict: MiniDict;
  books: { slug: string; title: L10n }[];
}

export default function EnquiryForm({ lang, dict, books }: Props) {
  const t = makeT(dict);
  const [kind, setKind] = useState<(typeof ENQUIRY_KINDS)[number]>('school');
  const [organisation, setOrganisation] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState('');
  const [errs, setErrs] = useState<string[]>([]);
  const f = useCallableForm('submitEnquiry');
  const hydrated = useHydrated();
  if (f.done)
    return (
      <p class="card p-4 font-semibold text-success" role="status" data-form-done="enquiry">
        ✓ {t('bulk.done')}
      </p>
    );
  const err = (k: string, key: I18nKey) => (errs.includes(k) ? t(key) : null);
  return (
    <form
      class="relative card p-5"
      noValidate
      data-form="enquiry"
      data-hydrated={hydrated ? 'true' : 'false'}
      method="post"
      onSubmit={(e) => {
        e.preventDefault();
        const data = {
          kind,
          organisation,
          contactName,
          phone,
          email,
          books: Object.entries(qty)
            .filter(([, v]) => Number(v) > 0)
            .map(([slug, v]) => ({ slug, qty: Math.floor(Number(v)) })),
          message,
          lang,
          consent: true as const,
        };
        const r = submitEnquirySchema.safeParse(data);
        const bad = r.success ? [] : r.error.issues.map((i) => String(i.path[0]));
        setErrs(bad);
        if (!bad.length && consent) void f.submit(data, hp);
      }}
    >
      <Honeypot value={hp} onInput={setHp} />
      <Field id="enq-kind" label={t('bulk.kind')}>
        <select
          id="enq-kind"
          class="field-input"
          value={kind}
          onChange={(e) => setKind((e.currentTarget as HTMLSelectElement).value as typeof kind)}
        >
          {ENQUIRY_KINDS.map((k) => (
            <option value={k}>{t(`bulk.kind.${k}` as I18nKey)}</option>
          ))}
        </select>
      </Field>
      <Field id="enq-org" label={t('bulk.organisation')} error={err('organisation', 'form.error.required')}>
        <input
          id="enq-org"
          class="field-input"
          maxLength={120}
          value={organisation}
          onInput={(e) => setOrganisation((e.currentTarget as HTMLInputElement).value)}
        />
      </Field>
      <Field id="enq-name" label={t('bulk.contactName')} error={err('contactName', 'form.error.required')}>
        <input
          id="enq-name"
          class="field-input"
          maxLength={80}
          autocomplete="name"
          value={contactName}
          onInput={(e) => setContactName((e.currentTarget as HTMLInputElement).value)}
        />
      </Field>
      <div class="grid gap-x-4 sm:grid-cols-2">
        <Field id="enq-phone" label={t('bulk.phone')} error={err('phone', 'form.error.phone')}>
          <input
            id="enq-phone"
            type="tel"
            inputMode="tel"
            class="field-input"
            value={phone}
            onInput={(e) => setPhone((e.currentTarget as HTMLInputElement).value)}
          />
        </Field>
        <Field
          id="enq-email"
          label={t('bulk.email')}
          optional={t('order.field.optional')}
          error={err('email', 'form.error.email')}
        >
          <input
            id="enq-email"
            type="email"
            inputMode="email"
            class="field-input"
            value={email}
            onInput={(e) => setEmail((e.currentTarget as HTMLInputElement).value)}
          />
        </Field>
      </div>
      <fieldset class="mb-4">
        <legend class="field-label">{t('bulk.books')}</legend>
        {books.map((b) => (
          <div class="mb-2 flex items-center gap-3">
            <input
              id={`enq-q-${b.slug}`}
              type="number"
              min={0}
              max={10000}
              inputMode="numeric"
              class="field-input w-28"
              value={qty[b.slug] ?? ''}
              onInput={(e) =>
                setQty((q) => ({ ...q, [b.slug]: (e.currentTarget as HTMLInputElement).value }))
              }
            />
            <label for={`enq-q-${b.slug}`}>{tl(b.title, lang)}</label>
          </div>
        ))}
        {errs.includes('books') && (
          <p class="field-error" role="alert">
            {t('form.error.required')}
          </p>
        )}
      </fieldset>
      <Field id="enq-msg" label={t('bulk.message')} optional={t('order.field.optional')}>
        <textarea
          id="enq-msg"
          class="field-input"
          rows={4}
          maxLength={2000}
          value={message}
          onInput={(e) => setMessage((e.currentTarget as HTMLTextAreaElement).value)}
        />
      </Field>
      <div class="mb-4 flex items-start gap-2">
        <input
          id="enq-consent"
          type="checkbox"
          class="mt-1 h-5 w-5 accent-maroon"
          checked={consent}
          onChange={(e) => setConsent((e.currentTarget as HTMLInputElement).checked)}
        />
        <label for="enq-consent">{t('bulk.consent')}</label>
      </div>
      <button class="btn-primary" type="submit" disabled={!hydrated || f.busy || !consent}>
        {t('bulk.submit')}
      </button>
      {f.error && (
        <p class="field-error" role="alert">
          {t(f.error)}
        </p>
      )}
    </form>
  );
}
