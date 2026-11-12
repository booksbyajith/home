import { useState } from 'preact/hooks';
import { call } from '../../lib/firebase';
import { Section, useT } from './ui';

interface Result {
  matched: number;
  anonymised: number;
  hasMore: boolean;
}

export function Maintenance() {
  const t = useT();
  const [preview, setPreview] = useState<Result | null>(null);
  const [confirm, setConfirm] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div data-screen="maintenance">
      <Section title={t('admin.nav.maintenance')}>
        <p class="mb-3 text-ink-soft">
          {t('admin.settings.retention')} → <a href="#/settings">{t('admin.nav.settings')}</a>
        </p>
        <button
          type="button"
          class="btn-secondary"
          disabled={busy}
          onClick={async () =>
            setPreview(await call<{ dryRun: boolean }, Result>('anonymiseOldOrders', { dryRun: true }))
          }
        >
          {t('admin.maint.preview')}
        </button>
        {preview && (
          <p class="mt-2" data-testid="maint-preview">
            {t('admin.maint.result', { matched: preview.matched, anonymised: 0 })}
          </p>
        )}
        <div class="mt-6">
          <label class="field-label text-sm" for="m-confirm">
            {t('admin.maint.confirm')}
          </label>
          <input
            id="m-confirm"
            class="field-input max-w-xs"
            value={confirm}
            onInput={(e) => setConfirm((e.currentTarget as HTMLInputElement).value)}
          />
          <button
            type="button"
            class="btn-primary mt-2"
            disabled={confirm !== 'REMOVE' || busy}
            onClick={async () => {
              setBusy(true);
              setResult(await call<{ dryRun: boolean }, Result>('anonymiseOldOrders', { dryRun: false }));
              setBusy(false);
              setConfirm('');
            }}
          >
            {t('admin.maint.run')}
          </button>
          {result && (
            <p class="mt-2 font-semibold" role="status">
              {t('admin.maint.result', { matched: result.matched, anonymised: result.anonymised })}
            </p>
          )}
        </div>
      </Section>
    </div>
  );
}
