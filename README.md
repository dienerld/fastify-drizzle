# Fastify API Template

Template de API HTTP em **Fastify 5 + Zod 4** (TypeScript, Node 24, pnpm 12) com login Google, access token JWT curto + refresh token rotativo, rate limit, documentação em `/docs` (Scalar) e testes contra banco real. Traz **Postgres (Drizzle) e Mongo (Mongoose) lado a lado**: você fica com um (ver [Escolhendo o banco](#escolhendo-o-banco)). Redis é cache **opcional** (ver [Remover o Redis](#remover-o-redis)).

## Stack

Fastify 5, Zod 4 (`fastify-type-provider-zod`), TypeScript 7, Drizzle + `postgres` ou Mongoose, `jose` (JWT/JWKS), `@fastify/rate-limit`, ioredis (opcional), Biome, Vitest, tsdown, dependency-cruiser, Husky + commitlint.

## Começando em 5 passos

Requer Node 24, [pnpm](https://pnpm.io) na versão do `packageManager` do `package.json` (`corepack enable` ou `npm i -g pnpm@<versão>`) e Docker.

```bash
pnpm install                    # 1. dependências (instala os hooks do Husky)
cp .env.example .env            # 2. configuração: troque JWT_SECRET e GOOGLE_CLIENT_ID
pnpm db:up:postgres             # 3. banco (ou: pnpm db:up:mongo)
pnpm db:migrate                 # 4. migrações (Postgres; no Mongo os índices são criados no boot)
pnpm dev                        # 5. http://localhost:3333/docs
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | servidor com watch (lê `.env`) |
| `pnpm check` | lint + `lint:deps` + typecheck + **todos** os testes (precisa dos bancos no ar) |
| `pnpm check:fast` | o mesmo, só com os testes sem banco |
| `pnpm test`, `test:postgres`, `test:mongo`, `test:redis`, `test:all` | testes por grupo |
| `pnpm lint` / `lint:fix` / `lint:deps` / `typecheck` | Biome, fronteiras de arquitetura, TypeScript |
| `pnpm new:module <nome>` | gera um módulo (rotas, serviço, interface, testes) |
| `pnpm db:up:postgres\|mongo\|redis`, `pnpm db:down` | sobe/derruba os bancos (Docker Compose, perfis) |
| `pnpm db:generate`, `db:migrate`, `db:studio` | Drizzle (Postgres) |
| `pnpm db:indexes` | índices do Mongo |
| `pnpm tokens:cleanup` | apaga refresh tokens expirados (para cron; ver `docs/auth.md`) |
| `pnpm build` / `pnpm start` | tsdown → `dist/index.js` |

## Docker, devcontainer e CI

- **Imagem de produção** (`Dockerfile`, multi-stage, usuário não-root, `HEALTHCHECK` em `/health`):
  ```bash
  docker build -t minha-api .
  docker run --rm --env-file .env minha-api node dist/migrate.js   # migrações (Postgres), passo separado
  docker run -d --env-file .env -p 3333:3333 minha-api
  ```
  As migrações rodam como passo à parte com a mesma imagem (o orquestrador/pipeline executa antes de subir a nova versão); no Mongo não há passo, os índices são criados no boot.
- **Devcontainer** (`.devcontainer/`): Node 24 + pnpm, sobe `app` e o Postgres do compose (edite `runServices` para Mongo/Redis).
- **CI** (`.github/workflows/ci.yml`): em PR e push na `main`: `check:fast` + build, testes de cada banco (matriz `postgres`/`mongo`), testes do Redis e build da imagem. Sem deploy.

## Documentação

- [`AGENTS.md`](AGENTS.md): regras e mapa do projeto (leia antes de editar; vale para pessoas e agentes).
- [`docs/auth.md`](docs/auth.md): fluxo de login, tokens, rate limit, limpeza, trocar provedor.
- [`docs/adicionar-modulo.md`](docs/adicionar-modulo.md): receita do gerador de módulos.
- [`docs/decisoes.md`](docs/decisoes.md): por que o projeto é assim.
- [`docs/ROADMAP.md`](docs/ROADMAP.md): plano da reforma do template (apague no seu projeto).

## Escolhendo o banco

O template traz os dois bancos para você **escolher sem reescrever nada**: cada módulo tem uma interface de repositório e dois adaptadores nativos (`repository.postgres.ts` / `repository.mongo.ts`) com as mesmas suítes de contrato. Um projeto real deve ficar com **um só**: menos dependências, menos CI, menos código morto. A remoção é **manual e mecânica** porque todo código de banco segue a convenção de nomes (`*.postgres.ts`, `*.mongo.ts`, `*.<banco>.test.ts`, pastas `src/infra/db/<banco>/`), e o `pnpm lint:deps` garante que ninguém a quebrou. Não existe script de seleção.

Faça numa cópia nova do template, antes de escrever código do seu produto, e **siga a lista na ordem**. No fim: conferência de sobras (deve voltar vazia), `pnpm lint:fix` e `pnpm install && pnpm check`. Os trechos de `docker-compose.yml`, `package.json`, `vitest.config.ts` etc. são identificados pelo nome; apague também os comentários que os citam.

### Ficar com Postgres (apagar o Mongo)

1. **Apagar arquivos**:
   ```bash
   rm -rf src/infra/db/mongo
   find src scripts -type f \( -name '*.mongo.ts' -o -name '*.mongo.test.ts' -o -name '*.mongo*.tpl' \) -delete
   ```
   (cobre `src/test/db.mongo.ts`, `schema|repository|routes.mongo*` de cada módulo e os templates do gerador.)
2. **`src/infra/db/index.ts`**: deixe só `export { connect, loadEnv } from './postgres'` (sem o comentário que cita `./mongo`).
3. **Dependência**: `pnpm remove mongoose`.
4. **`docker-compose.yml`**: apague o serviço `mongo`, o volume `mongo-data`, o comentário acima do serviço e a linha `--profile mongo` do comentário do topo.
5. **`package.json`** (scripts): apague `db:up:mongo`, `test:mongo`, `db:indexes` e tire `--profile mongo` do `db:down`.
6. **`vitest.config.ts`**: apague o projeto `mongo` e a linha dele no comentário; no `exclude` do projeto `unit` troque `{postgres,mongo,redis}` por `{postgres,redis}`; apague as linhas `process.env.MONGODB_*` e a menção a `MONGODB_URI` no comentário. Apague também a referência a `docs/decisoes.md` no comentário (o arquivo some no passo 12).
7. **`.env.example`**: apague o bloco `mongo` e a linha `TEST_MONGODB_URI`.
8. **`.dependency-cruiser.cjs`**: apague a constante `MONGO` e as regras `mongo-adapters-only-from-mongo-files`, `mongo-folder-is-private`, `mongo-libs-only-in-mongo-files`, `postgres-not-mongo` e `mongo-not-postgres`; em `no-cross-module-internals` troque `(postgres|mongo)` por `postgres`; no comentário do topo, tire a referência a `docs/decisoes.md`.
9. **Gerador `scripts/new-module.ts`**: apague `hasMongo` (a constante, o `if (!hasPostgres && !hasMongo)`, o `...(hasMongo ? ...)` de `dbs`, o bloco `if (hasMongo) { ... }` de `wireAll` e os trechos `db.hasMongo` de `report`; troque `pnpm db:up:...` do último passo por `pnpm db:up:postgres && pnpm check`). Em `src/modules/todo/repository.contract.ts` e em `scripts/templates/module/repository.contract.ts.tpl`, tire o `repository.mongo.test.ts` do comentário.
10. **CI** (`.github/workflows/ci.yml`): `db: [postgres]` na matriz do job `db`.
11. **Devcontainer** (`.devcontainer/docker-compose.yml`): apague `TEST_MONGODB_URI` e o comentário sobre o replica set; em `devcontainer.json` tire o "mongo" do comentário de `runServices`.
12. **Documentação**: apague `docs/ROADMAP.md` e `docs/decisoes.md` (história do template) e os links para eles no README e no `AGENTS.md` (seção "Mais docs"). No `AGENTS.md`: tire o Mongo de "O que é", dos comandos (`test:mongo`, `db:up:mongo`, `db:indexes`), da árvore de pastas, das tabelas, da convenção de nomes e das regras 1 e "Criar um módulo"; reescreva a regra 6 para citar só a checklist "Remover o Redis" (README). Em `docs/auth.md` (tabela de limpeza e passo de trocar provedor) e `docs/adicionar-modulo.md` (intro, tabela e lista de ligações, "Verificar") tire o que é do Mongo. Apague esta seção do README e as menções ao Mongo no resto dele.
13. **Conferência de sobras** (deve voltar vazio), formatação e verificação:
    ```bash
    grep -rniE "mongo" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude=pnpm-lock.yaml .
    pnpm lint:fix && pnpm install && pnpm db:up:postgres && pnpm check
    ```

### Ficar com Mongo (apagar o Postgres)

1. **Apagar arquivos**:
   ```bash
   rm -rf src/infra/db/postgres
   find src scripts -type f \( -name '*.postgres.ts' -o -name '*.postgres.test.ts' -o -name '*.postgres*.tpl' \) -delete
   ```
   (cobre `src/test/db.postgres.ts`, `src/test/global-setup.postgres.ts`, `schema|repository|routes.postgres*` dos módulos e os templates do gerador; `migrations/` vai junto com a pasta.)
2. **`src/infra/db/index.ts`**: deixe só `export { connect, loadEnv } from './mongo'`.
3. **Dependências**: `pnpm remove drizzle-orm drizzle-kit postgres`.
4. **`docker-compose.yml`**: apague o serviço `postgres`, o volume `postgres-data` e a linha `--profile postgres` do comentário do topo.
5. **`package.json`** (scripts): apague `db:up:postgres`, `test:postgres`, `db:generate`, `db:migrate`, `db:studio` e tire `--profile postgres` do `db:down`.
6. **`vitest.config.ts`**: apague o projeto `postgres` (com o `globalSetup`) e a linha dele no comentário; no `exclude` do projeto `unit` troque `{postgres,mongo,redis}` por `{mongo,redis}`; apague a linha `process.env.DATABASE_URL` e a menção a `DATABASE_URL` no comentário. Apague também a referência a `docs/decisoes.md` no comentário.
7. **`.env.example`**: apague o bloco `postgres` e `TEST_DATABASE_URL`; **descomente** `MONGODB_URI` e `MONGODB_DB` (agora são obrigatórias).
8. **`.dependency-cruiser.cjs`**: apague a constante `POSTGRES` e as regras `postgres-adapters-only-from-postgres-files`, `postgres-folder-is-private`, `postgres-libs-only-in-postgres-files`, `postgres-not-mongo` e `mongo-not-postgres`; em `no-cross-module-internals` troque `(postgres|mongo)` por `mongo`; no comentário do topo, tire a referência a `docs/decisoes.md`.
9. **Build e imagem**: em `tsdown.config.ts` troque `entry` por `['src/index.ts']` e apague o `copy` das migrações; no `Dockerfile` apague as linhas do comentário sobre `dist/migrate.js`; em `biome.json` apague `!src/infra/db/postgres/migrations`.
10. **Gerador `scripts/new-module.ts`**: apague `hasPostgres` (a constante, o `if (!hasPostgres && !hasMongo)`, o `...(hasPostgres ? ...)` de `dbs`, o bloco `if (hasPostgres) { ... }` de `wireAll` e os trechos `db.hasPostgres` de `report`; troque o último passo por `pnpm db:up:mongo && pnpm check`). Em `src/modules/todo/repository.contract.ts` e em `repository.contract.ts.tpl`, tire o `repository.postgres.test.ts` do comentário.
11. **CI**: `db: [mongo]` na matriz do job `db`.
12. **Devcontainer**: em `devcontainer.json` troque `"postgres"` por `"mongo"` em `runServices`; em `.devcontainer/docker-compose.yml` troque `DATABASE_URL`/`TEST_DATABASE_URL` e o comentário por `MONGODB_URI: mongodb://mongo:27018/?directConnection=true` (e `TEST_MONGODB_URI` igual).
13. **Documentação**: apague `docs/ROADMAP.md` e `docs/decisoes.md` e os links para eles (README e seção "Mais docs" do `AGENTS.md`). No `AGENTS.md` tire o Postgres/Drizzle/migrações de "O que é", dos comandos (`db:generate|migrate|studio`, `test:postgres`, `db:up:postgres`), da árvore de pastas, das tabelas, da convenção de nomes, das regras 1 e de "Como verificar" (item de schema/migração); reescreva a regra 6 para citar só a checklist "Remover o Redis". Em `docs/auth.md` e `docs/adicionar-modulo.md` tire o que é do Postgres (inclusive a seção "Migração"). No README: apague esta seção, o passo `pnpm db:migrate` do começo, o `docker run ... dist/migrate.js`, `db:generate|migrate|studio` dos comandos e as menções ao Postgres.
14. **Conferência de sobras** (deve voltar vazio), formatação e verificação:
    ```bash
    grep -rniE "postgres|drizzle" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude=pnpm-lock.yaml .
    pnpm lint:fix && pnpm install && pnpm db:up:mongo && pnpm check
    ```

> Regra do projeto (`AGENTS.md`): toda mudança que adicione arquivo, dependência, variável ou script ligado a banco/Redis **atualiza estas listas**.

## Remover o Redis

O Redis é opcional (cache e contadores do rate limit compartilhados entre instâncias). Sem `REDIS_URL` o app roda sem ele; para apagar o código de vez:

1. **Apagar**: `rm -rf src/infra/cache src/http/rate-limit.redis.test.ts`.
2. **`src/index.ts`**: remova o import de `~/infra/cache`, o bloco `cacheEnv`/`redis`, `cache:` e `redis:` do `buildApp` e o `await redis?.close()`.
3. **`src/app.ts`**: remova o import de `Cache`/`RedisClient`, os campos `cache?` e `redis?` de `AppDeps` (com seus comentários), `cache` e `redis` dos parâmetros do `buildApp`, `redis` do `register(rateLimitPlugin, ...)` e o `cache` do `rootRouter`.
4. **`src/http/rate-limit.ts`**: remova o import de `RedisClient`, a opção `redis` do plugin e as linhas `redis` e `nameSpace` do `register`; ajuste o comentário.
5. **`src/http/routes/root.ts`**: remova a opção `cache`, o `ping` e o `503` (o `/health` volta a ser só `{ status: 'ok' }`; simplifique `healthSchema`) e o teste "GET /health with a cache configured" em `src/http/routes/root.test.ts`.
6. **Testes do rate limit**: em `src/http/rate-limit.contract.ts` remova `RedisClient`, o parâmetro `redis` de `Make`, a opção `opts` de `describeRateLimit` (e o `prefix` do título); em `src/http/rate-limit.test.ts` o comentário sobre o Redis. Em `src/modules/auth/routes.ts`, ajuste o comentário que cita "shared Redis store".
7. **Dependência**: `pnpm remove ioredis`.
8. **`docker-compose.yml`**: serviço `redis`, volume `redis-data` e `--profile redis` do comentário do topo. **`package.json`**: `db:up:redis`, `test:redis` e `--profile redis` do `db:down`.
9. **`vitest.config.ts`**: projeto `redis` e sua linha no comentário, `process.env.REDIS_URL`, e `redis` no `exclude` do projeto `unit`. Atenção: com um padrão só, escreva `src/**/*.mongo.test.ts` (ou `postgres`), **sem chaves**: `{mongo}` não é uma expansão válida e o projeto `unit` passaria a rodar os testes de banco.
10. **`.env.example`**: bloco `redis`, `TEST_REDIS_URL` e a menção ao Redis no comentário do rate limit. **CI**: apague o job `redis`. **Devcontainer**: `TEST_REDIS_URL` e os comentários sobre Redis.
11. **Documentação**: `AGENTS.md` (comandos, árvore, "Como verificar", regra 6), `docs/auth.md` (item "Armazenamento" e "Testes" do rate limit), `docs/adicionar-modulo.md` (seção "Se o módulo precisar do Redis") e esta seção do README (e o Redis da introdução e da stack).
12. **Conferência**: `grep -rniE "redis" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude=pnpm-lock.yaml .` deve voltar vazio; `pnpm lint:fix && pnpm install && pnpm check`.
