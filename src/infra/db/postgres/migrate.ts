import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

import { loadEnv, type PostgresEnv } from './env'

export const migrationsFolder = fileURLToPath(
  new URL('./migrations', import.meta.url)
)

export async function runMigrations(env: PostgresEnv) {
  const sql = postgres(env.url, { max: 1, onnotice: () => {} })
  try {
    await migrate(drizzle(sql), { migrationsFolder })
  } finally {
    await sql.end({ timeout: 5 })
  }
}

// `pnpm db:migrate`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runMigrations(loadEnv())
  console.log('postgres: migrations applied')
}
