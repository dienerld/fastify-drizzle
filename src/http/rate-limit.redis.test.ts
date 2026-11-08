import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { buildApp } from '~/app'
import { type CacheConnection, connect, loadEnv } from '~/infra/cache'
import { createFakeGoogle } from '~/test/auth'
import { unknownTokens } from '~/test/no-repositories'
import { describeRateLimit } from './rate-limit.contract'

let conn: CacheConnection
let googleKeys: Awaited<ReturnType<typeof createFakeGoogle>>['googleKeys']

beforeAll(async () => {
  const env = loadEnv()
  if (!env) throw new Error('REDIS_URL is required for the redis tests')
  conn = await connect(env)
  googleKeys = (await createFakeGoogle()).googleKeys
})

afterAll(async () => {
  await conn.close()
})

const clear = async () => {
  const keys = await conn.client.keys('rl:*')
  if (keys.length > 0) await conn.client.del(...keys)
}

describe('rate limit with the Redis store', () => {
  beforeEach(clear)
  afterAll(clear)

  describeRateLimit(
    (rateLimit, redis) =>
      buildApp({
        repositories: unknownTokens,
        auth: { googleKeys },
        rateLimit,
        redis,
        cache: conn.cache,
      }),
    {
      // the shared client only exists after `beforeAll`
      get redis() {
        return conn.client
      },
      prefix: ' (redis)',
    }
  )

  it('shares the counters between instances and keeps tokens out of the keys', async () => {
    const limits = { authMax: 2, authWindowMs: 60_000 }
    const make = () =>
      buildApp({
        repositories: unknownTokens,
        auth: { googleKeys },
        rateLimit: limits,
        redis: conn.client,
        cache: conn.cache,
      })
    const [a, b] = await Promise.all([make(), make()])
    try {
      const refresh = (app: typeof a) =>
        app.inject({
          method: 'POST',
          url: '/auth/refresh',
          payload: { refreshToken: 'super-secret-refresh-token' },
        })
      expect((await refresh(a)).statusCode).toBe(401)
      expect((await refresh(b)).statusCode).toBe(401)
      expect((await refresh(a)).statusCode).toBe(429) // counted across both

      const keys = await conn.client.keys('rl:*')
      expect(keys.some(key => key.includes('auth:'))).toBe(true)
      expect(keys.join('\n')).not.toContain('undefined')
      expect(keys.join('\n')).not.toContain('super-secret-refresh-token')
    } finally {
      await Promise.all([a.close(), b.close()])
    }
  })
})
