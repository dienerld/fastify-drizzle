import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'

import type { RateLimitSettings } from '~/http/rate-limit'
import type { RedisClient } from '~/infra/cache'

type Make = (
  rateLimit: Partial<RateLimitSettings>,
  redis?: RedisClient
) => Promise<FastifyInstance>

const standardError = (statusCode = 429) => ({
  error: 'Too Many Requests',
  message: expect.stringMatching(/rate limit exceeded/i),
  statusCode,
})

/**
 * Rate limit behaviour through HTTP. Runs with the in-memory store (unit) and
 * with the Redis store (redis project). `make` builds an app with small limits
 * and NO real repositories: every request below is rejected before (or while)
 * reaching the auth service, which is all the limiter needs.
 */
export function describeRateLimit(
  make: Make,
  opts: { redis?: RedisClient; prefix?: string } = {}
) {
  describe(`rate limit${opts.prefix ?? ''}`, () => {
    const apps: FastifyInstance[] = []
    const build = async (limits: Partial<RateLimitSettings>) => {
      const app = await make(limits, opts.redis)
      apps.push(app)
      return app
    }
    afterEach(async () => {
      await Promise.all(apps.splice(0).map(app => app.close()))
    })

    const post = (app: FastifyInstance, url: string, payload: object) =>
      app.inject({ method: 'POST', url, payload })

    it('returns 429 in the standard error format on /auth/google', async () => {
      const app = await build({ authMax: 3, authWindowMs: 60_000 })
      for (let i = 0; i < 3; i++) {
        // not a valid Google token: 401, but it counts
        const res = await post(app, '/auth/google', { idToken: 'x' })
        expect(res.statusCode).toBe(401)
      }
      const blocked = await post(app, '/auth/google', { idToken: 'x' })
      expect(blocked.statusCode).toBe(429)
      expect(blocked.json()).toEqual(standardError())
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0)
    })

    it('returns 429 on /auth/refresh (per IP)', async () => {
      const app = await build({ authMax: 2, authWindowMs: 60_000 })
      // different tokens from one IP: the IP budget is what trips
      await post(app, '/auth/refresh', { refreshToken: 'a' })
      await post(app, '/auth/refresh', { refreshToken: 'b' })
      const blocked = await post(app, '/auth/refresh', { refreshToken: 'c' })
      expect(blocked.statusCode).toBe(429)
      expect(blocked.json()).toEqual(standardError())
    })

    it('limits refresh/logout per token even from other IPs', async () => {
      const app = await build({ authMax: 2, authWindowMs: 60_000 })
      const fromIp = (remoteAddress: string, url: string, token: string) =>
        app.inject({
          method: 'POST',
          url,
          remoteAddress,
          payload: { refreshToken: token },
        })
      expect((await fromIp('10.0.0.1', '/auth/refresh', 't')).statusCode).toBe(
        401
      )
      expect((await fromIp('10.0.0.2', '/auth/refresh', 't')).statusCode).toBe(
        401
      )
      const blocked = await fromIp('10.0.0.3', '/auth/refresh', 't')
      expect(blocked.statusCode).toBe(429)
      expect(blocked.json()).toEqual(standardError())
      // another token from a new IP is fine
      expect(
        (await fromIp('10.0.0.4', '/auth/refresh', 'other')).statusCode
      ).toBe(401)
    })

    it('counts per IP: another client is not blocked', async () => {
      const app = await build({ authMax: 1, authWindowMs: 60_000 })
      const from = (remoteAddress: string) =>
        app.inject({
          method: 'POST',
          url: '/auth/google',
          remoteAddress,
          payload: { idToken: 'x' },
        })
      expect((await from('10.1.0.1')).statusCode).toBe(401)
      expect((await from('10.1.0.1')).statusCode).toBe(429)
      expect((await from('10.1.0.2')).statusCode).toBe(401)
    })

    it('applies a global limit to normal routes, but never to /health', async () => {
      const app = await build({ max: 3, windowMs: 60_000 })
      for (let i = 0; i < 3; i++) {
        expect((await app.inject({ method: 'GET', url: '/' })).statusCode).toBe(
          200
        )
      }
      const blocked = await app.inject({ method: 'GET', url: '/' })
      expect(blocked.statusCode).toBe(429)
      expect(blocked.json()).toEqual(standardError())
      for (let i = 0; i < 10; i++) {
        const health = await app.inject({ method: 'GET', url: '/health' })
        expect(health.statusCode).toBe(200)
      }
    })

    it('the auth budget is separate from the global one', async () => {
      const app = await build({
        max: 100,
        authMax: 1,
        authWindowMs: 60_000,
      })
      await post(app, '/auth/google', { idToken: 'x' })
      expect(
        (await post(app, '/auth/google', { idToken: 'x' })).statusCode
      ).toBe(429)
      expect((await app.inject({ method: 'GET', url: '/' })).statusCode).toBe(
        200
      )
    })
  })
}
