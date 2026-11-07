import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const alias = { '~': fileURLToPath(new URL('./src', import.meta.url)) }

const baseEnv = {
  NODE_ENV: 'test',
  SESSION_SECRET: 'test-secret-with-at-least-32-characters!!',
  ACCESS_KEY: 'test-access-key',
}

// DB tests always target the `*_test` databases (never the dev one), even when
// DATABASE_URL / MONGODB_URI are exported in the shell. Set during config load
// so global setup (main process) and workers see the same values.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://docker:docker@localhost:5433/app_test'
process.env.MONGODB_URI =
  process.env.TEST_MONGODB_URI ?? 'mongodb://localhost:27018/?replicaSet=rs0'
process.env.MONGODB_DB = 'app_test'

// Three projects, selected by file name (see docs/decisoes.md):
//   unit     everything that does not need a database
//   postgres *.postgres.test.ts (real Postgres, `pnpm db:up:postgres`)
//   mongo    *.mongo.test.ts    (real MongoDB,  `pnpm db:up:mongo`)
// Tests use their own databases (`*_test`), never the dev one.
export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.{postgres,mongo}.test.ts'],
          env: baseEnv,
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'postgres',
          include: ['src/**/*.postgres.test.ts'],
          globalSetup: ['src/test/global-setup.postgres.ts'],
          fileParallelism: false,
          env: baseEnv,
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'mongo',
          include: ['src/**/*.mongo.test.ts'],
          fileParallelism: false,
          env: baseEnv,
        },
      },
    ],
  },
})
