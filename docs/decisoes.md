# Decisões

Por que o template é como é, organizado por tema. A história por fase está no `ROADMAP.md`; aqui fica o motivo de cada escolha. No fim, as **checklists que alimentam o README** (Fase 5).

## Sumário

1. [Ferramentas e build](#1-ferramentas-e-build)
2. [HTTP, erros e documentação](#2-http-erros-e-documentação)
3. [Módulos e camadas](#3-módulos-e-camadas)
4. [Bancos lado a lado](#4-bancos-lado-a-lado)
5. [Autenticação](#5-autenticação)
6. [Redis (cache opcional)](#6-redis-cache-opcional)
7. [Testes](#7-testes)
8. [Fronteiras automáticas e preparo para agentes](#8-fronteiras-automáticas-e-preparo-para-agentes)
9. [Ambiente desta máquina](#9-ambiente-desta-máquina)
10. [Em aberto](#10-em-aberto)
11. [Checklists para o README (Fase 5)](#11-checklists-para-o-readme-fase-5)

## 1. Ferramentas e build

- **Versões: sempre a última estável** (`pnpm add <pkg>@latest`). Referência atual: TypeScript 7.0.2, Fastify 5.12.8, Zod 4.6.7, fastify-type-provider-zod 7.0.0, @fastify/swagger 9.9.3, @scalar/fastify-api-reference 1.77, fastify-plugin 6, drizzle-orm 0.45.4, drizzle-kit 0.31.11, postgres 4.1.0, mongoose 9.12.0, jose 6.2.15, ioredis 6.0.0, Biome 2.6.6, vitest 5.1, husky 9.1.7, lint-staged 17.6, commitlint 21.2, dependency-cruiser 18.7.
- **TypeScript 7 mantido.** `tsc --noEmit`, tsx, vitest 5 e tsdown funcionam. O TS 7 removeu `baseUrl`; o alias `~/*` usa só `paths`. O build não gera `.d.ts` (é uma API, não uma lib).
- **`module: esnext` + `moduleResolution: bundler`**: o código é empacotado pelo tsdown, então imports relativos/alias ficam sem extensão. tsdown com `fixedExtension: false` emite `dist/index.js` (o padrão seria `.mjs`), mantendo `node dist/index.js`.
- **Sem `@fastify/autoload`**: o bundle único (`src/index.ts` → `dist/index.js`) não tem `modules/` em runtime; os módulos são registrados explicitamente em `buildApp()`.
- **pnpm 12.18.0** fixado em `packageManager` (sem hash). pnpm 12 bloqueia scripts de build: `pnpm-workspace.yaml` usa `allowBuilds` (o antigo `onlyBuiltDependencies` não vale mais). `esbuild: true`; `@swc/core: false` (marcado como revisado e negado; o binário vem como dependência opcional, não precisa do postinstall). O husky roda pelo `prepare` sem precisar de aprovação. O tsdown pede aprovação de "agent skills" no install; não é necessário.
- **`env.ts`** valida no import (falha com mensagem clara e `process.exit(1)`), só com variáveis de `http` e `auth`. Cada banco e o cache têm seu próprio `env.ts` com `loadEnv()`, chamado em `src/index.ts`. Nos testes as variáveis vêm de `vitest.config.ts`. Segredos de sessão/cookie sumiram com a auth stateless.
- `.tool-versions`: `nodejs 24.21.0` (asdf não resolve `24` sem patch).

## 2. HTTP, erros e documentação

- **Formato único de erro** `{ error, message, statusCode, issues? }` via um só `setErrorHandler` + `setNotFoundHandler` (`src/utils/error-handler.ts`). `error` é o nome HTTP do status; `issues` (`{ path, message }`) só em 400 de validação, com `path` tipo `body.email`. No type provider 7 o `path` do issue Zod não vem em `params`; usa-se `instancePath`.
- **500**: sempre logado pelo logger do Fastify; em `production` a mensagem é genérica (sem stack). Erros 4xx lançados por handlers mantêm status e mensagem. Erro de serialização de resposta também vira 500.
- **`routeSchema({ response, status, protected, notFound, ... })`** (`generate-schema-handler.ts`) monta o mapa de respostas com 400/500 (401 se `protected`, 404 se `notFound`) com o mesmo `errorResponseSchema`. `protected: true` também documenta `security: [{ bearerAuth: [] }]`. O título do OpenAPI vem do `package.json`.
- **Docs**: Scalar em `/docs/` (`/docs` redireciona 301), spec em `/docs/openapi.json` (OpenAPI 3.0.3, padrão do swagger). O esquema `bearerAuth` é registrado no swagger em `app.ts`.
- **Testes de erro** usam uma app Fastify mínima (`registerErrorHandlers`) com rotas registradas no próprio teste, sem rota falsa no código de produção. O modo produção é simulado com `vi.spyOn(env, 'nodeEnv', 'get')`.
- **`/health`**: sem cache → `200 { status: 'ok' }`. Com cache → `200 { status: 'ok', cache: 'ok' }` se o `ping` responde; `503 { status: 'error', cache: 'down' }` se não (o cache entra na prontidão: um orquestrador tira a instância do tráfego). Para continuar "healthy" sem o Redis, trocar o 503 por 200 em `src/http/routes/root.ts`.

## 3. Módulos e camadas

- **Camadas**: `routes.ts` (HTTP fino; recebe o repositório como opção do plugin) → `service.ts` (retorna `Result`, `src/utils/result.ts`; `not_found`/`conflict`/`unauthorized`/`forbidden` viram 404/409/401/403 via `toHttpError` e passam pelo handler único) → `repository.ts` (interface + tipos de domínio).
- **Abstração do banco é por módulo**: a interface tem os métodos que o módulo usa e os models são nativos de cada banco. Sem "repositório genérico" nem schema único escondendo SQL vs documentos.
- **Raiz de composição**: `buildApp({ repositories, cache?, auth? })` passa cada repositório como opção do plugin de rotas (sem `decorate`; tipado e explícito). `src/index.ts` faz `connect(loadEnv())`, injeta e fecha o banco no shutdown. Testes HTTP sem banco usam `noRepositories` (`src/test/no-repositories.ts`): proxies que falham alto se algum repositório for usado. Não há adaptador em memória.
- **IDs malformados** nos adaptadores retornam `null`/`false` (viram 404), nunca erro de banco.
- **Ownership**: dado de usuário filtra **sempre** por `userId` no repositório; recurso alheio é indistinguível de inexistente (404), `userId` malformado enxerga nada, `userId` no body é ignorado (vem do token).
- **Módulo não importa o interior de outro** (decisão da Fase 4). Permitido: `repository.ts` de outro módulo (só tipos) e, em `schema.<banco>.ts`, o `schema.<banco>.ts` de outro módulo (chave estrangeira). Exemplos hoje: `auth/service.ts` usa tipos de `users/repository.ts`; `todo` e `auth` referenciam `users` nos schemas. Dependência de comportamento entre módulos entra por parâmetro (interface), vinda da raiz de composição.
- **`users`**: modelo `{ id, email, name, googleSub, picture, createdAt }`. Repositório: `findById` + `upsertByGoogleSub` (Postgres `onConflictDoUpdate`; Mongo `findOneAndUpdate` com `upsert` e um retry no erro 11000 de corrida no índice único). Usuários nascem no fluxo de auth; **resta só `GET /users/me`**, que usa `request.user.id` e nunca um id vindo do cliente.
- **`todo`**: CRUD completo (`GET/POST /todos`, `GET/PATCH/DELETE /todos/:id`), por usuário (`userId` em `todos`). É o modelo do gerador de módulos.

## 4. Bancos lado a lado

- **Mongoose em vez do driver `mongodb`** (decisão do dono, por maturidade e familiaridade; Papr descartado). `schema.mongo.ts` guarda o `Schema` (campos, validação, índices, `timestamps`) e o model; o validador `$jsonSchema` foi dispensado. O adaptador usa o model com `.lean()` e mapeia para o tipo de domínio (`id` string vindo de `_id`); nenhum documento ou `ObjectId` sai do adaptador.
- **Conexão dedicada** (`mongoose.createConnection`, não o `connect` global), com `autoIndex`/`autoCreate` desligados: `connect()` cria as coleções e roda `syncIndexes()` no boot (idempotente; também remove índices tirados do schema). `pnpm db:indexes` faz o mesmo isoladamente. Models criados sob demanda na conexão (`userModel(conn)`), agregados em `src/infra/db/mongo/models.ts`.
- **Estrutura**: `src/infra/db/{postgres,mongo}/` com `env.ts` (`DATABASE_URL`; `MONGODB_URI`, `MONGODB_DB`), `connect.ts` e `index.ts` (`connect`, `loadEnv`). **`src/infra/db/index.ts` é o único ponto de escolha** (re-export de `./postgres`). Ninguém mais importa `infra/db/postgres|mongo` além dos adaptadores `*.postgres.ts`/`*.mongo.ts` e dos testes (`src/test/db.*.ts` incluídos). Imposto pelo `lint:deps`.
- **Convenção de nomes** (`*.postgres.ts`, `*.mongo.ts`, `*.<banco>.test.ts`, pastas `src/infra/db/<banco>/`) existe para que remover o banco descartado seja **manual e mecânico**. Decisão do dono: **sem script de seleção**; o passo a passo fica no README.
- **Postgres**: agregador de tabelas `src/infra/db/postgres/schema.ts` (importa os `schema.postgres.ts`); `drizzle.config.ts` e `migrations/` ficam em `src/infra/db/postgres/`. `pnpm db:migrate` roda o migrator do drizzle (`migrate.ts`, via tsx e `.env`) em vez do `drizzle-kit migrate`, para o mesmo código servir aos testes. Ids `uuid` com `defaultRandom()`; `todos` e `refresh_tokens` têm FK `ON DELETE CASCADE` para `users`. Migração regenerada do zero (`0000_*.sql`: `users`, `todos`, `refresh_tokens`) por ser template sem dados; quem tem banco de teste antigo precisa dropar `app_test` uma vez.
- **Mongo**: ids `ObjectId`, índice `{ userId, createdAt }` nos dados de usuário. **Transações exigem replica set**; o compose já sobe um de 1 nó.
- **Compose**: perfis `postgres` (postgres:18-alpine, host 5433 para não colidir com um Postgres local), `mongo` (mongo:8, replica set `rs0`; mongod escuta na 27018 dentro e fora do container e o `rs.initiate` anuncia `localhost:27018`, então `?replicaSet=rs0` funciona do host; o healthcheck inicia o replica set) e `redis`. `up --wait` usa os healthchecks.
- **Scripts de banco**: `db:up:postgres|mongo|redis`, `db:down`, `db:generate`, `db:migrate`, `db:studio` (Postgres), `db:indexes` (Mongo).

## 5. Autenticação

Detalhes de uso em `docs/auth.md`. Decisões:

- **Nenhuma rota emite token sem prova de identidade.** Só `POST /auth/google` (ID token do Google verificado) e `POST /auth/refresh` (refresh token válido). Removidos: `@fastify/session`, `@fastify/cookie`, `jsonwebtoken`, `SESSION_SECRET`, `ACCESS_KEY`/`x-api-key`, `JWT_EXPIRATION`, `POST /users` e as rotas por `externalId`.
- **Stateless, sem cookie nem sessão no servidor.** Access token = JWT HS256 (`jose`, `JWT_SECRET`, claims `sub` e `email`, `exp`) em `Authorization: Bearer`, vida curta (`ACCESS_TOKEN_TTL`, 15m). Verificar não consulta o banco (um access token vale até expirar mesmo após logout; por isso é curto). Algoritmo fixado (`HS256`).
- **Plugin `auth`** (`fastify-plugin`): decora `app.authenticate` e `request.user` (`{ id, email }`, tipado em `src/@types/fastify.d.ts`). Rotas protegidas aplicam `app.addHook('onRequest', app.authenticate)` **no topo do plugin de rotas**, não rota a rota: rota nova no mesmo plugin não consegue esquecer a auth.
- **Fluxo Google**: `jose.jwtVerify` com `createRemoteJWKSet` (`https://www.googleapis.com/oauth2/v3/certs`, cache do jose), issuer `https://accounts.google.com` ou `accounts.google.com`, audience `GOOGLE_CLIENT_ID`, algoritmo `RS256`, `email_verified === true` obrigatório. Falha de verificação = 401 genérico (sem vazar o motivo). Depois `ALLOWED_EMAILS` (vazia = todos) → 403; depois upsert por `googleSub` e emissão de access + refresh. Resposta: `{ accessToken, refreshToken, tokenType: 'Bearer', expiresIn, user }`.
- **Verificador injetável**: `buildApp({ auth: { googleKeys, allowedEmails } })`. Em produção `googleKeys` é o JWKS remoto; nos testes, `createLocalJWKSet` com um par RSA gerado na hora (`src/test/auth.ts`). Sem rede nos testes.
- **Refresh token**: opaco (`randomBytes(32)`, base64url); **só o SHA-256 (hex) é guardado** (`tokenHash`, único). SHA-256 simples basta: a entrada já tem 256 bits de entropia. Campos: `id`, `userId`, `familyId`, `tokenHash`, `expiresAt` (`REFRESH_TOKEN_TTL`, 30d), `revokedAt`, `replacedById`, `createdAt`. `familyId` (uuid por login) agrupa os descendentes por rotação (uma família = uma sessão/dispositivo). `RefreshTokenRepository`: `create`, `findByHash`, `markRotated(id, replacedById)` (atômico: só vale se `revokedAt` ainda é nulo; quem perde a corrida recebe `false`) e `revokeFamily`.
- **Rotação e reuso** (`POST /auth/refresh`): desconhecido/expirado → 401. Já revogado/rotacionado → **reuso**: revoga a família inteira e 401. Válido → cria o novo (mesma família) e `markRotated`; perdeu a corrida → trata como reuso. Usuário sumiu → 401; saiu da `ALLOWED_EMAILS` → 403 (checado de novo). **`POST /auth/logout`** revoga a família do token, sempre 204 (idempotente, não revela se existia); não encerra outras sessões.
- Erros: `ServiceError` ganhou `unauthorized` (401) e `forbidden` (403) em `utils/result.ts`.
- **Casos cobertos nos testes**: token inválido, chave desconhecida, expirado, audience/issuer errados, HS256 (confusão de algoritmo), e-mail não verificado/ausente, fora da lista (403), upsert cria/atualiza, bearer ausente/inválido/expirado/secret errado/ID token ou refresh usado como access, rotação, reuso revogando a família, corrida concorrente, refresh expirado, logout e sessões independentes. `src/http/auth-required.test.ts` garante 401 em toda rota protegida antes de qualquer handler, que rotas removidas dão 404 e que o OpenAPI traz `bearerAuth`.

## 6. Redis (cache opcional)

- **Fica, desacoplado da auth.** `src/infra/cache/`: `cache.ts` (interface `Cache` mínima: `get<T>`, `set(key, value, ttlSeconds?)` com JSON, `del`, `ping`), `connect.ts` (`connect(env)` → `{ cache, close }`; ioredis com `lazyConnect`, `enableOfflineQueue: false`, `maxRetriesPerRequest: 1`, `commandTimeout` 2s: falha rápido em vez de enfileirar com o Redis fora; falha no boot se inalcançável), `env.ts` (`REDIS_URL`; `loadEnv()` devolve `undefined` se não definida) e `index.ts`.
- **Opcional**: `src/index.ts` só conecta se houver `REDIS_URL`; `buildApp({ cache? })` aceita `undefined`; nada no template depende dele. `close()` roda no shutdown depois do banco. Não há helper de cache dentro de módulos: quem precisa recebe o `Cache` pela raiz de composição, como os repositórios.
- Testes `*.redis.test.ts` no projeto vitest `redis` (`TEST_REDIS_URL`, padrão `redis://localhost:6379/15`, nunca o db 0).

## 7. Testes

- **Projetos do vitest por nome de arquivo**: `unit` (tudo menos os de banco), `postgres` (`*.postgres.test.ts`), `mongo` (`*.mongo.test.ts`), `redis` (`*.redis.test.ts`). Os de banco rodam sem paralelismo entre arquivos (compartilham o banco) e sempre usam bancos `app_test` (a config sobrescreve `DATABASE_URL`/`MONGODB_*` por `TEST_DATABASE_URL`/`TEST_MONGODB_URI` ou pelos padrões do compose; nunca o banco de dev). O global setup do Postgres cria `app_test` se faltar e aplica as migrações. `vitest.config.ts` define `JWT_SECRET` e `GOOGLE_CLIENT_ID` de teste.
- **Suítes de contrato**: uma por repositório (`repository.contract.ts`) e uma de rotas por módulo (`routes.contract.ts`, via `app.inject`), executadas por `*.postgres.test.ts` e `*.mongo.test.ts` contra bancos reais. Garantem que os dois adaptadores se comportam igual.
- **Scripts**: `test` (só unit, sem banco); `test:postgres|mongo|redis`; `test:all`; **`check`** = lint + `lint:deps` + typecheck + `test:all` (exige os bancos no ar); **`check:fast`** = lint + `lint:deps` + typecheck + `test` (sem bancos).

## 8. Fronteiras automáticas e preparo para agentes

- **dependency-cruiser** (`.dependency-cruiser.cjs`, `pnpm lint:deps`, dentro de `check` e `check:fast`) impõe as regras que mantêm a remoção do banco mecânica:
  - arquivos `*.postgres.ts` / `*.mongo.ts` (adaptadores e schemas) só são importados por arquivos do próprio banco (os `*.<banco>.ts`, `*.<banco>.test.ts`, a pasta `src/infra/db/<banco>/` e `src/test/db.<banco>.ts`);
  - `src/infra/db/postgres/**` e `src/infra/db/mongo/**` só são importados por arquivos do próprio banco e por `src/infra/db/index.ts`;
  - Postgres não importa Mongo e vice-versa;
  - `drizzle-orm`/`postgres` só em arquivos Postgres; `mongoose` só em arquivos Mongo (cobre `routes`, `service`, `app.ts`, `http`...);
  - um módulo só importa de outro o `repository.ts` e, para FK, o `schema.<banco>.ts`;
  - `src/utils` não importa `modules`/`infra`/`http`;
  - sem ciclos (imports de tipo incluídos).
  Cada regra foi validada introduzindo uma violação temporária.
- **O dependency-cruiser ainda não lê TypeScript 7** (só `typescript < 7`). Ele usa `@swc/core` como transpilador (devDependency) e imprime um aviso `missing-tsc-transpiler` que pode ser ignorado. Trocar para o compilador oficial quando ele passar a suportar o TS 7. A condição `types` fica fora do `enhancedResolveOptions` de propósito: com ela, os pacotes npm resolvem para `.d.ts`, são excluídos e as regras de biblioteca não disparam.
- **Hooks**: husky 9 (`prepare: husky`), pre-commit com lint-staged (`biome check --write` nos `*.{ts,json}` staged), commit-msg com commitlint (`@commitlint/config-conventional`, Conventional Commits).
- **Gerador `pnpm new:module <nome>`** (`scripts/new-module.ts` + `scripts/templates/module/*.tpl`, só `fs`, roda com tsx): gera o módulo só para os bancos presentes, liga o que é seguro editar por âncora e imprime o resto. Os templates são cópias adaptadas do `todo`; ao mudar o `todo`, revise os templates.
- **`AGENTS.md`** é o arquivo canônico (lido pelo Codex); `CLAUDE.md` contém só `@AGENTS.md`.

## 9. Ambiente desta máquina

O Docker aqui não cria redes bridge (módulo `veth` ausente no kernel em uso). A verificação usa um override do compose com `network_mode: host`, **fora do repositório** (`docker compose -f docker-compose.yml -f /caminho/override.yml --profile ... up -d --wait`). O compose do template usa o modo bridge padrão.

## 10. Em aberto

- (feito na Fase 5) Rate limit em `/auth/*` e limpeza de refresh tokens: ver `docs/auth.md`.
- `GET /auth/*` para fluxo web (hoje só mobile/SPA com ID token).
- Revogar todas as sessões de um usuário.
- O access token não é revogável antes de expirar (stateless por decisão).

## 11. Checklists para o README (Fase 5)

> Material para a seção "Escolhendo o banco" e para "Remover o Redis" do README. Mantenha atualizado: toda mudança que adicione arquivo, dependência, variável ou script de banco/Redis entra aqui (regra do `AGENTS.md`).

### Escolhendo o banco: apagar o banco descartado (`<outro>` = `postgres` ou `mongo`)

1. **Pastas e arquivos**:
   - `src/infra/db/<outro>/` (inclui client, env, connect, schema/models, migrations, indexes);
   - `**/*.<outro>.ts` e `**/*.<outro>.test.ts` em `src/modules/**` (`schema`, `repository`, e os testes `repository.*` e `routes.*`);
   - `src/test/db.<outro>.ts` e, no Postgres, `src/test/global-setup.postgres.ts`.
2. **`src/infra/db/index.ts`**: apontar o re-export para o banco mantido (`./postgres` ou `./mongo`).
3. **Agregadores do banco mantido** continuam listando todos os módulos (`schema.ts` / `models.ts` e as linhas do `connect.ts`, incluindo `refreshTokens`); nada a mudar, só conferir. Ao ficar com Mongo, as `migrations/` somem junto com a pasta do Postgres.
4. **Dependências** (`pnpm remove`): `drizzle-orm`, `drizzle-kit`, `postgres` (ao descartar o Postgres) ou `mongoose` (ao descartar o Mongo).
5. **Compose**: serviço do banco descartado e seu volume em `docker-compose.yml` (e comentário do topo).
6. **`package.json`**: scripts `db:up:<outro>`, `test:<outro>`, `--profile <outro>` do `db:down`; Postgres: `db:generate`, `db:migrate`, `db:studio`; Mongo: `db:indexes`; ajustar `test:all` se necessário (usa o vitest sem filtro).
7. **`vitest.config.ts`**: projeto `<outro>`, `<outro>` no `exclude` do projeto `unit` e as linhas `process.env` de teste (`DATABASE_URL` ou `MONGODB_URI`/`MONGODB_DB`).
8. **`.env.example`**: bloco do banco descartado (e `TEST_DATABASE_URL` / `TEST_MONGODB_URI`).
9. **`.dependency-cruiser.cjs`**: constante e regras do banco descartado (e `postgres-not-mongo`/`mongo-not-postgres`, que deixam de fazer sentido).
10. **Gerador** `scripts/new-module.ts`: ramos `hasPostgres`/`hasMongo` do banco descartado e os templates `scripts/templates/module/*.<outro>*.tpl`.
11. **Documentação**: trechos do `AGENTS.md` e de `docs/` que citam o banco descartado, a matriz do CI e a própria seção do README.
12. **Conferência**: `grep -rniE "<outro>|drizzle|postgres" --exclude-dir=node_modules --exclude-dir=.git .` (ajustar o padrão ao banco removido: `mongo|mongoose` ou `postgres|drizzle`) deve voltar vazio, e `pnpm install && pnpm check` verde. Para os termos que sobrarem de propósito (ex.: `docs/decisoes.md`), ajustar ou apagar.

### Remover o Redis

1. Apagar `src/infra/cache/` (inclui `cache.redis.test.ts`).
2. `src/index.ts`: remover o import de `~/infra/cache`, o bloco `cacheEnv`/`redis`, o `cache:` do `buildApp` e o `await redis?.close()`.
3. `src/app.ts`: remover o import de `Cache`, o campo `cache?` de `AppDeps` e o argumento `cache` do `rootRouter`; `src/http/routes/root.ts`: remover a opção `cache`, o `ping` e o `503` (o `/health` volta a ser só `{ status: 'ok' }`; ajustar `healthSchema`) e o teste "GET /health with a cache configured" em `src/http/routes/root.test.ts`.
4. `pnpm remove ioredis`.
5. `docker-compose.yml`: serviço `redis`, volume `redis-data` e o comentário do topo; `package.json`: scripts `db:up:redis`, `test:redis` e o `--profile redis` do `db:down`.
6. `vitest.config.ts`: projeto `redis`, `redis` no `exclude` do projeto `unit` e o `process.env.REDIS_URL` de teste.
7. `.env.example`: blocos `redis` e `TEST_REDIS_URL`.
8. `grep -rniE "redis|ioredis" --exclude-dir=node_modules --exclude-dir=.git .` deve voltar vazio; `pnpm install && pnpm check`.
