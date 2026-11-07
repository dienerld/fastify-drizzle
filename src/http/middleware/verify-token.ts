import type { onRequestHookHandler } from 'fastify'

import { env } from '~/env'

/** Middleware that requires the static `x-api-key` header. */
export const verifyToken: onRequestHookHandler = async (request, reply) => {
  const authHeader = request.headers['x-api-key']
  if (!authHeader) {
    reply.code(403).send({
      error: 'Forbidden',
      message: 'No token provided',
    })
    return
  }

  if (authHeader !== env.auth.accessKey) {
    reply.code(403).send({
      error: 'Forbidden',
      message: 'Invalid Token',
    })
    return
  }
}
