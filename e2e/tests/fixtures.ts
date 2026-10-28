/**
 * Shared fixtures for the OpenGateway e2e suite.
 *
 * - Every test fails on page errors and console errors (expected 4xx API
 *   responses are allowed: Chrome logs those as "Failed to load resource").
 * - Every test gets its own X-Forwarded-For address so the per-IP auth rate
 *   limit (20/min) is not shared across the whole suite.
 * - Google Fonts are stubbed so the suite never depends on the internet.
 */
import { test as base, expect, request as pwRequest, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const BASE_URL = `http://localhost:${Number(process.env.OG_E2E_PORT || 4100)}`;

export interface SeedCreds {
  dashboard: { email: string; password: string };
  merchant_id: string;
  key_id: string;
  key_secret: string;
  observer_token: string;
  ingest_url: string;
  webhook_id: string;
  vpa: string;
  hook_url: string;
}
export function seedCreds(): SeedCreds {
  return JSON.parse(fs.readFileSync(path.resolve(here, '../.run/creds.json'), 'utf8'));
}

export const randomIp = () => `10.${crypto.randomInt(1, 255)}.${crypto.randomInt(0, 255)}.${crypto.randomInt(1, 255)}`;
export const uid = () => crypto.randomBytes(5).toString('hex');

/** A fresh, onboarded merchant created through the API, with its own cookie session. */
export interface Merchant {
  api: APIRequestContext;
  email: string;
  password: string;
  name: string;
  business_name: string;
  vpa: string;
  key_id: string;
  key_secret: string;
}

export async function apiContext(headers: Record<string, string> = {}) {
  return pwRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { 'X-Forwarded-For': randomIp(), Origin: BASE_URL, ...headers },
  });
}

export async function createMerchant(opts: { onboarded?: boolean; vpa?: boolean } = {}): Promise<Merchant> {
  const api = await apiContext();
  const id = uid();
  const m = {
    name: 'Asha Rao',
    email: `m_${id}@e2e.test`,
    password: 'secret-pass-123',
    business_name: `Chai Point ${id}`,
    phone: '9876543210',
  };
  const res = await api.post('/api/auth/signup', { data: m });
  expect(res.status(), await res.text()).toBe(201);
  const body = await res.json();
  const vpa = `chai${id}@okaxis`;
  if (opts.vpa !== false) {
    const v = await api.post('/api/vpas?mode=test', { data: { vpa, payee_name: m.business_name, label: 'Primary', mode: 'test' } });
    expect(v.ok(), await v.text()).toBeTruthy();
  }
  if (opts.onboarded !== false) {
    const s = await api.patch('/api/settings?mode=test', { data: { onboarding_completed: true, support_email: `help_${id}@e2e.test`, support_phone: '9876500000' } });
    expect(s.ok(), await s.text()).toBeTruthy();
  }
  return { api, email: m.email, password: m.password, name: m.name, business_name: m.business_name, vpa, key_id: body.test_key.key_id, key_secret: body.test_key.key_secret };
}

/** Log in through the API as the seeded demo merchant and return a Merchant-like handle. */
export async function seedMerchant(): Promise<Merchant> {
  const c = seedCreds();
  const api = await apiContext();
  const r = await api.post('/api/auth/login', { data: c.dashboard });
  expect(r.ok(), await r.text()).toBeTruthy();
  return { api, email: c.dashboard.email, password: c.dashboard.password, name: 'Demo Owner', business_name: 'Demo Store', vpa: c.vpa, key_id: c.key_id, key_secret: c.key_secret };
}

/** Log a browser context in as the merchant by copying its session cookie. */
export async function loginContext(context: BrowserContext, m: Merchant) {
  const state = await m.api.storageState();
  await context.addCookies(state.cookies);
}

/** Merchant API (/v1) client using Basic auth. */
export function v1(m: { key_id: string; key_secret: string }, api: APIRequestContext) {
  const auth = 'Basic ' + Buffer.from(`${m.key_id}:${m.key_secret}`).toString('base64');
  return {
    async createOrder(data: Record<string, unknown>) {
      const r = await api.post('/v1/orders', { data, headers: { Authorization: auth } });
      expect(r.status(), await r.text()).toBe(201);
      return r.json();
    },
    raw: (method: 'GET' | 'POST', url: string, data?: unknown) => api.fetch(url, { method, data, headers: { Authorization: auth } }),
  };
}

/** Dashboard API helper with ?mode handling. */
export async function dash<T = any>(m: Merchant, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, data?: unknown, mode = 'test'): Promise<T> {
  const sep = url.includes('?') ? '&' : '?';
  const r = await m.api.fetch(`${url}${sep}mode=${mode}`, { method, data });
  expect(r.ok(), `${method} ${url} -> ${r.status()} ${await r.text()}`).toBeTruthy();
  return r.json();
}

