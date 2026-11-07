import type { FastifyReply, FastifyRequest } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { errorResponseSchema } from '~/utils/error-handler'
import { routeSchema } from '~/utils/generate-schema-handler'
import { toHttpError } from '~/utils/result'

import { type AuthDeps, createAuthService } from './service'
import { hashToken } from './tokens'

export type AuthRateLimit = {
  /** Requests per window, per IP, on every `/auth/*` route. */
  max: number
  windowMs: number
}

const sessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    picture: z.string().nullable(),
  }),
})

const refreshBody = z.object({ refreshToken: z.string().min(1) })

const tags = ['auth']

/**
 * These routes are public on purpose: they are where identity is proved
 * (Google ID token, or a valid refresh token). Nothing else issues tokens.
 */
export const authRoutes: FastifyPluginAsyncZod<{
  auth: AuthDeps
  rateLimit: AuthRateLimit
}> = async (app, { auth, rateLimit }) => {
  const service = createAuthService(auth)

  // Stricter than the global limit and keyed apart from it (the `auth:` prefix
  // keeps the counters separate in a shared Redis store).
  const perIp = {
    config: {
      rateLimit: {
        max: rateLimit.max,
        timeWindow: rateLimit.windowMs,
        keyGenerator: (request: { ip: string }) => `auth:${request.ip}`,
      },
    },
  }

  // refresh/logout: also limit per token, so one stolen/leaked token cannot be
  // hammered from many IPs. The key is the token HASH, never the raw token.
  // Runs in `preHandler` because the body is only parsed by then.
  const checkToken = app.createRateLimit({
    max: rateLimit.max,
    timeWindow: rateLimit.windowMs,
    keyGenerator: request => {
      const { refreshToken } = refreshBody.parse(request.body)
      return `auth-token:${hashToken(refreshToken)}`
    },
  })
  const limitPerToken = {
    preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await checkToken(request)
      if (result.isAllowed || !result.isExceeded) return
      reply.header('retry-after', result.ttlInSeconds)
      throw Object.assign(
        new Error(`Rate limit exceeded, retry in ${result.ttlInSeconds}s`),
        { statusCode: 429 }
      )
    },
  }

  const withRateLimit = <T extends ReturnType<typeof routeSchema>>(s: T) => ({
    ...s,
    response: { ...s.response, 429: errorResponseSchema },
  })

  const withAuthErrors = <T extends ReturnType<typeof routeSchema>>(s: T) => ({
    ...s,
    response: {
      ...s.response,
      401: errorResponseSchema,
      403: errorResponseSchema,
      429: errorResponseSchema,
    },
  })

  app.post(
    '/google',
    {
      ...perIp,
      schema: {
        body: z.object({ idToken: z.string().min(1) }),
        ...withAuthErrors(
          routeSchema({
            operationId: 'loginWithGoogle',
            summary: 'Login with Google',
            description:
              'Exchanges a Google ID token for an access token and a refresh token. Creates the user on first login. 403 when `ALLOWED_EMAILS` is set and the email is not in it.',
            tags,
            response: sessionSchema,
          })
        ),
      },
    },
    async request => {
      const result = await service.loginWithGoogle(request.body.idToken)
      if (!result.ok) throw toHttpError(result.error)
      return result.value
    }
  )

  app.post(
    '/refresh',
    {
      ...perIp,
      ...limitPerToken,
      schema: {
        body: refreshBody,
        ...withAuthErrors(
          routeSchema({
            operationId: 'refreshSession',
            summary: 'Refresh',
            description:
              'Rotates the refresh token: the old one stops working. Reusing an already rotated token revokes the whole session (token family).',
            tags,
            response: sessionSchema,
          })
        ),
      },
    },
    async request => {
      const result = await service.refresh(request.body.refreshToken)
      if (!result.ok) throw toHttpError(result.error)
      return result.value
    }
  )

  app.post(
    '/logout',
    {
      ...perIp,
      ...limitPerToken,
      schema: {
        body: refreshBody,
        ...withRateLimit(
          routeSchema({
            operationId: 'logout',
            summary: 'Logout',
            description:
              'Revokes the session of the given refresh token. Always 204.',
            status: 204,
            tags,
            response: z.null(),
          })
        ),
      },
    },
    async (request, reply) => {
      await service.logout(request.body.refreshToken)
      return reply.status(204).send(null)
    }
  )
}
