import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler } from "./api";
import type { Me } from "./types";

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<Me | null>;
  setMe: (m: Me | null) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const m = await api.get<Me>("/api/auth/me");
      setMe(m);
      return m;
    } catch {
      setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    setUnauthorizedHandler(() => setMe(null));
    return () => setUnauthorizedHandler(null);
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      setMe(null);
    }
  }, []);

  const value = useMemo(() => ({ me, loading, refresh, setMe, logout }), [me, loading, refresh, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}

/** Viewer can only read. Developer can't manage team or refunds. */
export function useCan() {
  const { me } = useAuth();
  const role = me?.user.role ?? "viewer";
  return {
    role,
    write: role !== "viewer",
    refunds: role === "owner" || role === "admin",
    team: role === "owner" || role === "admin",
    developer: role !== "viewer",
  };
}
