export type Mode = "test" | "live";

export interface Collection<T> {
  entity: "collection";
  count: number;
  has_more: boolean;
  items: T[];
}

export interface Customer {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export type OrderStatus = "created" | "attempted" | "paid" | "expired" | "cancelled";
export interface Order {
  id: string;
  entity: "order";
  mode: Mode;
  amount: number;
  amount_payable: number;
  amount_paid: number;
  currency: "INR";
  receipt: string | null;
  description?: string | null;
  notes: Record<string, string> | null;
  customer: Customer | null;
  status: OrderStatus;
  vpa: string;
  payee_name: string;
  payment_session_id: string;
  checkout_url: string;
  return_url: string | null;
  payment_link_id: string | null;
  utr: string | null;
  paid_at: number | null;
  expires_at: number;
  created_at: number;
}

export type PaymentStatus = "created" | "pending_verification" | "captured" | "failed";
export type UpiApp = "gpay" | "phonepe" | "paytm" | "bhim" | "cred" | "other";
export interface Payment {
  id: string;
  entity: "payment";
  mode: Mode;
  order_id: string;
  amount: number;
  currency: "INR";
  status: PaymentStatus;
  method: "upi";
  flow: "qr" | "intent" | "manual";
  upi_app: UpiApp | null;
  utr: string | null;
  payer_vpa: string | null;
  verified_by: "observer" | "merchant" | "simulator" | null;
  observation_id: string | null;
  error_code: string | null;
  error_description: string | null;
  created_at: number;
  captured_at: number | null;
}

export type RefundStatus = "pending" | "processed" | "failed";
export interface Refund {
  id: string;
  entity: "refund";
  mode: Mode;
  payment_id: string;
  order_id: string;
  amount: number;
  currency: "INR";
  status: RefundStatus;
  notes: Record<string, string> | null;
  utr: string | null;
  created_at: number;
  processed_at: number | null;
}

export type LinkStatus = "active" | "paid" | "expired" | "cancelled";
export interface PaymentLink {
  id: string;
  entity: "payment_link";
  mode: Mode;
  amount: number;
  currency: "INR";
  description: string | null;
  reference_id: string | null;
  customer: Customer | null;
  short_url: string;
  status: LinkStatus;
  expire_by: number | null;
  paid_at: number | null;
  order_id: string | null;
  created_at: number;
}

export interface OgEvent {
  id: string;
  entity: "event";
  type: string;
  mode: Mode;
  created_at: number;
  data: Record<string, unknown>;
}

export interface WebhookEndpoint {
  id: string;
  mode: Mode;
  url: string;
  description: string | null;
  events: string[];
  active: boolean;
  secret?: string;
  created_at: number;
  last_delivery_at: number | null;
  failure_count: number;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event_id: string;
  event_type: string;
  status: "pending" | "success" | "failed";
  attempts: number;
  response_status: number | null;
  response_body: string | null;
  duration_ms: number | null;
  next_attempt_at: number | null;
  created_at: number;
}

export interface Vpa {
  id: string;
  mode: Mode;
  vpa: string;
  payee_name: string;
  label: string | null;
  is_default: boolean;
  active: boolean;
  created_at: number;
}

export interface ApiKey {
  id: string;
  mode: Mode;
  status: "active" | "revoked";
  created_at: number;
  last_used_at: number | null;
  key_secret?: string;
}

export interface Observer {
  id: string;
  name: string;
  mode: Mode;
  last_seen_at: number | null;
  active: boolean;
  created_at: number;
  token?: string;
  ingest_url?: string;
}

export interface ParsedSms {
  direction: "credit" | "debit" | "unknown";
  amount: number | null;
  utr: string | null;
  payer_vpa: string | null;
}

export type ObservationStatus = "matched" | "unmatched" | "ignored" | "duplicate";
export interface Observation {
  id: string;
  observer_id: string;
  mode: Mode;
  raw_text: string;
  sender: string | null;
  parsed: ParsedSms;
  status: ObservationStatus;
  order_id: string | null;
  created_at: number;
}

export interface Settings {
  business_name: string;
  business_type: string | null;
  phone: string | null;
  support_email: string | null;
  support_phone: string | null;
  website: string | null;
  logo_url: string | null;
  brand_color: string;
  order_expiry_seconds: number;
  unique_amount: boolean;
  onboarding_completed: boolean;
}

export type Role = "owner" | "admin" | "developer" | "viewer";
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at: number;
  last_login_at?: number | null;
}

export interface ApiLog {
  id: string;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  key_id: string | null;
  created_at: number;
}

export interface Me {
  user: { id: string; name: string; email: string; role: Role };
  merchant: { id: string; business_name: string; onboarding_completed: boolean; live_enabled: boolean };
}

export interface Summary {
  collected_amount: number;
  orders_count: number;
  paid_count: number;
  success_rate: number;
  pending_verification_count: number;
  unmatched_observations_count: number;
  refunds_amount: number;
  avg_ticket: number;
  series: { date: string; amount: number; count: number }[];
  recent_orders: Order[];
  method_split: { upi_app: UpiApp | null; count: number; amount: number }[];
}

export interface OrderDetail {
  order: Order;
  payments: Payment[];
  refunds: Refund[];
  events: OgEvent[];
  observations: Observation[];
}

export interface CheckoutSession {
  order: {
    id: string;
    amount: number;
    amount_payable: number;
    currency: "INR";
    status: OrderStatus;
    receipt: string | null;
    description: string | null;
    expires_at: number;
    customer: Customer | null;
  };
  merchant: {
    name: string;
    logo_url: string | null;
    brand_color: string | null;
    support_email: string | null;
    support_phone: string | null;
  };
  upi: { vpa: string; payee_name: string; uri: string };
  payment: Payment | null;
  mode: Mode;
  return_url: string | null;
  server_time: number;
}

export interface CheckoutStatus {
  order_status: OrderStatus;
  payment_status: PaymentStatus | null;
  redirect_url: string | null;
  expires_at: number;
  server_time: number;
  /** Same fields as the redirect query; present once terminal (server extension). */
  result?: { og_order_id: string; og_payment_id?: string; og_status: string; og_signature?: string } | null;
}

export const EVENT_TYPES = [
  "order.paid",
  "order.expired",
  "order.cancelled",
  "payment.pending_verification",
  "payment.captured",
  "payment.failed",
  "refund.created",
  "refund.processed",
  "payment_link.paid",
] as const;
