import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { verifyAuth } from '~/http/middleware/verify-auth'
import { verifyToken } from '~/http/middleware/verify-token'
import { routeSchema } from '~/utils/generate-schema-handler'
import { registrySession } from '~/utils/registry-session'

import { createUser } from './functions/create-user'
import { getUser, userResponseSchema } from './functions/get-user'

const createUserSchema = z.object({
  fullName: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  externalId: z.string(),
  picture: z.string().optional(),
})

export const routes: FastifyPluginAsyncZod = async app => {
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
          response: z.object({
            id: z.string(),
            newUser: z.boolean(),
          }),
        }),
      },
    },
    async (request, reply) => {
      const { fullName, firstName, externalId, email, lastName, picture } =
        request.body

      const response = await createUser({
        fullName,
        firstName,
        lastName,
        email,
        externalId,
        picture,
      })

      const err = registrySession(reply, { id: response.id })
      if (err) return err

      return reply.status(response.newUser ? 201 : 200).send(response)
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
          response: userResponseSchema,
        }),
      },
    },
    async (request, reply) => {
      const { externalId } = request.params

      const response = await getUser(externalId || request.session.user_id)

      return reply.status(200).send(response)
    }
  )
}
