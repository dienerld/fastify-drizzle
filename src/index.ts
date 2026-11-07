import { buildApp } from '~/app'
import { env } from '~/env'
import * as cache from '~/infra/cache'
import { connect, loadEnv } from '~/infra/db'
import {
  loadCleanupConfig,
  startRefreshTokenCleanup,
} from '~/modules/auth/cleanup'

async function bootstrap() {
  const db = await connect(loadEnv())
  // Redis is optional: no REDIS_URL, no cache.
  const cacheEnv = cache.loadEnv()
  const redis = cacheEnv ? await cache.connect(cacheEnv) : undefined
  const app = await buildApp({
    repositories: db.repositories,
    cache: redis?.cache,
    redis: redis?.client,
  })

  // Housekeeping for expired/revoked refresh tokens (`pnpm tokens:cleanup`
  // does the same from an external cron).
  const cleanup = startRefreshTokenCleanup({
    refreshTokens: db.repositories.refreshTokens,
    config: loadCleanupConfig(),
    log: app.log,
  })

  let closing = false
  const shutdown = async (signal: string) => {
    if (closing) return
    closing = true
    app.log.info({ signal }, 'shutting down')
    try {
      cleanup?.stop()
      await app.close()
      await db.close()
      await redis?.close()
      process.exit(0)
    } catch (err) {
      app.log.error(err, 'error during shutdown')
      process.exit(1)
    }
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))

  await app.listen({ host: env.http.host, port: env.http.port })

  if (env.nodeEnv === 'development') {
    app.log.debug(`\n${app.printRoutes()}`)
  }
}

bootstrap().catch(err => {
  console.error(err)
  process.exit(1)
})
