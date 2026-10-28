/** Row -> public API object converters. */
import { runtime } from '../config.js';

const json = (s, fallback) => {
  if (s == null || s === '') return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
};
const bool = (v) => !!v;

/** Output-time guards for merchant branding (rows written before validation was tightened). */
export function safeHttpUrl(v) {
  if (typeof v !== 'string' || !v) return null;
  try {
    const u = new URL(v);
    return ['http:', 'https:'].includes(u.protocol) ? v : null;
  } catch { return null; }
}
export const DEFAULT_BRAND_COLOR = '#5f259f';
export const safeColor = (v) => (typeof v === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : DEFAULT_BRAND_COLOR);

export function customerOf(raw) {
  const c = json(raw, {}) || {};
  return { name: c.name ?? null, email: c.email ?? null, phone: c.phone ?? null };
}

export const checkoutUrl = (ps) => `${runtime.publicUrl}/pay/${ps}`;
export const linkShortUrl = (code) => `${runtime.publicUrl}/l/${code}`;

export function order(r) {
  if (!r) return null;
  return {
    id: r.id,
    entity: 'order',
    mode: r.mode,
    amount: r.amount,
    amount_payable: r.amount_payable,
    amount_paid: r.amount_paid,
    currency: r.currency,
    receipt: r.receipt ?? null,
    notes: json(r.notes, {}),
    customer: customerOf(r.customer),
    description: r.description ?? null,
    status: r.status,
    vpa: r.vpa,
    payee_name: r.payee_name,
    payment_session_id: r.payment_session_id,
    checkout_url: checkoutUrl(r.payment_session_id),
    return_url: r.return_url ?? null,
    payment_link_id: r.payment_link_id ?? null,
    utr: r.utr ?? null,
    paid_at: r.paid_at ?? null,
    expires_at: r.expires_at,
    created_at: r.created_at,
  };
}

export function payment(r) {
  if (!r) return null;
  return {
    id: r.id,
    entity: 'payment',
    mode: r.mode,
    order_id: r.order_id,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    method: r.method,
    flow: r.flow,
    upi_app: r.upi_app ?? null,
    utr: r.utr ?? null,
    payer_vpa: r.payer_vpa ?? null,
    verified_by: r.verified_by ?? null,
    observation_id: r.observation_id ?? null,
    error_code: r.error_code ?? null,
    error_description: r.error_description ?? null,
    created_at: r.created_at,
    captured_at: r.captured_at ?? null,
  };
}

export function refund(r) {
  if (!r) return null;
  return {
    id: r.id,
    entity: 'refund',
    mode: r.mode,
    payment_id: r.payment_id,
    order_id: r.order_id,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    notes: json(r.notes, {}),
    utr: r.utr ?? null,
    created_at: r.created_at,
    processed_at: r.processed_at ?? null,
  };
}

export function paymentLink(r) {
  if (!r) return null;
  return {
    id: r.id,
    entity: 'payment_link',
    mode: r.mode,
    amount: r.amount,
    currency: r.currency,
    description: r.description ?? null,
    reference_id: r.reference_id ?? null,
    customer: customerOf(r.customer),
    short_url: linkShortUrl(r.code),
    status: r.status,
    expire_by: r.expire_by ?? null,
    paid_at: r.paid_at ?? null,
    order_id: r.order_id ?? null,
    created_at: r.created_at,
  };
}

export function vpa(r) {
  return {
    id: r.id,
    mode: r.mode,
    vpa: r.vpa,
    payee_name: r.payee_name,
    label: r.label ?? null,
    is_default: bool(r.is_default),
    active: bool(r.active),
    created_at: r.created_at,
  };
}

export function apiKey(r) {
  return { id: r.id, mode: r.mode, status: r.status, created_at: r.created_at, last_used_at: r.last_used_at ?? null };
}

export function observer(r) {
  return {
    id: r.id,
    name: r.name,
    mode: r.mode,
    last_seen_at: r.last_seen_at ?? null,
    active: bool(r.active),
    created_at: r.created_at,
  };
}

export function observation(r) {
  return {
    id: r.id,
    observer_id: r.observer_id ?? null,
    mode: r.mode,
    raw_text: r.raw_text,
    sender: r.sender ?? null,
    parsed: { direction: r.direction, amount: r.amount ?? null, utr: r.utr ?? null, payer_vpa: r.payer_vpa ?? null },
    status: r.status,
    order_id: r.order_id ?? null,
    received_at: r.received_at ?? null,
    created_at: r.created_at,
  };
}

export function event(r) {
  return { id: r.id, entity: 'event', type: r.type, mode: r.mode, created_at: r.created_at, data: json(r.data, {}) };
}

export function webhook(r, secret) {
  const o = {
    id: r.id,
    mode: r.mode,
    url: r.url,
    description: r.description ?? null,
    events: json(r.events, ['*']),
    active: bool(r.active),
    created_at: r.created_at,
    last_delivery_at: r.last_delivery_at ?? null,
    failure_count: r.failure_count,
  };
  if (secret) o.secret = secret;
  return o;
}

export function delivery(r) {
  return {
    id: r.id,
    endpoint_id: r.endpoint_id,
    event_id: r.event_id,
    event_type: r.event_type,
    status: r.status,
    attempts: r.attempts,
    response_status: r.response_status ?? null,
    response_body: r.response_body ?? null,
    duration_ms: r.duration_ms ?? null,
    next_attempt_at: r.next_attempt_at ?? null,
    created_at: r.created_at,
  };
}

export function user(r) {
  return { id: r.id, name: r.name, email: r.email, role: r.role, created_at: r.created_at, last_login_at: r.last_login_at ?? null };
}

export function merchantBrief(m) {
  return {
    id: m.id,
    business_name: m.business_name,
    onboarding_completed: bool(m.onboarding_completed),
    live_enabled: bool(m.live_enabled),
  };
}

export function settings(m) {
  return {
    business_name: m.business_name,
    business_type: m.business_type ?? null,
    phone: m.phone ?? null,
    support_email: m.support_email ?? null,
    support_phone: m.support_phone ?? null,
    website: m.website ?? null,
    logo_url: safeHttpUrl(m.logo_url),
    brand_color: safeColor(m.brand_color),
    order_expiry_seconds: m.order_expiry_seconds,
    unique_amount: bool(m.unique_amount),
    onboarding_completed: bool(m.onboarding_completed),
  };
}

export function apiLog(r) {
  return { id: r.id, method: r.method, path: r.path, status: r.status, duration_ms: r.duration_ms, key_id: r.key_id ?? null, created_at: r.created_at };
}
