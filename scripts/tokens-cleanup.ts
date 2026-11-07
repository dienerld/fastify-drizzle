// `pnpm tokens:cleanup`: one cleanup pass, for an external cron/scheduler
// (instead of, or in addition to, the in-process timer). Reads `.env`.
import { connect, loadEnv } from '~/infra/db'
import { cleanupRefreshTokens } from '~/modules/auth/cleanup'

const db = await connect(loadEnv())
try {
  const deleted = await cleanupRefreshTokens(db.repositories.refreshTokens)
  console.log(`refresh tokens deleted: ${deleted}`)
} finally {
  await db.close()
}
