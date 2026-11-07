import type { FastifyReply } from 'fastify'
import jwt, { type SignOptions } from 'jsonwebtoken'

import { env } from '~/env'

export function registrySession(
  instance: FastifyReply,
  payload: Record<string, unknown>
) {
  const optionsSign: SignOptions = {}
  if (env.auth.jwtExpiration) {
    optionsSign.expiresIn = env.auth.jwtExpiration
  }

  try {
    const session = jwt.sign(payload, env.auth.sessionSecret, optionsSign)
    instance.header('x-user-session', session)
    // biome-ignore lint/suspicious/noExplicitAny: error type is unknown here
  } catch (e: any) {
    return instance.code(500).send({
      statusCode: 500,
      error: e.name,
      message: e.message,
    })
  }
}
