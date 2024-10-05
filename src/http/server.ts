import fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import fastifyCors from '@fastify/cors'
import fastifySession from '@fastify/session'
import fastifyCookie from '@fastify/cookie'
import { UserRouter } from './routes/user'
import { env } from '../env'
import { verifyToken } from './middleware/verify-token'

const app = fastify()
  .withTypeProvider<ZodTypeProvider>()
  .register(fastifyCors, { origin: env.CORS })
  .register(fastifyCookie)
  .register(fastifySession, { secret: env.SESSION_SECRET })
  .setValidatorCompiler(validatorCompiler)
  .setSerializerCompiler(serializerCompiler)
  .addHook('preHandler', verifyToken)

app.register(UserRouter)

app
  .listen({
    host: env.HOST,
    port: env.PORT,
  })
  .then(() => {
    console.log(`HTTP server running on http://${env.HOST}:${env.PORT}`)
  })
