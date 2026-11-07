import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { verifyAuth } from '~/http/middleware/verify-auth'
import { verifyToken } from '~/http/middleware/verify-token'
import { routeSchema } from '~/utils/generate-schema-handler'
import { registrySession } from '~/utils/registry-session'
import { toHttpError } from '~/utils/result'

import type { UserRepository } from './repository'
import { createUserService } from './service'

const createUserSchema = z.object({
  fullName: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  externalId: z.string(),
  picture: z.string().optional(),
})

const userResponseSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  externalId: z.string(),
  picture: z.string().nullable(),
  createdAt: z.coerce.date(),
})

export const usersRoutes: FastifyPluginAsyncZod<{
  users: UserRepository
}> = async (app, { users }) => {
  const service = createUserService(users)

  app.post(
    '',
    {
      onRequest: [verifyToken],
      schema: {
        body: createUserSchema,
        ...routeSchema({
          operationId: 'createUser',
          summary: 'Create',
          description: 'Create a new user',
          status: 201,
          tags: ['users'],
          response: z.object({
            id: z.string(),
            newUser: z.boolean(),
          }),
        }),
      },
    },
    async (request, reply) => {
      const result = await service.createOrGet(request.body)
      if (!result.ok) throw toHttpError(result.error)
      const { user, created } = result.value

      // legacy session issuing, replaced by the auth module in phase 3
      const err = registrySession(reply, { id: user.id })
      if (err) return err

      return reply
        .status(created ? 201 : 200)
        .send({ id: user.id, newUser: created })
    }
  )

  app.get(
    '/:externalId',
    {
      onRequest: [verifyAuth],
      schema: {
        params: z.object({ externalId: z.string() }),
        ...routeSchema({
          operationId: 'getUser',
          summary: 'Get By External Id',
          description: 'Get a user',
          protected: true,
          tags: ['users'],
          response: userResponseSchema,
        }),
      },
    },
    async (request, reply) => {
      const result = await service.get(request.params.externalId)
      if (!result.ok) throw toHttpError(result.error)
      return reply.status(200).send(result.value)
    }
  )
}
