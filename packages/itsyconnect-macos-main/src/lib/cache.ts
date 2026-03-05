import { db } from "@/db";
import { cacheEntries } from "@/db/schema";
import { eq, like } from "drizzle-orm";

export function cacheGet<T>(resource: string, ignoreStale = false): T | null {
  const entry = db
    .select()
    .from(cacheEntries)
    .where(eq(cacheEntries.resource, resource))
    .get();

  if (!entry) return null;

  // Check staleness (skip if caller wants data regardless)
  if (!ignoreStale && Date.now() > entry.fetchedAt + entry.ttlMs) {
    return null;
  }

  return JSON.parse(entry.data) as T;
}

export function cacheSet<T>(resource: string, data: T, ttlMs: number): void {
  db.insert(cacheEntries)
    .values({
      resource,
      data: JSON.stringify(data),
      fetchedAt: Date.now(),
      ttlMs,
    })
    .onConflictDoUpdate({
      target: cacheEntries.resource,
      set: {
        data: JSON.stringify(data),
        fetchedAt: Date.now(),
        ttlMs,
      },
    })
    .run();
}

export function cacheInvalidate(resource: string): void {
  db.delete(cacheEntries).where(eq(cacheEntries.resource, resource)).run();
}

export function cacheInvalidatePrefix(prefix: string): void {
  db.delete(cacheEntries)
    .where(like(cacheEntries.resource, `${prefix}%`))
    .run();
}

export function cacheInvalidateAll(): void {
  db.delete(cacheEntries).run();
}

export function cacheGetMeta(resource: string): { fetchedAt: number; ttlMs: number } | null {
  const entry = db
    .select({ fetchedAt: cacheEntries.fetchedAt, ttlMs: cacheEntries.ttlMs })
    .from(cacheEntries)
    .where(eq(cacheEntries.resource, resource))
    .get();

  return entry ?? null;
}
