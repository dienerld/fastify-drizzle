import type { Redis } from 'ioredis'

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
  /**
   * The underlying ioredis client, for infrastructure that needs Redis itself
   * (e.g. the rate limit store shared by several instances). Not for modules:
   * they receive the `Cache` interface.
   */
  client: RedisClient
  close: () => Promise<void>
}

/** The raw Redis client type (see `CacheConnection.client`). */
export type RedisClient = Redis
