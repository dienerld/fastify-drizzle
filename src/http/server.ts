import fastify from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import fastifyCors from '@fastify/cors'
import fastifySession from '@fastify/session'
import fastifyCookie from '@fastify/cookie'
import fastifySwagger from '@fastify/swagger'
import { env } from '@env'
import { userRouter } from './routes/user'
import { verifyToken } from './middleware/verify-token'
import { parseZodError } from '~/utils/parse-zod-error'

const app = fastify()
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
    },
    transform: jsonSchemaTransform,
  })
  .register(require('@scalar/fastify-api-reference'), {
    routePrefix: '/docs',
  })
  .setErrorHandler(parseZodError)
  // Tem que ser /docs/* para que o scalar consiga fazer suas chamadas
  .addHook('onRequest', verifyToken(['/docs/*', '/']))

app.get('/', async (req, reply) => {
  reply.send({
    status: 'ok',
    message: 'Welcome to the API',
  })
})

app.register(userRouter, { prefix: '/users' })

app.listen({ host: env.HOST, port: env.PORT }).then(() => {
  console.log(`HTTP server running on http://${env.HOST}:${env.PORT}`)
})
