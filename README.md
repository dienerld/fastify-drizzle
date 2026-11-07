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

Faça numa cópia nova do template, antes de escrever código do seu produto, e **siga a lista na ordem**. Terminou? Rode a conferência de sobras e `pnpm install && pnpm check`.

### Ficar com Postgres (apagar o Mongo)

1. **Apagar arquivos**:
   ```bash
   rm -rf src/infra/db/mongo
   find src scripts -type f \( -name '*.mongo.ts' -o -name '*.mongo.test.ts' -o -name '*.mongo*.tpl' \) -delete
   ```
   (isso cobre `src/test/db.mongo.ts`, `schema|repository|routes.mongo*` de cada módulo e os templates do gerador.)
2. **`src/infra/db/index.ts`**: deixe só `export { connect, loadEnv } from './postgres'` (sem o comentário que cita `./mongo`).
3. **Dependência**: `pnpm remove mongoose`.
4. **`docker-compose.yml`**: apague o serviço `mongo`, o volume `mongo-data` e as linhas de comentário sobre Mongo/replica set.
5. **`package.json`** (scripts): apague `db:up:mongo`, `test:mongo`, `db:indexes` e tire `--profile mongo` do `db:down`.
6. **`vitest.config.ts`**: apague o projeto `mongo`, `mongo` do `exclude` do projeto `unit` (`{postgres,redis}`), as linhas `process.env.MONGODB_*` e os comentários que citam Mongo.
7. **`.env.example`**: apague o bloco `mongo` e a linha `TEST_MONGODB_URI`; ajuste o comentário do `DATABASE_URL`.
8. **`.dependency-cruiser.cjs`**: apague a constante `MONGO`, as regras `mongo-*` e `postgres-not-mongo`; nas regras do Postgres, tire `MONGO` das expressões.
9. **Gerador `scripts/new-module.ts`**: remova `hasMongo` e os ramos que só valem para o Mongo (`if (hasMongo)`, trechos de relatório). Em `src/modules/todo/repository.contract.ts` e no template `scripts/templates/module/repository.contract.ts.tpl`, tire o `repository.mongo.test.ts` do comentário.
10. **CI** (`.github/workflows/ci.yml`): tire `mongo` da matriz `db`.
11. **Devcontainer** (`.devcontainer/`): apague `TEST_MONGODB_URI` e os comentários sobre Mongo do `docker-compose.yml`.
12. **Documentação**: no `AGENTS.md` e em `docs/` remova as menções ao Mongo (tabelas, árvore de pastas, convenção de nomes, regras); apague esta seção do README e as linhas do README que citam o Mongo. `docs/ROADMAP.md` pode ser apagado; em `docs/decisoes.md` apague/ajuste os trechos do Mongo (seção 4 e o que sobrar da conferência).
13. **Conferência de sobras** (deve voltar vazio) e verificação:
    ```bash
    grep -rniE "mongo" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude=pnpm-lock.yaml .
    pnpm install && pnpm db:up:postgres && pnpm check
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
4. **`docker-compose.yml`**: apague o serviço `postgres`, o volume `postgres-data` e o comentário correspondente.
5. **`package.json`** (scripts): apague `db:up:postgres`, `test:postgres`, `db:generate`, `db:migrate`, `db:studio` e tire `--profile postgres` do `db:down`.
6. **`vitest.config.ts`**: apague o projeto `postgres` (com o `globalSetup`), `postgres` do `exclude` do projeto `unit` (`{mongo,redis}`) e a linha `process.env.DATABASE_URL`.
7. **`.env.example`**: apague o bloco `postgres` e `TEST_DATABASE_URL`; ajuste o comentário do bloco `mongo` (que cita o ponto de escolha) e, se quiser, descomente `MONGODB_URI`/`MONGODB_DB`.
8. **`.dependency-cruiser.cjs`**: apague a constante `POSTGRES`, as regras `postgres-*` e `postgres-not-mongo`; nas regras do Mongo, tire `POSTGRES` das expressões.
9. **Build e imagem**: em `tsdown.config.ts` apague a entrada `migrate` e o `copy` das migrações; no `Dockerfile` apague o comentário do passo de migração; em `biome.json` apague a linha `!src/infra/db/postgres/migrations`; no README apague o passo `pnpm db:migrate` e o `docker run ... dist/migrate.js`.
10. **Gerador `scripts/new-module.ts`**: remova `hasPostgres` e os ramos só do Postgres. Em `src/modules/todo/repository.contract.ts` e no template `repository.contract.ts.tpl`, tire o `repository.postgres.test.ts` do comentário.
11. **CI**: tire `postgres` da matriz `db`.
12. **Devcontainer**: em `devcontainer.json` troque `"postgres"` por `"mongo"` em `runServices`; no `docker-compose.yml` apague `DATABASE_URL`/`TEST_DATABASE_URL` e use o `MONGODB_URI` indicado nos comentários.
13. **Documentação**: no `AGENTS.md` e em `docs/` remova as menções ao Postgres/Drizzle/migrações; apague esta seção do README e as linhas que citam o Postgres. `docs/ROADMAP.md` pode ser apagado; ajuste `docs/decisoes.md`.
14. **Conferência de sobras** (deve voltar vazio) e verificação:
    ```bash
    grep -rniE "postgres|drizzle" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude=pnpm-lock.yaml .
    pnpm install && pnpm db:up:mongo && pnpm check
    ```

> Regra do projeto (`AGENTS.md`): toda mudança que adicione arquivo, dependência, variável ou script ligado a banco/Redis **atualiza estas listas**.

## Remover o Redis

O Redis é opcional (cache e contadores do rate limit compartilhados entre instâncias). Sem `REDIS_URL` o app roda sem ele; para apagar o código de vez:

1. **Apagar**: `rm -rf src/infra/cache src/http/rate-limit.redis.test.ts`.
2. **`src/index.ts`**: remova o import de `~/infra/cache`, o bloco `cacheEnv`/`redis`, `cache:` e `redis:` do `buildApp` e o `await redis?.close()`.
3. **`src/app.ts`**: remova o import de `Cache`/`RedisClient`, os campos `cache?` e `redis?` de `AppDeps`, o `redis` do `buildApp` (e do `register(rateLimitPlugin, ...)`) e o argumento `cache` do `rootRouter`.
4. **`src/http/rate-limit.ts`**: remova o import `RedisClient`, a opção `redis` do plugin e o `nameSpace`/`redis` do `register`.
5. **`src/http/routes/root.ts`**: remova a opção `cache`, o `ping` e o `503` (o `/health` volta a ser só `{ status: 'ok' }`; ajuste `healthSchema`); apague o teste "GET /health with a cache configured" em `src/http/routes/root.test.ts`.
6. **Testes do rate limit**: em `src/http/rate-limit.contract.ts` remova a opção `redis` de `describeRateLimit` e o parâmetro `redis` de `Make`; em `src/http/rate-limit.test.ts` o parâmetro extra.
7. **Dependência**: `pnpm remove ioredis`.
8. **`docker-compose.yml`**: serviço `redis`, volume `redis-data` e comentário do topo. **`package.json`**: `db:up:redis`, `test:redis` e `--profile redis` do `db:down`.
9. **`vitest.config.ts`**: projeto `redis`, `redis` no `exclude` do `unit` e `process.env.REDIS_URL`.
10. **`.env.example`**: bloco `redis` e `TEST_REDIS_URL`. **CI**: apague o job `redis`. **Devcontainer**: `TEST_REDIS_URL` e comentários.
11. **Documentação**: `AGENTS.md`, `docs/auth.md` (rate limit), `docs/adicionar-modulo.md` (seção "Se o módulo precisar do Redis") e esta seção do README.
12. **Conferência**: `grep -rniE "redis" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude=pnpm-lock.yaml .` deve voltar vazio; `pnpm install && pnpm check`.
