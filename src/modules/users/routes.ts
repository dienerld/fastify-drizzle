import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { routeSchema } from '~/utils/generate-schema-handler'
import { toHttpError } from '~/utils/result'

import type { UserRepository } from './repository'
import { createUserService } from './service'

const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  picture: z.string().nullable(),
  createdAt: z.coerce.date(),
})

export const usersRoutes: FastifyPluginAsyncZod<{
  users: UserRepository
}> = async (app, { users }) => {
  // Every route of this plugin requires a valid access token. Users are
  // created by the auth flow (`POST /auth/google`), never by a public route.
  app.addHook('onRequest', app.authenticate)

  const service = createUserService(users)

  app.get(
    '/me',
    {
      schema: routeSchema({
        operationId: 'getMe',
        summary: 'Me',
        description: 'The authenticated user',
        protected: true,
        notFound: true,
        tags: ['users'],
        response: userResponseSchema,
      }),
    },
    async request => {
      const result = await service.me(request.user.id)
      if (!result.ok) throw toHttpError(result.error)
      return result.value
    }
  )
}
