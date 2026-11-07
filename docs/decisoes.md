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

## Fase 1

- **Versoes**: fastify 5.12.8, @fastify/cookie 11, cors 11, session 11, swagger 9.9.3, @scalar/fastify-api-reference 1.77, fastify-plugin 6, zod 4.6.7, fastify-type-provider-zod 7.0.0. Zod 4: `z.email()` / `z.url()` no lugar de `z.string().email()/url()`.
- **Formato unico de erro** `{ error, message, statusCode, issues? }` via um unico `setErrorHandler` + `setNotFoundHandler` (`src/utils/error-handler.ts`, que substitui `parse-zod-error.ts`). `error` e o nome HTTP do status; `issues` (`{ path, message }`) so em 400 de validacao, com `path` tipo `body.email`. No type provider 7 o `path` do issue Zod nao vem em `params`; usa-se `instancePath`.
- **500**: sempre logado com o logger do Fastify; em `production` a mensagem e generica (sem stack/mensagem interna). Erros 4xx lancados por handlers mantem status e mensagem. Erro de serializacao de resposta tambem vira 500.
- **`generate-schema-handler.ts`** virou `routeSchema({ response, status, protected, ... })`: monta o `response` map com 400/500 (e 401 se `protected`) usando o mesmo `errorResponseSchema`. Sem tags especificas do projeto; titulo do OpenAPI vem do `package.json`.
- **Docs**: Scalar em `/docs/` (`/docs` redireciona 301), spec em `/docs/openapi.json` (OpenAPI 3.0.3, default do swagger).
- **Testes de erro** usam uma app Fastify minima (`registerErrorHandlers`) com rotas de teste registradas dentro do teste, sem rota falsa no codigo de producao. O modo producao e simulado com `vi.spyOn(env, 'nodeEnv', 'get')`.
- Middlewares legados (`verify-auth`, `verify-token`, `registry-session`) ajustados para o mesmo formato; saem na Fase 3.
