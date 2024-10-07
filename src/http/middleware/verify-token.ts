import type { onRequestHookHandler } from 'fastify'
import { TokenExpiredError } from 'jsonwebtoken'
import { verifyGoogleToken } from '~/utils/auth-google'

function isRouteAllowed(allowedRoute: string, currentRoute: string) {
  const currentRouteWithoutEndSlash = currentRoute.replace(/\/$/, '')

  // Verifica se a rota liberada é um wildcard
  if (allowedRoute.endsWith('*')) {
    const baseRoute = allowedRoute.slice(0, -1) // Remove o wildcard
    return currentRoute.startsWith(baseRoute) // Verifica se a rota atual começa com a baseRoute
  }

  // Para casos em que não é um wildcard
  return allowedRoute === currentRouteWithoutEndSlash
}

/**
 * Middleware to verify the token
 * @param publicPaths - Array of public paths
 * @returns onRequestHookHandler
 * @example
 * app.addHook('onRequest', verifyToken(['/public-path']))
 * app.addHook('onRequest', verifyToken(['/public-path', '/another-public-path', '/public/*]))
 */

export const verifyToken = (publicPaths?: string[]): onRequestHookHandler => {
  return async (request, reply) => {
    if (publicPaths?.some(path => isRouteAllowed(path, request.url))) {
      return
    }

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
}
