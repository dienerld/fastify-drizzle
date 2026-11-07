import type { FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

import { toHttpError } from '~/utils/result'
import type { AccessTokens } from './tokens'

/**
 * Decorates the app with `authenticate` (use it as a hook) and the request
 * with `user`. Stateless: verifies the Bearer access token, no database call.
 */
export const authPlugin = fp<{ accessTokens: AccessTokens }>(
  async (app, { accessTokens }) => {
    app.decorateRequest('user', null as never)

    app.decorate('authenticate', async (request: FastifyRequest) => {
      const [scheme, token] = (request.headers.authorization ?? '').split(' ')
      if (scheme?.toLowerCase() !== 'bearer' || !token) {
        throw toHttpError({
          code: 'unauthorized',
          message: 'Missing bearer token',
        })
      }
      try {
        request.user = await accessTokens.verify(token)
      } catch {
        throw toHttpError({
          code: 'unauthorized',
          message: 'Invalid or expired token',
        })
      }
    })
  },
  { name: 'auth' }
)
