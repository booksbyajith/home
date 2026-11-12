import type { Lang } from '../shared/constants.js';
import type { BookDoc } from '../shared/types.js';
import { Timestamp, db } from '../lib/admin.js';
import { runSends, type Send } from './core.js';
import { backInStock } from './emailTemplates.js';
import { channelsFor, firestoreLedger, runtimeSettings } from './runtime.js';

/** Emails every pending stock alert with an email address for this book; returns how many were sent. */
export async function notifyBackInStock(slug: string): Promise<number> {
  const book = (await db().collection('books').doc(slug).get()).data() as BookDoc | undefined;
  if (!book) return 0;
  const snap = await db()
    .collection('stock_alerts')
    .where('slug', '==', slug)
    .where('notifiedAt', '==', null)
    .get();
  const settings = await runtimeSettings();
  const channels = channelsFor(settings);
  const ledger = firestoreLedger();
  let sent = 0;
  for (const doc of snap.docs) {
    const a = doc.data() as { contact: { email: string | null }; lang: Lang };
    if (!a.contact?.email) continue;
    const email = a.contact.email;
    const send: Send = {
      channel: 'email',
      role: 'customer',
      run: (c) =>
        c.email(
          { to: [email], ...backInStock(book.title, slug, a.lang, settings.siteUrl) },
          { event: 'back_in_stock', role: 'customer', slug },
        ),
    };
    try {
      const r = await runSends(
        [send],
        { orderId: `stock|${doc.id}`, eventId: 'back_in_stock', event: 'back_in_stock' },
        channels,
        ledger,
      );
      await doc.ref.update({ notifiedAt: Timestamp.now() });
      sent += r.sent;
    } catch {
      /* failure recorded in notification_failures; the alert stays pending */
    }
  }
  return sent;
}
