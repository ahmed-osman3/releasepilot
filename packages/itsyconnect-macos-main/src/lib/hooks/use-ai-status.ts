import { useState, useEffect } from "react";

let cachedStatus: boolean | null = null;

export function useAIStatus(): { configured: boolean; loading: boolean } {
  const [configured, setConfigured] = useState(cachedStatus ?? false);
  const [loading, setLoading] = useState(cachedStatus === null);

  useEffect(() => {
    if (cachedStatus !== null) return;

    let cancelled = false;
    fetch("/api/ai/check")
      .then((res) => res.json())
      .then((data: { configured: boolean }) => {
        if (cancelled) return;
        cachedStatus = data.configured;
        setConfigured(data.configured);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        cachedStatus = false;
        setConfigured(false);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { configured, loading };
}

/** Invalidate the cached status (e.g. after saving AI settings). */
export function invalidateAIStatus() {
  cachedStatus = null;
}
