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
import { env } from '~/env'
import { rootRouter } from '~/http/routes/root'
import type { Repositories } from '~/infra/repositories'
import { todoRoutes } from '~/modules/todo/routes'
import { usersRoutes } from '~/modules/users/routes'
import { registerErrorHandlers } from '~/utils/error-handler'
import pkg from '../package.json' with { type: 'json' }

/** Composition root: everything the app needs from outside comes in here. */
export type AppDeps = { repositories: Repositories }

export async function buildApp({ repositories }: AppDeps) {
  const app = fastify({
    logger:
      env.nodeEnv === 'test'
        ? false
        : { level: env.nodeEnv === 'production' ? 'info' : 'debug' },
  })
    .setValidatorCompiler(validatorCompiler)
    .setSerializerCompiler(serializerCompiler)
    .withTypeProvider<ZodTypeProvider>()

  registerErrorHandlers(app)

  await app.register(fastifyCors, { origin: env.http.cors })
  await app.register(fastifyCookie)
  await app.register(fastifySession, { secret: env.auth.sessionSecret })
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: pkg.name,
        version: pkg.version,
      },
      servers: [],
    },
    transform: jsonSchemaTransform,
  })
  await app.register(scalarApiReference, { routePrefix: '/docs' })

  await app.register(rootRouter, { prefix: '/' })
  await app.register(usersRoutes, {
    prefix: '/users',
    users: repositories.users,
  })
  await app.register(todoRoutes, {
    prefix: '/todos',
    todos: repositories.todos,
  })

  await app.ready()
  return app
}
