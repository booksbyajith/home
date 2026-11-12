import { beforeEach, describe, expect, it } from 'vitest';
import { adminToken, call, db, outbox, resetAll, waitFor } from '../helpers/emulator.js';
import { orderInput } from '../helpers/fixtures.js';

let admin: string;
beforeEach(async () => {
  await resetAll();
  admin = await adminToken();
});

const forOrder = (orderId: string) => (d: any) => d.meta?.orderId === orderId;

describe('order notifications (dev_outbox)', () => {
  it('new order: team email with slip, customer confirmation and telegram alert', async () => {
    const orderId = (await call('createOrder', await orderInput())).result.orderId;
    const items = await waitFor(async () => {
      const o = await outbox(forOrder(orderId));
      return o.length >= 3 ? o : null;
    });
    const team = items.find((d) => d.channel === 'email' && d.meta.role === 'team');
    expect(team.to).toEqual(['team@example.com', 'team2@example.com']);
    expect(team.subject).toContain(orderId);
    expect(team.attachments).toEqual([
      { filename: `slip-${orderId}.jpg`, sizeBytes: expect.any(Number), contentType: 'image/jpeg' },
    ]);
    const cust = items.find((d) => d.channel === 'email' && d.meta.role === 'customer');
    expect(cust.to).toEqual(['customer@example.com']);
    expect(cust.attachments).toEqual([]);
    expect(cust.html).toContain('lang="si"');
    const tg = items.find((d) => d.channel === 'telegram');
    for (const pii of ['Test Customer', '94770000001', 'customer@example.com', 'Test Road'])
      expect(tg.text).not.toContain(pii);
  });

  it('no customer email when none was given', async () => {
    const input = await orderInput();
    delete (input.customer as any).email;
    const orderId = (await call('createOrder', input)).result.orderId;
    const items = await waitFor(async () => {
      const o = await outbox(forOrder(orderId));
      return o.length >= 2 ? o : null;
    });
    await new Promise((r) => setTimeout(r, 1000));
    expect((await outbox(forOrder(orderId))).filter((d) => d.meta.role === 'customer')).toHaveLength(0);
    expect(items.length).toBe(2);
  });

  it('verified, dispatched and rejected email the customer in their language', async () => {
    const orderId = (await call('createOrder', await orderInput({ lang: 'en' }))).result.orderId;
    await call('updateOrderStatus', { orderId, to: 'acknowledged' }, { idToken: admin });
    await call('updateOrderStatus', { orderId, to: 'payment_verified' }, { idToken: admin });
    await call(
      'updateOrderStatus',
      { orderId, to: 'dispatched', courier: 'Demo Courier', trackingNo: 'TRK9' },
      { idToken: admin },
    );
    const mails = await waitFor(async () => {
      const o = (await outbox(forOrder(orderId))).filter(
        (d) => d.channel === 'email' && d.meta.role === 'customer',
      );
      return o.length >= 3 ? o : null;
    });
    const events = mails.map((m) => m.meta.event).sort();
    expect(events).toEqual(['dispatched', 'new_order', 'payment_verified']);
    const dispatched = mails.find((m) => m.meta.event === 'dispatched');
    expect(dispatched.subject).toContain('Your book is on its way');
    expect(dispatched.text).toContain('TRK9');

    const second = (
      await call(
        'createOrder',
        await orderInput({
          lang: 'si',
          customer: {
            name: 'Second Reader',
            mobile: '0770000004',
            whatsapp: '0770000004',
            email: 'second@example.com',
          },
        }),
      )
    ).result.orderId;
    await call(
      'updateOrderStatus',
      { orderId: second, to: 'rejected', reason: 'Slip unreadable' },
      { idToken: admin },
    );
    const rej = await waitFor(
      async () => (await outbox((d) => d.meta?.orderId === second && d.meta.event === 'rejected'))[0],
    );
    expect(rej.html).toContain('lang="si"');
    expect(rej.text).toContain('Slip unreadable');
  });

  it('does not send duplicates when the same audit event is written again', async () => {
    const orderId = (await call('createOrder', await orderInput())).result.orderId;
    await waitFor(async () => (await outbox(forOrder(orderId))).length >= 3);
    const audit = (await db.collection(`orders/${orderId}/audit`).get()).docs[0];
    // Simulate a retry: delete and re-create the same event id.
    const data = audit.data();
    await audit.ref.delete();
    await audit.ref.set(data);
    await new Promise((r) => setTimeout(r, 2500));
    expect(await outbox(forOrder(orderId))).toHaveLength(3);
    expect((await db.collection('notification_log').get()).size).toBe(3);
  });

  it('acknowledged and delivered send no email', async () => {
    const orderId = (await call('createOrder', await orderInput())).result.orderId;
    await waitFor(async () => (await outbox(forOrder(orderId))).length >= 3);
    await call('updateOrderStatus', { orderId, to: 'acknowledged' }, { idToken: admin });
    await new Promise((r) => setTimeout(r, 2000));
    expect(await outbox(forOrder(orderId))).toHaveLength(3);
  });
});
