import type {
  FastifyError,
  FastifyReply,
  FastifyRequest,
  onErrorAsyncHookHandler,
} from 'fastify'
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod'

export const parseZodError = (
  err: FastifyError,
  req: FastifyRequest,
  reply: FastifyReply
) => {
  if (hasZodFastifySchemaValidationErrors(err)) {
    return reply.code(400).send({
      error: 'Response Validation Error',
      message: "Request doesn't match the schema",
      statusCode: 400,
      issues: err.validation.map(issue => ({
        // @ts-expect-error - mismatch type
        path: issue.params.issue.path[0],
        message: issue.message,
      })),
    })
  }

  if (isResponseSerializationError(err)) {
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: "Response doesn't match the schema",
      statusCode: 500,
    })
  }

  return reply.code(500).send({
    error: err.name,
    message: err.message,
    statusCode: 500,
  })
}
