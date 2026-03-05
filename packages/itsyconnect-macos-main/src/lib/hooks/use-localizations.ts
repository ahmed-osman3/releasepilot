"use client";

import { useEffect, useState, useCallback } from "react";
import type { AscLocalization } from "@/lib/asc/localizations";

interface UseLocalizationsResult {
  localizations: AscLocalization[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useLocalizations(
  appId: string,
  versionId: string,
): UseLocalizationsResult {
  const [localizations, setLocalizations] = useState<AscLocalization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent: boolean) => {
    if (!appId || !versionId) {
      setLocalizations([]);
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/apps/${appId}/versions/${versionId}/localizations`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to load localizations");
        setLocalizations([]);
        return;
      }

      const data = await res.json();
      setLocalizations(data.localizations ?? []);
    } catch {
      setError("Network error");
      setLocalizations([]);
    } finally {
      setLoading(false);
    }
  }, [appId, versionId]);

  const refresh = useCallback(() => fetchData(true), [fetchData]);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  return { localizations, loading, error, refresh };
}
