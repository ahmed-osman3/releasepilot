import { cacheGet, cacheSet } from "@/lib/cache";

export async function withCache<T>(
  cacheKey: string,
  ttlMs: number,
  forceRefresh: boolean,
  fetchFn: () => Promise<T>,
): Promise<T> {
  if (!forceRefresh) {
    const cached = cacheGet<T>(cacheKey);
    if (cached) return cached;
  }

  const result = await fetchFn();
  cacheSet(cacheKey, result, ttlMs);
  return result;
}

export function normalizeArray<T>(data: T | T[] | null | undefined): T[] {
  return Array.isArray(data) ? data : data ? [data] : [];
}
