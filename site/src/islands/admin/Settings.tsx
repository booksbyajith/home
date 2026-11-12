import { l10nText as tl } from '@shared/l10n';
import { DEFAULT_PRIVATE_CONFIG, mergePrivateConfig, mergePublicConfig } from '@shared/defaults';
import { DISTRICTS } from '@shared/districts';
import { TEMPLATE_VARS, renderTemplate } from '@shared/templates';
import {
  TEMPLATE_KEYS,
  WA_EVENTS,
  type PrivateConfig,
  type PublicConfig,
  type SocialLink,
} from '@shared/types';
import { useEffect, useState } from 'preact/hooks';
import type { I18nKey } from '../../i18n/si';
import { call, callError } from '../../lib/firebase';
import { adminFirebase } from './fb';
import { L10nIn, NumIn, SaveBar, Section, TextIn, Toggle, useAdmin, useT } from './ui';

type PubKey = keyof PublicConfig;
type PrivKey = keyof PrivateConfig;

const SAMPLE: Record<string, string> = {
  name: 'Nimal Perera',
  orderId: 'AJ-2611-7K3Q',
  bookTitles: 'Finding Sinhabahu',
  total: 'Rs. 4,850',
  courier: 'Sri Lanka Post',
  trackingNo: 'RR123456789LK',
  trackingUrl: 'https://example.com/track/#AJ-2611-7K3Q',
  facebookUrl: 'https://www.facebook.com/example',
  reason: 'The amount does not match',
  orderUrl: 'https://example.com/order/',
};

