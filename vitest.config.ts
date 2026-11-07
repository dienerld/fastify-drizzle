import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      SESSION_SECRET: 'test-secret-with-at-least-32-characters!!',
      ACCESS_KEY: 'test-access-key',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/test',
    },
  },
})
