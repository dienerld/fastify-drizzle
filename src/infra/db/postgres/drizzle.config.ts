import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/infra/db/postgres/schema.ts',
  out: './src/infra/db/postgres/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
})
