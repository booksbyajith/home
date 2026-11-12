import { useEffect, useState } from 'preact/hooks';
import { call } from '../../lib/firebase';
import { makeT, type MiniDict } from '../shared/i18n';

export default function Unsubscribe({ dict }: { dict: MiniDict }) {
  const t = makeT(dict);
  const [state, setState] = useState<'busy' | 'done' | 'error'>('busy');
  useEffect(() => {
    const token = location.hash.slice(1);
    history.replaceState(null, '', location.pathname);
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return setState('error');
    call('unsubscribeNewsletter', { token })
      .then(() => setState('done'))
      .catch(() => setState('error'));
  }, []);
  return (
    <p class="mt-4 text-lg" role="status" data-unsub={state}>
      {state === 'busy'
        ? t('site.loading')
        : state === 'done'
          ? `✓ ${t('newsletter.unsub.done')}`
          : t('site.error.generic')}
    </p>
  );
}
