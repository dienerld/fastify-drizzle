import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import z from 'zod'

import { generateResponseSchemaHandler } from '~/utils/generate-schema-handler'

export const rootRouter: FastifyPluginAsyncZod = async app => {
  app.get(
    '',
    {
      schema: {
        ...generateResponseSchemaHandler({
          description: 'Get the root of the API',
          tags: ['Root'],
          operationId: 'root',
          summary: 'Root',
          isPublic: true,
          codeResponseSuccess: 200,
          schemaResponseSuccess: z.object({
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
}
