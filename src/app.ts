import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import fastifySession from '@fastify/session'
import fastifySwagger from '@fastify/swagger'
import scalarApiReference from '@scalar/fastify-api-reference'
import fastify from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'

import { client } from '~/db'
import { env } from '~/env'
import { rootRouter } from '~/http/routes/root'
import usersModule from '~/modules/users'
import { parseZodError } from '~/utils/parse-zod-error'

export async function buildApp() {
  const app = fastify({
    logger:
      env.nodeEnv === 'test'
        ? false
        : { level: env.nodeEnv === 'production' ? 'info' : 'debug' },
  })
    .setValidatorCompiler(validatorCompiler)
    .setSerializerCompiler(serializerCompiler)
    .withTypeProvider<ZodTypeProvider>()

  app.setErrorHandler(parseZodError)

  await app.register(fastifyCors, { origin: env.http.cors })
  await app.register(fastifyCookie)
  await app.register(fastifySession, { secret: env.auth.sessionSecret })
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Fastify API Template',
        description: 'Backend service with Fastify',
        version: '1.0.0',
      },
      servers: [],
      tags: [
        { name: 'Root', description: 'Operations about root' },
        { name: 'User', description: 'Operations about users' },
      ],
    },
    transform: jsonSchemaTransform,
  })
  await app.register(scalarApiReference, { routePrefix: '/docs' })

  await app.register(rootRouter, { prefix: '/' })
  await app.register(usersModule)

  app.addHook('onClose', async () => {
    await client.end({ timeout: 5 })
  })

  await app.ready()
  return app
}
