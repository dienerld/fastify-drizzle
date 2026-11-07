import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    // `node dist/migrate.js`: applies the SQL migrations in the production image
    migrate: 'src/infra/db/postgres/migrate.ts',
  },
  // migrate.ts reads its SQL from ./migrations next to the bundle
  copy: [{ from: 'src/infra/db/postgres/migrations', to: 'dist' }],
  format: 'esm',
  target: 'node24',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  fixedExtension: false,
  alias: { '~': './src' },
})
