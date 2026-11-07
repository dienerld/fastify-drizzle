import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import z from 'zod'

import { routeSchema } from '~/utils/generate-schema-handler'

export const rootRouter: FastifyPluginAsyncZod = async app => {
  app.get(
    '',
    {
      schema: {
        ...routeSchema({
          description: 'Get the root of the API',
          operationId: 'root',
          summary: 'Root',
          response: z.object({
            status: z.literal('ok'),
            message: z.literal('Welcome to the API'),
          }),
        }),
      },
    },
    async (_, reply) => {
      reply.send({
        status: 'ok',
        message: 'Welcome to the API',
      })
    }
  )

  app.get(
    '/health',
    {
      schema: {
        ...routeSchema({
          description: 'Health check',
          operationId: 'health',
          summary: 'Health',
          response: z.object({ status: z.literal('ok') }),
        }),
      },
    },
    async (_, reply) => {
      reply.send({ status: 'ok' })
    }
  )
}
