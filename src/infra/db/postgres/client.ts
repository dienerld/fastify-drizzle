import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import type { PostgresEnv } from './env'
import * as schema from './schema'

export function createClient(env: PostgresEnv) {
  const sql = postgres(env.url)
  const db = drizzle(sql, { schema })
  return { sql, db }
}

export type PostgresDb = ReturnType<typeof createClient>['db']
