"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

export interface BuildActionState {
  appId: string;
  buildId: string;
  status: string;
  hasWhatsNew: boolean;
  hasExternalGroup: boolean;
  whatsNew: string;
  localizationId: string | null;
}

interface BuildActionContextValue {
  state: BuildActionState | null;
  report: (state: BuildActionState) => void;
  clear: () => void;
  refresh: () => void;
  registerRefresh: (fn: () => void) => void;
  save: () => Promise<void>;
  registerSave: (fn: () => Promise<void>) => void;
}

const BuildActionContext = createContext<BuildActionContextValue>({
  state: null,
  report: () => {},
  clear: () => {},
  refresh: () => {},
  registerRefresh: () => {},
  save: async () => {},
  registerSave: () => {},
});

export function BuildActionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BuildActionState | null>(null);
  const refreshRef = useRef<(() => void) | null>(null);
  const saveRef = useRef<(() => Promise<void>) | null>(null);

  const report = useCallback((s: BuildActionState) => setState(s), []);
  const clear = useCallback(() => setState(null), []);
  const refresh = useCallback(() => refreshRef.current?.(), []);
  const registerRefresh = useCallback((fn: () => void) => {
    refreshRef.current = fn;
  }, []);
  const save = useCallback(async () => {
    await saveRef.current?.();
  }, []);
  const registerSave = useCallback((fn: () => Promise<void>) => {
    saveRef.current = fn;
  }, []);

  return (
    <BuildActionContext.Provider value={{ state, report, clear, refresh, registerRefresh, save, registerSave }}>
      {children}
    </BuildActionContext.Provider>
  );
}

export function useBuildAction() {
  return useContext(BuildActionContext);
}
