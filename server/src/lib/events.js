/** Event log + fan-out to webhook endpoints. */
import { all, run, now } from '../db.js';
import { ids } from './ids.js';
import { createDelivery, endpointWantsEvent, queueDelivery } from './webhooks.js';

export const EVENT_TYPES = [
  'order.paid',
  'order.expired',
  'order.cancelled',
  'payment.pending_verification',
  'payment.captured',
  'payment.failed',
  'refund.created',
  'refund.processed',
  'payment_link.paid',
];

export function emitEvent(db, { merchantId, mode, type, data, orderId = null, paymentId = null }) {
  const id = ids.event();
  const t = now();
  run(db, 'INSERT INTO events (id, merchant_id, mode, type, order_id, payment_id, data, created_at) VALUES (?,?,?,?,?,?,?,?)',
    id, merchantId, mode, type, orderId, paymentId, JSON.stringify(data), t);
  const endpoints = all(db, 'SELECT * FROM webhook_endpoints WHERE merchant_id=? AND mode=? AND active=1', merchantId, mode);
  for (const ep of endpoints) {
    if (!endpointWantsEvent(ep, type)) continue;
    const dId = createDelivery(db, { merchantId, mode, endpointId: ep.id, eventId: id, eventType: type });
    queueDelivery(db, dId);
  }
  return { id, entity: 'event', type, mode, created_at: t, data };
}
