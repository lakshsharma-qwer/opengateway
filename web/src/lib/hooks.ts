import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage, type Query } from "./api";
import { useMode } from "./mode";

export interface FetchState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
  setData: (d: T | null) => void;
}

/** GET a dashboard resource; refetches when path, query or Test/Live mode change. */
export function useFetch<T>(path: string | null, query?: Query): FetchState<T> {
  const { mode } = useMode();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const [tick, setTick] = useState(0);
  const qKey = JSON.stringify(query ?? {});

  useEffect(() => {
    if (!path) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    api
      .get<T>(path, query, { signal: ctrl.signal, mode })
      .then((d) => setData(d))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setError(errorMessage(e));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, qKey, mode, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms == null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/** Seconds remaining until a unix timestamp, corrected for server clock skew. */
export function useCountdown(expiresAt: number | null | undefined, serverTime?: number | null) {
  const skewRef = useRef(0);
  useEffect(() => {
    if (serverTime) skewRef.current = serverTime - Math.floor(Date.now() / 1000);
  }, [serverTime]);
  const calc = () => (expiresAt ? Math.max(0, expiresAt - (Math.floor(Date.now() / 1000) + skewRef.current)) : 0);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    if (!expiresAt) return;
    const id = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt, serverTime]);
  return left;
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => (typeof window !== "undefined" ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}