function LinkList({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SocialLink[];
  onChange: (v: SocialLink[]) => void;
}) {
  return (
    <fieldset class="mb-4">
      <legend class="field-label">{label}</legend>
      {value.map((r, i) => (
        <div class="mb-3 rounded border border-line p-3">
          <TextIn
            label="URL"
            type="url"
            value={r.url}
            onInput={(url) => onChange(value.map((x, j) => (j === i ? { ...x, url } : x)))}
          />
          <L10nIn
            label="Title"
            value={r.title}
            onInput={(title) => onChange(value.map((x, j) => (j === i ? { ...x, title } : x)))}
          />
          <button
            type="button"
            class="btn-quiet min-h-9 px-2 py-0 text-sm"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      {value.length < 6 && (
        <button
          type="button"
          class="btn-secondary min-h-9 px-3 py-0"
          onClick={() => onChange([...value, { url: '', title: { si: '', en: '' } }])}
        >
          +
        </button>
      )}
    </fieldset>
  );
}

export function Settings() {
  const t = useT();
  const { lang } = useAdmin();
  const [pub, setPub] = useState<PublicConfig | null>(null);
  const [priv, setPriv] = useState<PrivateConfig | null>(null);
  const [states, setStates] = useState<Record<string, string>>({});

  useEffect(() => {
    void (async () => {
      const { db } = await adminFirebase();
      const fs = await import('firebase/firestore');
      const [p, q] = await Promise.all([
        fs.getDoc(fs.doc(db, 'config/public')),
        fs.getDoc(fs.doc(db, 'config/private')),
      ]);
      setPub(mergePublicConfig(p.data() as Partial<PublicConfig>));
      setPriv(mergePrivateConfig(q.data() as Partial<PrivateConfig>));
    })();
  }, []);

  if (!pub || !priv) return <p>…</p>;

  const setP = <K extends PubKey>(k: K, v: PublicConfig[K]) => setPub({ ...pub, [k]: v });
  const setQ = <K extends PrivKey>(k: K, v: PrivateConfig[K]) => setPriv({ ...priv, [k]: v });

  const save = async (
    id: string,
    data: { public?: Partial<PublicConfig>; private?: Partial<PrivateConfig> },
  ) => {
    setStates((s) => ({ ...s, [id]: 'saving' }));
    try {
      await call('updateSettings', data);
      setStates((s) => ({ ...s, [id]: 'saved' }));
      try {
        sessionStorage.removeItem('aj.cfg.v1');
      } catch {
        /* ignore */
      }
    } catch (e) {
      const ce = callError(e);
      setStates((s) => ({ ...s, [id]: `${ce.code ?? ce.status}: ${ce.fields.join(', ')}` }));
    }
  };
  const pick = <K extends PubKey>(...keys: K[]) =>
    Object.fromEntries(keys.map((k) => [k, pub[k]])) as Partial<PublicConfig>;
  const st = (id: string) => states[id] ?? 'idle';

  return (
    <div data-screen="settings">
      <Section title={t('admin.settings.orders')} id="orders">
        <Toggle
          label={t('admin.settings.ordersOpen')}
          checked={pub.ordersOpen}
          onChange={(v) => setP('ordersOpen', v)}
        />
        <L10nIn
          label={t('admin.settings.notice')}
          area
          value={pub.notice ?? { si: '', en: '' }}
          onInput={(v) => setP('notice', v.si || v.en ? v : null)}
        />
        <SaveBar
          state={st('orders')}
          onSave={() => save('orders', { public: pick('ordersOpen', 'notice') })}
        />
      </Section>

      <Section title={t('admin.settings.bank')} id="bank">
        <div class="grid gap-x-4 md:grid-cols-2">
          <TextIn
            label={t('order.payment.bankName')}
            name="bankName"
            value={pub.bank.bankName}
            onInput={(v) => setP('bank', { ...pub.bank, bankName: v })}
          />
          <TextIn
            label={t('order.payment.branch')}
            name="branch"
            value={pub.bank.branch}
            onInput={(v) => setP('bank', { ...pub.bank, branch: v })}
          />
          <TextIn
            label={t('order.payment.accountName')}
            name="accountName"
            value={pub.bank.accountName}
            onInput={(v) => setP('bank', { ...pub.bank, accountName: v })}
          />
          <TextIn
            label={t('order.payment.accountNumber')}
            name="accountNumber"
            value={pub.bank.accountNumber}
            onInput={(v) => setP('bank', { ...pub.bank, accountNumber: v })}
          />
          <TextIn
            label="Branch code"
            value={pub.bank.branchCode ?? ''}
            onInput={(v) => setP('bank', { ...pub.bank, branchCode: v || null })}
          />
          <TextIn
            label="SWIFT"
            value={pub.bank.swift ?? ''}
            onInput={(v) => setP('bank', { ...pub.bank, swift: v || null })}
          />
        </div>
        <L10nIn
          label={t('admin.settings.instructions')}
          area
          value={pub.paymentInstructions}
          onInput={(v) => setP('paymentInstructions', v)}
        />
        <SaveBar
          state={st('bank')}
          onSave={() => save('bank', { public: pick('bank', 'paymentInstructions') })}
        />
      </Section>

      <Section title={t('admin.settings.delivery')} id="delivery">
        <div class="grid gap-x-4 md:grid-cols-4">
          <NumIn
            label={t('admin.settings.defaultFee')}
            value={pub.delivery.defaultFeeLKR}
            onInput={(v) => setP('delivery', { ...pub.delivery, defaultFeeLKR: v })}
          />
          <NumIn
            label={t('admin.settings.perExtraCopy')}
            value={pub.delivery.perExtraCopyLKR}
            onInput={(v) => setP('delivery', { ...pub.delivery, perExtraCopyLKR: v })}
          />
          <NumIn
            label={`${t('admin.settings.estimateDays')} min`}
            value={pub.delivery.estimateDays.min}
            onInput={(v) =>
              setP('delivery', { ...pub.delivery, estimateDays: { ...pub.delivery.estimateDays, min: v } })
            }
          />
          <NumIn
            label={`${t('admin.settings.estimateDays')} max`}
            value={pub.delivery.estimateDays.max}
            onInput={(v) =>
              setP('delivery', { ...pub.delivery, estimateDays: { ...pub.delivery.estimateDays, max: v } })
            }
          />
        </div>
        <details>
          <summary class="cursor-pointer font-semibold">{t('order.field.district')}</summary>
          <div class="mt-2 grid grid-cols-2 gap-x-4 md:grid-cols-5">
            {DISTRICTS.map((d) => (
              <div class="mb-2">
                <label class="text-sm" for={`fee-${d.id}`}>
                  {d[lang]}
                </label>
                <input
                  id={`fee-${d.id}`}
                  type="number"
                  min={0}
                  class="field-input"
                  placeholder={String(pub.delivery.defaultFeeLKR)}
                  value={pub.delivery.fees[d.id] ?? ''}
                  onInput={(e) => {
                    const v = (e.currentTarget as HTMLInputElement).value;
                    const fees = { ...pub.delivery.fees };
                    if (v === '') delete fees[d.id];
                    else fees[d.id] = Math.max(0, Math.floor(Number(v)));
                    setP('delivery', { ...pub.delivery, fees });
                  }}
                />
              </div>
            ))}
          </div>
        </details>
        <SaveBar state={st('delivery')} onSave={() => save('delivery', { public: pick('delivery') })} />
      </Section>

      <Section title={t('admin.settings.contact')} id="contact">
        <TextIn
          label={t('admin.settings.whatsappNumber')}
          name="whatsappNumber"
          value={pub.contact.whatsappNumber}
          onInput={(v) => setP('contact', { ...pub.contact, whatsappNumber: v })}
        />
        <TextIn
          label={t('admin.settings.orderPhone')}
          value={pub.contact.orderPhone}
          onInput={(v) => setP('contact', { ...pub.contact, orderPhone: v })}
        />
        <TextIn
          label={t('admin.settings.facebookUrl')}
          type="url"
          value={pub.contact.facebookPageUrl}
          onInput={(v) => setP('contact', { ...pub.contact, facebookPageUrl: v })}
        />
        <SaveBar state={st('contact')} onSave={() => save('contact', { public: pick('contact') })} />
      </Section>

      <Section title={t('admin.settings.social')} id="social">
        <LinkList
          label={t('admin.settings.reels')}
          value={pub.social.reels}
          onChange={(reels) => setP('social', { ...pub.social, reels })}
        />
        <LinkList
          label={t('admin.settings.videos')}
          value={pub.social.videos}
          onChange={(videos) => setP('social', { ...pub.social, videos })}
        />
        <fieldset>
          <legend class="field-label">{t('admin.settings.story')}</legend>
          <Toggle
            label={t('admin.settings.story')}
            checked={!!pub.social.storyOfWeek}
            onChange={(on) =>
              setP('social', {
                ...pub.social,
                storyOfWeek: on ? { url: '', title: { si: '', en: '' }, blurb: { si: '', en: '' } } : null,
              })
            }
          />
          {pub.social.storyOfWeek && (
            <>
              <TextIn
                label="URL"
                type="url"
                value={pub.social.storyOfWeek.url}
                onInput={(url) =>
                  setP('social', { ...pub.social, storyOfWeek: { ...pub.social.storyOfWeek!, url } })
                }
              />
              <L10nIn
                label="Title"
                value={pub.social.storyOfWeek.title}
                onInput={(title) =>
                  setP('social', { ...pub.social, storyOfWeek: { ...pub.social.storyOfWeek!, title } })
                }
              />
              <L10nIn
                label="Text"
                area
                value={pub.social.storyOfWeek.blurb}
                onInput={(blurb) =>
                  setP('social', { ...pub.social, storyOfWeek: { ...pub.social.storyOfWeek!, blurb } })
                }
              />
            </>
          )}
        </fieldset>
        <SaveBar state={st('social')} onSave={() => save('social', { public: pick('social') })} />
      </Section>

      <Section title={`${t('admin.settings.bundle')} / ${t('admin.settings.signedCopy')}`} id="offers">
        <Toggle
          label={t('admin.settings.bundle')}
          checked={pub.bundle.enabled}
          onChange={(v) => setP('bundle', { ...pub.bundle, enabled: v })}
        />
        <div class="grid gap-x-4 md:grid-cols-2">
          <NumIn
            label="Min copies"
            min={2}
            value={pub.bundle.minQty}
            onInput={(v) => setP('bundle', { ...pub.bundle, minQty: v })}
          />
          <NumIn
            label="% off"
            value={pub.bundle.percentOff}
            onInput={(v) => setP('bundle', { ...pub.bundle, percentOff: v })}
          />
        </div>
        <Toggle
          label={t('admin.settings.signedCopy')}
          checked={pub.signedCopy.enabled}
          onChange={(v) => setP('signedCopy', { ...pub.signedCopy, enabled: v })}
        />
        <NumIn
          label="Rs. / copy"
          value={pub.signedCopy.surchargeLKR}
          onInput={(v) => setP('signedCopy', { ...pub.signedCopy, surchargeLKR: v })}
        />
        <SaveBar
          state={st('offers')}
          onSave={() => save('offers', { public: pick('bundle', 'signedCopy') })}
        />
      </Section>

      <Section title={t('admin.settings.couriers')} id="couriers">
        {pub.couriers.map((c, i) => (
          <div class="mb-2 grid gap-x-3 rounded border border-line p-2 md:grid-cols-[1fr_2fr_auto]">
            <TextIn
              label={t('admin.field.courier')}
              value={c.name}
              onInput={(name) =>
                setP(
                  'couriers',
                  pub.couriers.map((x, j) => (j === i ? { ...x, name } : x)),
                )
              }
            />
            <TextIn
              label="Tracking URL ({trackingNo})"
              type="url"
              value={c.trackingUrlTemplate ?? ''}
              onInput={(v) =>
                setP(
                  'couriers',
                  pub.couriers.map((x, j) => (j === i ? { ...x, trackingUrlTemplate: v || null } : x)),
                )
              }
            />
            <button
              type="button"
              class="btn-quiet self-end"
              onClick={() =>
                setP(
                  'couriers',
                  pub.couriers.filter((_, j) => j !== i),
                )
              }
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          class="btn-secondary min-h-9 px-3 py-0"
          onClick={() => setP('couriers', [...pub.couriers, { name: '', trackingUrlTemplate: null }])}
        >
          +
        </button>
        <SaveBar state={st('couriers')} onSave={() => save('couriers', { public: pick('couriers') })} />
      </Section>

      <Section title={t('admin.settings.templates')} id="templates">
        <p class="mb-3 text-sm text-ink-soft">
          {t('admin.settings.templateVars')}: {TEMPLATE_VARS.map((v) => `{${v}}`).join(' ')}
        </p>
        {TEMPLATE_KEYS.map((k) => (
          <div class="mb-4 rounded border border-line p-3" data-template={k}>
            <L10nIn
              label={k === 'back_in_stock' ? k : t(`status.${k}` as I18nKey)}
              name={`tpl-${k}`}
              area
              value={priv.templates[k]}
              onInput={(v) => setQ('templates', { ...priv.templates, [k]: v })}
            />
            <p class="text-sm text-ink-soft">
              {t('admin.settings.preview')}:{' '}
              <span class="whitespace-pre-line text-ink">
                {renderTemplate(tl(priv.templates[k], lang), SAMPLE)}
              </span>
            </p>
          </div>
        ))}
        <button
          type="button"
          class="btn-quiet mb-2"
          onClick={() => setQ('templates', DEFAULT_PRIVATE_CONFIG.templates)}
        >
          ↺ Default
        </button>
        <SaveBar
          state={st('templates')}
          onSave={() => save('templates', { private: { templates: priv.templates } })}
        />
      </Section>

      <Section title={t('admin.settings.notifications')} id="notifications">
        <Toggle
          label="Customer emails"
          checked={priv.notifications.customerEmails}
          onChange={(v) => setQ('notifications', { ...priv.notifications, customerEmails: v })}
        />
        <NumIn
          label={t('admin.settings.lowStock')}
          value={priv.lowStockThreshold}
          onInput={(v) => setQ('lowStockThreshold', v)}
        />
        <NumIn
          label={t('admin.settings.retention')}
          min={1}
          value={priv.retention.anonymiseAfterMonths}
          onInput={(v) => setQ('retention', { anonymiseAfterMonths: v })}
        />
        <details class="mt-2">
          <summary class="cursor-pointer font-semibold">WhatsApp Cloud API</summary>
          <Toggle
            label="Enabled"
            checked={priv.notifications.whatsappCloud.enabled}
            onChange={(v) =>
              setQ('notifications', {
                ...priv.notifications,
                whatsappCloud: { ...priv.notifications.whatsappCloud, enabled: v },
              })
            }
          />
          <TextIn
            label="Graph API version"
            value={priv.notifications.whatsappCloud.graphApiVersion}
            onInput={(v) =>
              setQ('notifications', {
                ...priv.notifications,
                whatsappCloud: { ...priv.notifications.whatsappCloud, graphApiVersion: v },
              })
            }
          />
          {WA_EVENTS.map((ev) => (
            <TextIn
              label={`Template name: ${ev}`}
              value={priv.notifications.whatsappCloud.templateNames[ev]}
              onInput={(v) =>
                setQ('notifications', {
                  ...priv.notifications,
                  whatsappCloud: {
                    ...priv.notifications.whatsappCloud,
                    templateNames: { ...priv.notifications.whatsappCloud.templateNames, [ev]: v },
                  },
                })
              }
            />
          ))}
        </details>
        <SaveBar
          state={st('notifications')}
          onSave={() =>
            save('notifications', {
              private: {
                notifications: priv.notifications,
                lowStockThreshold: priv.lowStockThreshold,
                retention: priv.retention,
              },
            })
          }
        />
      </Section>
    </div>
  );
}
