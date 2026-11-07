import { STATUS_CODES } from 'node:http'
import type { FastifyError, FastifyInstance } from 'fastify'
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod'
import { z } from 'zod'

import { env } from '~/env'

/** The one error body returned by the whole API. */
export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
  issues: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional(),
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>

const INTERNAL_MESSAGE = 'Internal Server Error'

function statusName(statusCode: number) {
  return STATUS_CODES[statusCode] ?? 'Error'
}

/** Registers the single error handler and the 404 handler on `app`. */
export function registerErrorHandlers(app: FastifyInstance) {
  app.setNotFoundHandler((req, reply) => {
    const body: ErrorResponse = {
      error: statusName(404),
      message: `Route ${req.method}:${req.url} not found`,
      statusCode: 404,
    }
    return reply.code(404).send(body)
  })

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      const body: ErrorResponse = {
        error: statusName(400),
        message: "Request doesn't match the schema",
        statusCode: 400,
        issues: err.validation.map(issue => ({
          path: [err.validationContext, ...issue.instancePath.split('/')]
            .filter(Boolean)
            .join('.'),
          message: issue.message ?? 'Invalid value',
        })),
      }
      return reply.code(400).send(body)
    }

    const statusCode =
      !isResponseSerializationError(err) &&
      err.statusCode &&
      err.statusCode >= 400 &&
      err.statusCode < 500
        ? err.statusCode
        : 500

    if (statusCode >= 500) {
      // log the real error; never send it to the client in production
      req.log.error(err)
      const body: ErrorResponse = {
        error: statusName(500),
        message: env.nodeEnv === 'production' ? INTERNAL_MESSAGE : err.message,
        statusCode: 500,
      }
      return reply.code(500).send(body)
    }

    const body: ErrorResponse = {
      error: statusName(statusCode),
      message: err.message,
      statusCode,
    }
    return reply.code(statusCode).send(body)
  })
}
