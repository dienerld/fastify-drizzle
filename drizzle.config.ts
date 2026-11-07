import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schemas',
  out: './src/db/_migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
})
