import fastifyCors from '@fastify/cors'
import fastifySwagger from '@fastify/swagger'
import scalarApiReference from '@scalar/fastify-api-reference'
import fastify from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import type { JWTVerifyGetKey } from 'jose'
import { env } from '~/env'
import { type RateLimitSettings, rateLimitPlugin } from '~/http/rate-limit'
import { rootRouter } from '~/http/routes/root'
import type { Cache, RedisClient } from '~/infra/cache'
import type { Repositories } from '~/infra/repositories'
import { createGoogleVerifier, googleRemoteKeys } from '~/modules/auth/google'
import { authPlugin } from '~/modules/auth/plugin'
import { authRoutes } from '~/modules/auth/routes'
import { createAccessTokens } from '~/modules/auth/tokens'
import { todoRoutes } from '~/modules/todo/routes'
import { usersRoutes } from '~/modules/users/routes'
import { registerErrorHandlers } from '~/utils/error-handler'
import pkg from '../package.json' with { type: 'json' }

/** Composition root: everything the app needs from outside comes in here. */
export type AppDeps = {
  repositories: Repositories
  /**
   * Optional generic cache (Redis). When omitted the app runs without it and
   * `/health` does not report a cache. Nothing in the template requires it.
   */
  cache?: Cache
  /**
   * Redis client for the rate limit counters, so several instances share them.
   * Omitted: counters live in memory (per process).
   */
  redis?: RedisClient
  /** Overrides for tests; defaults come from `env.http.rateLimit`. */
  rateLimit?: Partial<RateLimitSettings>
  /** Overrides for tests; defaults come from `env`. */
  auth?: {
    /** Keys that verify Google ID tokens. Tests pass a local JWKS (no network). */
    googleKeys?: JWTVerifyGetKey
    allowedEmails?: string[]
  }
}

export async function buildApp({
  repositories,
  cache,
  redis,
  rateLimit,
  auth,
}: AppDeps) {
  const limits = { ...env.http.rateLimit, ...rateLimit }
  const app = fastify({
    // a hop count (number) works at runtime but is missing from fastify's types
    trustProxy: env.http.trustProxy as boolean | string,
    logger:
      env.nodeEnv === 'test'
        ? false
        : { level: env.nodeEnv === 'production' ? 'info' : 'debug' },
  })
    .setValidatorCompiler(validatorCompiler)
    .setSerializerCompiler(serializerCompiler)
    .withTypeProvider<ZodTypeProvider>()

  registerErrorHandlers(app)

  await app.register(fastifyCors, { origin: env.http.cors })
  await app.register(rateLimitPlugin, { settings: limits, redis })
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: pkg.name,
        version: pkg.version,
      },
      servers: [],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
    transform: jsonSchemaTransform,
  })
  await app.register(scalarApiReference, { routePrefix: '/docs' })

  const accessTokens = createAccessTokens({
    secret: env.auth.jwtSecret,
    ttlSeconds: env.auth.accessTokenTtlSeconds,
  })
  await app.register(authPlugin, { accessTokens })

  await app.register(rootRouter, { prefix: '/', cache })
  await app.register(authRoutes, {
    prefix: '/auth',
    rateLimit: { max: limits.authMax, windowMs: limits.authWindowMs },
    auth: {
      users: repositories.users,
      refreshTokens: repositories.refreshTokens,
      accessTokens,
      verifyGoogle: createGoogleVerifier({
        clientId: env.auth.googleClientId,
        keys: auth?.googleKeys ?? googleRemoteKeys(),
      }),
      accessTokenTtlSeconds: env.auth.accessTokenTtlSeconds,
      refreshTokenTtlSeconds: env.auth.refreshTokenTtlSeconds,
      allowedEmails: auth?.allowedEmails ?? env.auth.allowedEmails,
    },
  })
  await app.register(usersRoutes, {
    prefix: '/users',
    users: repositories.users,
  })
  await app.register(todoRoutes, {
    prefix: '/todos',
    todos: repositories.todos,
  })

  await app.ready()
  return app
}
