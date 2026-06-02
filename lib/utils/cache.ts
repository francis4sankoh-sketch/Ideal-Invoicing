/**
 * Tiny in-memory cache for slow-changing reads (products, business settings).
 *
 * Lives for the browser tab's lifetime. Each entry has a short TTL so data
 * stays fresh, but flipping between pages within that window reuses the
 * already-fetched result instead of hitting Supabase again — which is what
 * makes repeat navigation feel instant.
 *
 * Not for per-record or fast-changing data (quotes/invoices lists) — those
 * should always read live.
 */

type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();

/**
 * Return the cached value for `key` if still fresh, otherwise run `loader`,
 * cache its result for `ttlMs`, and return it. Concurrent callers for the
 * same key share one in-flight promise (deduped) so we never double-fetch.
 */
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;

  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = (async () => {
    try {
      const value = await loader();
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/** Invalidate one key (call after a write so the next read refetches). */
export function invalidate(key: string): void {
  store.delete(key);
  inflight.delete(key);
}

/** Invalidate everything (e.g. on sign-out). */
export function clearCache(): void {
  store.clear();
  inflight.clear();
}

// Common TTLs
export const TTL = {
  short: 30_000, // 30s — lists that change occasionally
  medium: 120_000, // 2m — products, customers
  long: 600_000, // 10m — business settings
};
