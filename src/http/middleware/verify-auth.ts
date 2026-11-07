import type { onRequestHookHandler } from 'fastify'
import jwt from 'jsonwebtoken'

const { JsonWebTokenError, TokenExpiredError, verify } = jwt

import { env } from '~/env'

export const verifyAuth: onRequestHookHandler = async (request, reply) => {
  const userSession = request.headers['x-user-session'] as string
  try {
    const session = verify(userSession, env.auth.sessionSecret) as unknown as {
      id: string
    }
    if (!session) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'No session provided',
        statusCode: 401,
      })
      return
    }
    request.session.set('user_id', session.id)
    request.session.save()
    return
  } catch (e) {
    if (e instanceof JsonWebTokenError) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'No user id provided',
        statusCode: 401,
      })
    }
    if (e instanceof TokenExpiredError) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Token expired',
        statusCode: 401,
      })
    }

    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid token',
      statusCode: 401,
    })
  }
}
