import type { FastifyReply } from 'fastify'
import { type SignOptions, sign as jwtSign } from 'jsonwebtoken'

import { env } from '~/env'

export function registrySession(
  instance: FastifyReply,
  payload: Record<string, unknown>
) {
  const optionsSign: SignOptions = {}
  if (env.JWT_EXPIRATION) {
    optionsSign.expiresIn = env.JWT_EXPIRATION
  }

  try {
    const session = jwtSign(payload, env.SESSION_SECRET, optionsSign)
    instance.header('x-user-session', session)
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  } catch (e: any) {
    return instance.code(500).send({
      statusCode: 500,
      error: e.name,
      message: e.message,
    })
  }
}
