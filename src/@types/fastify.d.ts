import 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    /** `onRequest`/`preHandler` hook: requires a valid `Authorization: Bearer <access token>`. */
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>
  }

  interface FastifyRequest {
    /** Set by `app.authenticate`; only read it on authenticated routes. */
    user: { id: string; email: string }
  }
}
