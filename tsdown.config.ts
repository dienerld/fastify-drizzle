import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  target: 'node24',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  fixedExtension: false,
  alias: { '~': './src' },
})
