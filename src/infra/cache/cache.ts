/** Minimal typed cache. Values are JSON-serialised. */
export interface Cache {
  /** `null` when the key is missing or expired. */
  get<T>(key: string): Promise<T | null>
  /** Stores `value` as JSON; no `ttlSeconds` means it never expires. */
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
  /** Whether the server answers right now (used by `/health`). Never throws. */
  ping(): Promise<boolean>
}

/** What `connect()` returns. */
export type CacheConnection = {
  cache: Cache
  close: () => Promise<void>
}