export async function ingest(api: APIRequestContext, ingestUrl: string, text: string, from = 'VM-HDFCBK') {
  const u = new URL(ingestUrl);
  const r = await api.post(`${u.pathname}${u.search}`, { data: { text, from } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json() as Promise<{ ok: boolean; observation_id: string; status: string; order_id: string | null }>;
}

/** Build a bank-style credit SMS for an amount in paise. */
export function creditSms(paise: number, utr = String(crypto.randomInt(100000, 999999)) + String(crypto.randomInt(100000, 999999))) {
  return `Rs.${(paise / 100).toFixed(2)} credited to a/c XX4421 on 23-10-26 by a/c linked to VPA payer.e2e@okaxis (UPI Ref No ${utr}). Avl Bal Rs.12,040.50 -HDFC Bank`;
}

export const hmac = (secret: string, msg: string) => crypto.createHmac('sha256', secret).update(msg).digest('hex');

const ALLOWED_CONSOLE = [
  // Expected API errors (401 on /me when logged out, 4xx from validation tests).
  /Failed to load resource: the server responded with a status of 4\d\d/,
];

/** Stub Google Fonts and allow clipboard access for a browser context. */
export async function prepareContext(context: BrowserContext) {
  await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: route.request().url().includes('googleapis') ? 'text/css' : 'font/woff2', body: '' }),
  );
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE_URL });
}

type Fixtures = {
  consoleGuard: void;
  allowedConsole: RegExp[];
  /** Allow a specific console error for this test only (e.g. a browser message we provoke on purpose). */
  allowConsole: (re: RegExp) => void;
};

export const test = base.extend<Fixtures>({
  extraHTTPHeaders: async ({}, use) => {
    await use({ 'X-Forwarded-For': randomIp() });
  },
  context: async ({ context }, use) => {
    await prepareContext(context);
    await use(context);
  },
  allowedConsole: async ({}, use) => {
    await use([]);
  },
  allowConsole: async ({ allowedConsole }, use) => {
    await use((re: RegExp) => void allowedConsole.push(re));
  },
  consoleGuard: [
    async ({ context, allowedConsole: allowedHere }, use, testInfo) => {
      const problems: string[] = [];
      const watch = (page: Page) => {
        page.on('console', (msg) => {
          if (msg.type() !== 'error') return;
          const text = msg.text();
          if ([...ALLOWED_CONSOLE, ...allowedHere].some((re) => re.test(text))) return;
          problems.push(`[console.error] ${page.url()} :: ${text}`);
        });
        page.on('pageerror', (err) => problems.push(`[pageerror] ${page.url()} :: ${err.message}`));
      };
      context.pages().forEach(watch);
      context.on('page', watch);
      await use();
      if (testInfo.status === testInfo.expectedStatus) {
        expect(problems, 'console errors / page errors during the test').toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };

/** Assert there is no horizontal scrolling on the current page. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: Math.max(doc.scrollWidth, document.body.scrollWidth), clientWidth: doc.clientWidth };
  });
  expect(overflow.scrollWidth, `${page.url()} is ${overflow.scrollWidth}px wide in a ${overflow.clientWidth}px viewport`).toBeLessThanOrEqual(overflow.clientWidth);
}

/** Toast helper: success/info toasts are role=status, errors role=alert. */
export const toast = (page: Page, text: string | RegExp) => page.locator('[aria-live="polite"] > div').filter({ hasText: text });

/** Public checkout API helpers (what the hosted checkout calls). */
export const checkoutApi = (api: APIRequestContext, ps: string) => ({
  get: async () => (await api.get(`/api/checkout/${ps}`)).json(),
  attempt: async (flow = 'qr', upi_app?: string) => {
    const r = await api.post(`/api/checkout/${ps}/attempt`, { data: upi_app ? { flow, upi_app } : { flow } });
    expect(r.ok(), await r.text()).toBeTruthy();
    return r.json();
  },
  confirm: async (utr?: string) => {
    const r = await api.post(`/api/checkout/${ps}/confirm`, { data: utr ? { utr } : {} });
    expect(r.ok(), await r.text()).toBeTruthy();
    return r.json();
  },
  simulate: async (outcome: 'success' | 'failure') => {
    const r = await api.post(`/api/checkout/${ps}/simulate`, { data: { outcome } });
    expect(r.ok(), await r.text()).toBeTruthy();
    return r.json();
  },
});

export const randomUtr = () => String(crypto.randomInt(100000, 999999)) + String(crypto.randomInt(100000, 999999));

/** Create an order and mark it paid through the test simulator. */
export async function paidOrder(m: Merchant, data: Record<string, unknown> = {}) {
  const o = await v1(m, m.api).createOrder({ amount: 50000, ...data });
  const c = checkoutApi(m.api, o.payment_session_id);
  await c.attempt('intent', 'gpay');
  await c.simulate('success');
  return o;
}
