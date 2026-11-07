# Decisoes

## Fase 0

- **TypeScript 7.0.2 mantido.** `tsc --noEmit`, tsx, vitest 5 e tsdown funcionam. O TS 7 removeu `baseUrl`, entao o alias `~/*` usa so `paths`. O build nao gera `.d.ts` (e uma API, nao uma lib).
- **tsconfig com `module: esnext` + `moduleResolution: bundler`**, pois o codigo e empacotado pelo tsdown e imports relativos/alias ficam sem extensao.
- **Sem `@fastify/autoload`.** O bundle unico (`src/index.ts` -> `dist/index.js`) nao tem a pasta `modules/` em runtime; os modulos agora sao registrados explicitamente em `buildApp()`. Dependencia removida.
- **tsdown com `fixedExtension: false`** para emitir `dist/index.js` (o padrao seria `.mjs`), mantendo `node dist/index.js`.
- **pnpm 12.18.0** fixado em `packageManager` (sem hash). pnpm 12 bloqueia scripts de build: `pnpm-workspace.yaml` usa `allowBuilds: { esbuild: true }` (o antigo `onlyBuiltDependencies` nao e mais respeitado). O tsdown pede aprovacao de "agent skills" no install; nao e necessario.
- **`env.ts`**: validado no import (falha com mensagem clara e `process.exit(1)`), agrupado em `http`, `auth`, `db`. `REDIS_URL` virou opcional (so o `Cache` legado usa; sai na Fase 3). `SESSION_SECRET` exige 32+ caracteres (exigencia do `@fastify/session`). Nos testes as variaveis vem de `vitest.config.ts`.
- **`jsonwebtoken` e CJS**: importado pelo default export, pois o bundle ESM nao resolve named exports.
- `.tool-versions`: `nodejs 24.21.0` (asdf nao resolve `24` sem patch).
