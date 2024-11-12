import { join } from 'node:path'
import fastifyAutoload, { type AutoloadPluginOptions } from '@fastify/autoload'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import fastifySession from '@fastify/session'
import fastifySwagger from '@fastify/swagger'
import fastify, { type FastifyServerOptions } from 'fastify'
import {
  type ZodTypeProvider,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'

import { env } from '@env'
import { parseZodError } from '~/utils/parse-zod-error'

import { rootRouter } from './http/routes/root'

export interface AppOptions
  extends FastifyServerOptions,
    Partial<AutoloadPluginOptions> {}
// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {}

export const fastifyInstance = fastify()
  .setValidatorCompiler(validatorCompiler)
  .setSerializerCompiler(serializerCompiler)
  .withTypeProvider<ZodTypeProvider>()
  .register(fastifyCors, { origin: env.CORS })
  .register(fastifyCookie)
  .register(fastifySession, { secret: env.SESSION_SECRET })
  .register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Sample API',
        description: 'Sample backend service with Fastify',
        version: '1.0.0',
      },
      servers: [],
      tags: [
        { name: 'Root', description: 'Operations about root' },
        { name: 'Animal', description: 'Operations about animals' },
        { name: 'User', description: 'Operations about users' },
        { name: 'Production', description: 'Operations about productions' },
      ],
    },
    transform: jsonSchemaTransform,
  })
  .register(require('@scalar/fastify-api-reference'), {
    routePrefix: '/docs',
  })
  .setErrorHandler(parseZodError)

fastifyInstance.register(rootRouter, { prefix: '/' })

// This loads all plugins defined in plugins
// those should be support plugins that are reused
// through your application
// void app.register(fastifyAutoload, {
//   dir: join(__dirname, 'plugins'),
//   options: opts,
// })
void fastifyInstance.register(fastifyAutoload, {
  dir: join(__dirname, 'modules'),
  maxDepth: 1,
})
