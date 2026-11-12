import type { OrderDoc } from '../shared/types.js';
import { eventName, planSends, runSends, type NotifyEvent } from './core.js';
import { channelsFor, firestoreLedger, runtimeSettings } from './runtime.js';

export async function notify(order: OrderDoc, event: NotifyEvent) {
  const settings = await runtimeSettings();
  const sends = planSends(order, event, settings);
  return runSends(
    sends,
    { orderId: order.orderId, eventId: event.eventId, event: eventName(event) },
    channelsFor(settings),
    firestoreLedger(),
  );
}

export type { NotifyEvent };
