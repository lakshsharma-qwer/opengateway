import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { setApiMode } from "./api";
import type { Mode } from "./types";

const KEY = "og.mode";

function initial(): Mode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "live" || v === "test") {
      setApiMode(v);
      return v;
    }
  } catch {
    /* storage blocked */
  }
  setApiMode("test");
  return "test";
}

interface ModeCtx {
  mode: Mode;
  setMode: (m: Mode) => void;
}
const Ctx = createContext<ModeCtx | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(initial);
  const setMode = useCallback((m: Mode) => {
    setApiMode(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* ignore */
    }
    setModeState(m);
  }, []);
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMode() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useMode outside ModeProvider");
  return c;
}
