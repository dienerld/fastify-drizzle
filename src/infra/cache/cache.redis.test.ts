import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '~/app'
import { noRepositories } from '~/test/no-repositories'
import { type CacheConnection, connect, loadEnv } from './index'

describe('redis cache', () => {
  let conn: CacheConnection

  const redisEnv = () => {
    const env = loadEnv()
    if (!env) throw new Error('REDIS_URL is required for the redis tests')
    return env
  }

  beforeAll(async () => {
    conn = await connect(redisEnv())
  })

  afterAll(async () => {
    await conn.close()
  })

  it('stores and reads JSON values', async () => {
    await conn.cache.set('t:obj', { a: 1, b: ['x'] })
    expect(await conn.cache.get('t:obj')).toEqual({ a: 1, b: ['x'] })
    await conn.cache.del('t:obj')
  })

  it('returns null for a missing key', async () => {
    expect(await conn.cache.get('t:missing')).toBeNull()
  })

  it('expires values after the ttl', async () => {
    await conn.cache.set('t:ttl', 'v', 1)
    expect(await conn.cache.get('t:ttl')).toBe('v')
    await new Promise(r => setTimeout(r, 1200))
    expect(await conn.cache.get('t:ttl')).toBeNull()
  })

  it('deletes keys', async () => {
    await conn.cache.set('t:del', 1)
    await conn.cache.del('t:del')
    expect(await conn.cache.get('t:del')).toBeNull()
  })

  it('/health reports the cache as ok, then down (503) once closed', async () => {
    const own = await connect(redisEnv())
    const app = await buildApp({
      repositories: noRepositories,
      cache: own.cache,
    })
    try {
      const up = await app.inject({ method: 'GET', url: '/health' })
      expect(up.statusCode).toBe(200)
      expect(up.json()).toEqual({ status: 'ok', cache: 'ok' })

      await own.close()
      const down = await app.inject({ method: 'GET', url: '/health' })
      expect(down.statusCode).toBe(503)
      expect(down.json()).toEqual({ status: 'error', cache: 'down' })
    } finally {
      await app.close()
    }
  })
})
