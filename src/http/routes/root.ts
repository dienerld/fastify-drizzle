import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import z from 'zod'
import type { Cache } from '~/infra/cache'

import { routeSchema } from '~/utils/generate-schema-handler'

const healthSchema = z.object({
  status: z.enum(['ok', 'error']),
  /** Only present when a cache is configured. */
  cache: z.enum(['ok', 'down']).optional(),
})

export const rootRouter: FastifyPluginAsyncZod<{ cache?: Cache }> = async (
  app,
  { cache }
) => {
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

  // 200 {status:'ok'} while healthy. When a cache is configured it is part of
  // readiness: if it does not answer, 503 {status:'error', cache:'down'}.
  const health = routeSchema({
    description:
      'Health check. 503 when a configured cache (Redis) is not answering.',
    operationId: 'health',
    summary: 'Health',
    response: healthSchema,
  })
  app.get(
    '/health',
    {
      // probes call this often: never rate limited
      config: { rateLimit: false },
      schema: {
        ...health,
        response: { ...health.response, 503: healthSchema },
      },
    },
    async (_, reply) => {
      if (!cache) return reply.send({ status: 'ok' })
      const up = await cache.ping()
      return reply
        .code(up ? 200 : 503)
        .send({ status: up ? 'ok' : 'error', cache: up ? 'ok' : 'down' })
    }
  )
}
