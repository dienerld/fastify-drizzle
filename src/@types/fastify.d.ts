// fastify-session.d.ts
import 'fastify'
import '@fastify/session'

declare module 'fastify' {
  interface Session {
    user_id: string
    refresh_token: string
  }
}
