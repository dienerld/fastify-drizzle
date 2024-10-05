import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { createUser } from '../../functions/create-user'
import { getUser } from '../../functions/get-user'

export const UserRouter: FastifyPluginAsyncZod = async app => {
  app.post(
    '/users',
    {
      schema: {
        body: z.object({
          fullName: z.string(),
          firstName: z.string(),
          lastName: z.string(),
          email: z.string().email(),
          externalId: z.string(),
          picture: z.string().optional(),
        }),
      },
    },
    async request => {
      const { fullName, firstName, externalId, email, lastName,picture } = request.body

      await createUser({
        fullName,
        firstName,
        lastName,
        email,
        externalId,
        picture,
      })
    }
  )

  app.get(
    '/users/:externalId',
    { schema: { params: z.object({ externalId: z.string() }) } },
    async (request, reply) => {
      const { externalId } = request.params
      const { authorization } = request.headers
      const response = await getUser(externalId)

      return reply.status(200).send(response)
    }
  )
}
