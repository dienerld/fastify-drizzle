import fastifyRateLimit from '@fastify/rate-limit'
import fp from 'fastify-plugin'

import type { RedisClient } from '~/infra/cache'

export type RateLimitSettings = {
  /** Requests per window, per IP, for every route. */
  max: number
  windowMs: number
  /** Stricter budget for `/auth/*` (also per IP, plus per refresh token). */
  authMax: number
  authWindowMs: number
}

/**
 * Global per-IP limit. In memory by default; with a Redis client the counters
 * are shared by every instance. If Redis fails the limiter lets requests
 * through (`skipOnError`) instead of taking the API down; `/health` already
 * reports the cache. The 429 goes through the single error handler, so it has
 * the standard `{ error, message, statusCode }` body.
 */
export const rateLimitPlugin = fp<{
  settings: RateLimitSettings
  redis?: RedisClient
}>(
  async (app, { settings, redis }) => {
    await app.register(fastifyRateLimit, {
      global: true,
      max: settings.max,
      timeWindow: settings.windowMs,
      redis,
      nameSpace: 'rl:',
      skipOnError: true,
    })
  },
  { name: 'rate-limit' }
)
