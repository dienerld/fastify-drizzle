import type { onRequestHookHandler } from 'fastify'
import { TokenExpiredError } from 'jsonwebtoken'
import { verifyGoogleToken } from '~/utils/auth-google'

export const verifyToken: onRequestHookHandler = async (request, reply) => {
  try {
    const authHeader = request.headers.authorization
    if (!authHeader) {
      reply.code(401).send({ error: 'No token provided' })
      return
    }

    const token = authHeader.split(' ')[1] // Assume "Bearer TOKEN"
    const userId = await verifyGoogleToken(token)

    if (!userId) {
      reply.code(401).send({ error: 'Invalid token' })
      return
    }

    request.session.userId = userId
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return reply.code(401).send({ error: 'Token expired' })
    }

    console.error('Error in preHandler hook:', error)
    reply.code(500).send({ error: 'Internal server error' })
    return
  }
}
