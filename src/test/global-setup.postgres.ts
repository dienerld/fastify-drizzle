import postgres from 'postgres'

import { loadEnv } from '~/infra/db/postgres/env'
import { runMigrations } from '~/infra/db/postgres/migrate'

/** Creates the test database when missing, then applies migrations. */
export default async function setup() {
  const env = loadEnv()
  const url = new URL(env.url)
  const dbName = url.pathname.slice(1)
  url.pathname = '/postgres'
  const admin = postgres(url.toString(), { max: 1, onnotice: () => {} })
  try {
    const found =
      await admin`select 1 from pg_database where datname = ${dbName}`
    if (found.length === 0) await admin.unsafe(`create database "${dbName}"`)
  } finally {
    await admin.end({ timeout: 5 })
  }
  await runMigrations(env)
}
