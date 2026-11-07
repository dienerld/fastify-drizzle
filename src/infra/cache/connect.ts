import { Redis } from 'ioredis'

import type { Cache, CacheConnection } from './cache'
import type { CacheEnv } from './env'

export async function connect(env: CacheEnv): Promise<CacheConnection> {
  const client = new Redis(env.url, {
    lazyConnect: true,
    // fail fast instead of queueing commands while Redis is down
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    commandTimeout: 2000,
  })
  // A connection error must not crash the process: `/health` reports it.
  client.on('error', () => {})
  await client.connect() // fail fast when Redis is unreachable at boot

  const cache: Cache = {
    async get<T>(key: string) {
      const raw = await client.get(key)
      return raw === null ? null : (JSON.parse(raw) as T)
    },

    async set(key, value, ttlSeconds) {
      const raw = JSON.stringify(value)
      if (ttlSeconds) await client.set(key, raw, 'EX', ttlSeconds)
      else await client.set(key, raw)
    },

    async del(key) {
      await client.del(key)
    },

    async ping() {
      try {
        return (await client.ping()) === 'PONG'
      } catch {
        return false
      }
    },
  }

  return {
    cache,
    client,
    close: async () => {
      try {
        await client.quit()
      } catch {
        client.disconnect()
      }
    },
  }
}
