import { sql } from 'drizzle-orm'

import { connect } from '~/infra/db/postgres'
import { createClient } from '~/infra/db/postgres/client'
import { loadEnv } from '~/infra/db/postgres/env'

/** Connects to the test database and empties every table. */
export async function emptyPostgres() {
  const env = loadEnv()
  const { db, sql: client } = createClient(env)
  try {
    await db.execute(sql`truncate table todos, users restart identity cascade`)
  } finally {
    await client.end({ timeout: 5 })
  }
  return connect(env)
}
