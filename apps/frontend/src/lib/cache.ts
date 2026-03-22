type CacheEntry<T> = {
  data: T
  fetchedAt: number
  ttlMs: number
}

const cacheEntries = new Map<string, CacheEntry<unknown>>()
const inFlightEntries = new Map<string, Promise<unknown>>()

export function cacheGet<T>(key: string, ignoreStale = false): T | null {
  const entry = cacheEntries.get(key)
  if (!entry) return null

  if (!ignoreStale && Date.now() > entry.fetchedAt + entry.ttlMs) {
    cacheEntries.delete(key)
    return null
  }

  return entry.data as T
}

export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  if (ttlMs <= 0) {
    cacheEntries.delete(key)
    inFlightEntries.delete(key)
    return
  }

  cacheEntries.set(key, {
    data,
    fetchedAt: Date.now(),
    ttlMs,
  })
}

export function cacheInvalidate(key: string): void {
  cacheEntries.delete(key)
  inFlightEntries.delete(key)
}

export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of cacheEntries.keys()) {
    if (key.startsWith(prefix)) {
      cacheEntries.delete(key)
    }
  }

  for (const key of inFlightEntries.keys()) {
    if (key.startsWith(prefix)) {
      inFlightEntries.delete(key)
    }
  }
}

export function cacheInvalidateAll(): void {
  cacheEntries.clear()
  inFlightEntries.clear()
}

export function cacheGetMeta(
  key: string,
): { fetchedAt: number; ttlMs: number } | null {
  const entry = cacheEntries.get(key)
  if (!entry) return null

  return {
    fetchedAt: entry.fetchedAt,
    ttlMs: entry.ttlMs,
  }
}

export async function withCache<T>(
  key: string,
  ttlMs: number,
  forceRefresh: boolean,
  fetchFn: () => Promise<T>,
): Promise<T> {
  if (!forceRefresh) {
    const cached = cacheGet<T>(key)
    if (cached !== null) return cached

    const pending = inFlightEntries.get(key)
    if (pending) return pending as Promise<T>
  }

  const pending = fetchFn()
    .then((result) => {
      cacheSet(key, result, ttlMs)
      return result
    })
    .finally(() => {
      inFlightEntries.delete(key)
    })

  inFlightEntries.set(key, pending)

  return pending
}
