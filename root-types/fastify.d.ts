// fastify-session.d.ts
import 'fastify'
import '@fastify/session'

declare module 'fastify' {
  interface Session {
    userId: string

  }
}
