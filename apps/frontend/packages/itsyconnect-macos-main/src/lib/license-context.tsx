"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

interface LicenseContextValue {
  isPro: boolean;
  email: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextValue>({
  isPro: false,
  email: null,
  loading: true,
  refresh: async () => {},
});

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/license");
      if (res.ok) {
        const data = await res.json();
        setIsPro(data.isPro);
        setEmail(data.email ?? null);
      }
    } catch {
      // Silently fail – will show free tier
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    return window.electron?.store?.onLicenseUpdated(() => {
      refresh();
    });
  }, [refresh]);

  return (
    <LicenseContext.Provider value={{ isPro, email, loading, refresh }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  return useContext(LicenseContext);
}
