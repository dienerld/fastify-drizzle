import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { errorResponseSchema } from '~/utils/error-handler'
import { routeSchema } from '~/utils/generate-schema-handler'
import { toHttpError } from '~/utils/result'

import { type AuthDeps, createAuthService } from './service'

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
}> = async (app, { auth }) => {
  const service = createAuthService(auth)

  const withAuthErrors = <T extends ReturnType<typeof routeSchema>>(s: T) => ({
    ...s,
    response: {
      ...s.response,
      401: errorResponseSchema,
      403: errorResponseSchema,
    },
  })

  app.post(
    '/google',
    {
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
      schema: {
        body: refreshBody,
        ...routeSchema({
          operationId: 'logout',
          summary: 'Logout',
          description:
            'Revokes the session of the given refresh token. Always 204.',
          status: 204,
          tags,
          response: z.null(),
        }),
      },
    },
    async (request, reply) => {
      await service.logout(request.body.refreshToken)
      return reply.status(204).send(null)
    }
  )
}
