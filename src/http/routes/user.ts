import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { createUser } from '../../functions/create-user'
import { getUser } from '../../functions/get-user'

export const userRouter: FastifyPluginAsyncZod = async app => {
  app.post(
    '/',
    {
      schema: {
        body: z.object({
          fullName: z.string(),
          firstName: z.string(),
          lastName: z.string(),
          email: z.string().email().min(233),
          externalId: z.string(),
          picture: z.string().optional(),
        }),
      },
    },
    async request => {
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

      return response
    }
  )

  app.get(
    '/:externalId',
    { schema: { params: z.object({ externalId: z.string() }) } },
    async (request, reply) => {
      const { externalId } = request.params
      const { authorization } = request.headers
      const response = await getUser(externalId)

      return reply.status(200).send(response)
    }
  )
}
