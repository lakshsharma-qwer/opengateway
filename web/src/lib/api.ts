import type { Mode } from "./types";

export type ApiErrorType =
  | "invalid_request_error"
  | "authentication_error"
  | "not_found_error"
  | "conflict_error"
  | "rate_limit_error"
  | "api_error"
  | "network_error";

export class ApiError extends Error {
  status: number;
  type: ApiErrorType;
  code: string;
  field: string | null;
  constructor(status: number, type: ApiErrorType, code: string, message: string, field: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.type = type;
    this.code = code;
    this.field = field;
  }
}

type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

let currentMode: Mode = "test";
export function setApiMode(m: Mode) {
  currentMode = m;
}
export function getApiMode(): Mode {
  return currentMode;
}

/** Dashboard endpoints take ?mode=. Auth, checkout and public endpoints don't. */
function needsMode(path: string) {
  return (
    path.startsWith("/api/") &&
    !path.startsWith("/api/auth/") &&
    !path.startsWith("/api/checkout/") &&
    !path.startsWith("/api/public/")
  );
}

export function buildUrl(path: string, query?: Query, opts: { mode?: Mode | false } = {}): string {
  const params = new URLSearchParams();
  if (opts.mode !== false && needsMode(path)) params.set("mode", opts.mode ?? currentMode);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return qs ? `${path}${path.includes("?") ? "&" : "?"}${qs}` : path;
}

/** Called on any 401 from a dashboard endpoint, so the auth context can drop the session. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  mode?: Mode | false;
  signal?: AbortSignal;
}

function fmtWait(retryAfter: string): string {
  const secs = Number(retryAfter);
  if (!Number.isFinite(secs) || secs <= 0) return "a moment";
  if (secs < 90) return `${Math.ceil(secs)} seconds`;
  const mins = Math.ceil(secs / 60);
  return mins === 1 ? "1 minute" : `${mins} minutes`;
}

/** Plain-language messages for error codes where the server's text isn't enough on its own. */
const FRIENDLY: Record<string, (retryAfter: string | null) => string> = {
  ACCOUNT_LOCKED: (r) => `Too many failed login attempts. For your security this account is locked — try again in ${r ? fmtWait(r) : "a few minutes"}.`,
  CSRF_REJECTED: () => "This request was blocked because it didn't come from the OpenGateway dashboard. Reload the page and try again.",
  PAYLOAD_TOO_LARGE: () => "That's too much data to send at once. Shorten it and try again.",
  SERVICE_BUSY: (r) => `OpenGateway is busy right now. Try again in ${r ? fmtWait(r) : "a moment"}.`,
  CONFLICT: () => "This was changed at the same time by someone else. Reload and try again.",
};

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, opts.query, { mode: opts.mode });
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: "include",
      headers: opts.body !== undefined ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "network_error", "NETWORK_ERROR", "Can't reach the OpenGateway server. Check your connection and try again.");
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const env = (json as { error?: { type?: ApiErrorType; code?: string; message?: string; field?: string | null } } | null)?.error;
    if (res.status === 401 && path.startsWith("/api/") && !path.startsWith("/api/auth/login") && !path.startsWith("/api/checkout/")) {
      onUnauthorized?.();
    }
    let message = env?.message ?? `Request failed (${res.status})`;
    const retry = res.headers.get("Retry-After");
    const friendly = FRIENDLY[env?.code ?? ""];
    if (friendly) message = friendly(retry);
    else if (res.status === 429 && !env?.message) message = `Too many requests. Try again${retry ? ` in ${fmtWait(retry)}` : " shortly"}.`;
    else if (res.status === 413 && !env) message = FRIENDLY.PAYLOAD_TOO_LARGE(retry);
    if (!env && res.status >= 500) message = "The server hit an error. Try again in a moment.";
    throw new ApiError(res.status, env?.type ?? (res.status >= 500 ? "api_error" : "invalid_request_error"), env?.code ?? `HTTP_${res.status}`, message, env?.field ?? null);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string, query?: Query, opts: Omit<RequestOptions, "query" | "body"> = {}) => request<T>("GET", path, { ...opts, query }),
  post: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, "body"> = {}) => request<T>("POST", path, { ...opts, body: body ?? {} }),
  patch: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, "body"> = {}) => request<T>("PATCH", path, { ...opts, body: body ?? {} }),
  del: <T>(path: string, opts: Omit<RequestOptions, "body"> = {}) => request<T>("DELETE", path, opts),
};

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

/** Trigger a browser download of a URL (keeps cookies, same origin). */
export async function downloadFile(path: string, query: Query, fallbackName: string) {
  const url = buildUrl(path, query);
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    let msg = `Export failed (${res.status})`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? msg;
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, "api_error", "EXPORT_FAILED", msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = /filename="?([^";]+)"?/.exec(cd);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = m?.[1] ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Accepts either a collection envelope or a bare array. */
export function itemsOf<T>(x: { items: T[] } | T[] | null | undefined): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : x.items ?? [];
}
