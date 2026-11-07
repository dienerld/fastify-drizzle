import { buildApp } from '~/app'
import { env } from '~/env'
import { connect, loadEnv } from '~/infra/db'

async function bootstrap() {
  const db = await connect(loadEnv())
  const app = await buildApp({ repositories: db.repositories })

  let closing = false
  const shutdown = async (signal: string) => {
    if (closing) return
    closing = true
    app.log.info({ signal }, 'shutting down')
    try {
      await app.close()
      await db.close()
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
