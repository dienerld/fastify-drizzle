# AGENTS.md

Guia para agentes (e pessoas) neste repositório. Leia inteiro antes de editar.

## O que é

Template de API HTTP em **Fastify 5 + Zod 4** (TypeScript, Node 24, pnpm 12). Auth stateless com login Google (ID token → access JWT de vida curta + refresh token rotativo no banco). Documentação interativa em `/docs` (Scalar). Traz **Postgres (Drizzle) e Mongo (Mongoose) lado a lado**; um projeto real usa só um e apaga o outro **manualmente** (seção "Escolhendo o banco" do README). Redis é cache **opcional**.

Módulos de exemplo: `users` (`GET /users/me`), `todo` (CRUD por usuário), `auth` (`/auth/google`, `/auth/refresh`, `/auth/logout`).

## Comandos

Use pnpm (versão fixada em `packageManager`).

| Comando | O que faz | Banco? |
| --- | --- | --- |
| `pnpm dev` | Servidor com watch (lê `.env`) | sim |
| `pnpm check:fast` | lint + `lint:deps` + typecheck + testes unitários | **não** |
| `pnpm check` | lint + `lint:deps` + typecheck + **todos** os testes | **sim** |
| `pnpm lint` / `pnpm lint:fix` | Biome | não |
| `pnpm lint:deps` | Regras de fronteira (dependency-cruiser) | não |
| `pnpm typecheck` | `tsc --noEmit` | não |
| `pnpm test` | só testes sem banco (projeto `unit`) | não |
| `pnpm test:postgres` / `test:mongo` / `test:redis` | testes contra o banco real | sim |
| `pnpm test:all` | tudo | sim |
| `pnpm new:module <nome>` | gera um módulo (ver "Criar um módulo") | não |
| `pnpm db:generate` / `db:migrate` / `db:studio` | Drizzle (Postgres) | sim (`migrate`, `studio`) |
| `pnpm db:indexes` | sincroniza índices (Mongo) | sim |
| `pnpm build` / `pnpm start` | tsdown → `dist/index.js` | — |

Subir bancos (Docker Compose, perfis): `pnpm db:up:postgres`, `pnpm db:up:mongo`, `pnpm db:up:redis`; derrubar: `pnpm db:down`. Os testes usam bancos próprios (`app_test`, redis db 15), nunca os de dev. Variáveis: copie `.env.example` para `.env`.

## Mapa de pastas

```
src/
  index.ts                 raiz de composição: conecta banco/cache, chama buildApp, shutdown
  app.ts                   buildApp(): plugins, auth, registra cada módulo (prefixo + repositório)
  env.ts                   env de http e auth (validado no import)
  modules/<nome>/          um módulo por recurso (ver abaixo)
  infra/
    repositories.ts        tipo Repositories (todos os repositórios) e Database
    db/index.ts            ÚNICO ponto que escolhe o banco (re-export de ./postgres ou ./mongo)
    db/postgres/           client, env, connect, schema.ts (agregador), migrations/
    db/mongo/              client, env, connect, models.ts (agregador), indexes
    cache/                 Redis opcional (interface Cache, connect, env)
  http/routes/root.ts      / e /health
  utils/                   genéricos: result, error-handler, parse-env, duration...
  test/                    helpers de teste (auth falsa, db.<banco>.ts, no-repositories)
scripts/new-module.ts      gerador de módulos (+ scripts/templates/module/*.tpl)
docs/                      receitas e decisões (ver "Mais docs")
```

Arquivos de um módulo (`src/modules/<nome>/`):

| Arquivo | Papel |
| --- | --- |
| `repository.ts` | tipos de domínio + **interface** do repositório (só os métodos que o módulo usa) |
| `service.ts` | regras de negócio; retorna `Result` (`ok`/`fail`), nunca lança erro HTTP |
| `routes.ts` | HTTP fino: schemas Zod, `app.addHook('onRequest', app.authenticate)`, chama o service |
| `schema.postgres.ts` / `schema.mongo.ts` | tabela Drizzle / schema Mongoose (modelo nativo de cada banco) |
| `repository.postgres.ts` / `repository.mongo.ts` | adaptadores: implementam a interface e mapeiam para o tipo de domínio |
| `repository.contract.ts`, `routes.contract.ts` | suítes compartilhadas (`describe...`), sem importar banco |
| `*.postgres.test.ts` / `*.mongo.test.ts` | rodam as suítes contra o banco real |

## Camadas e direção dos imports

```
routes.ts → service.ts → repository.ts (interface)      adaptadores implementam a interface
                                  ↑
            repository.<banco>.ts, schema.<banco>.ts  ← src/infra/db/<banco>/connect.ts
                                                       ← src/infra/db/index.ts (escolha)
src/index.ts / app.ts (raiz de composição) recebem os repositórios prontos
```

- `routes`/`service` conhecem só a **interface** (`repository.ts`), nunca adaptador, schema de banco nem `drizzle-orm`/`mongoose`/`postgres`.
- Repositórios chegam por injeção: `connect()` → `Database.repositories` → `buildApp({ repositories })` → opção do plugin de rotas. Sem singletons nem `decorate`. O `Cache` (opcional) entra igual, por `buildApp({ cache })`.
- Um módulo **não importa o interior de outro**. Permitido: `repository.ts` de outro módulo (tipos) e, para chave estrangeira, `schema.<banco>.ts` de outro módulo (só dentro de `schema.<banco>.ts`). Service de um módulo precisando de outro recebe a interface dele por parâmetro.
- Tudo isso é **verificado** por `pnpm lint:deps` (`.dependency-cruiser.cjs`); sem ciclos.

## Convenção de nomes por banco (por quê)

Todo código de banco vive em arquivos que o nome identifica: `*.postgres.ts`, `*.mongo.ts`, `*.postgres.test.ts`, `*.mongo.test.ts` e nas pastas `src/infra/db/postgres/` e `src/infra/db/mongo/` (mais `src/test/db.<banco>.ts`). Assim, descartar um banco é **manual e mecânico**: apagar esses arquivos, uma linha em `src/infra/db/index.ts`, dependências, compose, scripts e `.env.example`. **Não existe script de seleção**; o passo a passo fica no README ("Escolhendo o banco"). Quem não respeita a convenção quebra esse passo a passo. Não há repositório genérico nem schema único: a interface é por módulo e os models são nativos.

## Regras que não podem ser quebradas

1. **Nenhum código de banco fora da convenção**: `drizzle-orm`/`postgres` só em arquivos Postgres, `mongoose` só em arquivos Mongo; nada importa `infra/db/postgres|mongo` além de `src/infra/db/index.ts` e arquivos do próprio banco. O `lint:deps` falha se quebrar.
2. **Todo módulo protegido usa `app.addHook('onRequest', app.authenticate)` no topo do plugin de rotas** (não rota a rota). Só `/auth/*` e `/health`, `/docs` são públicos.
3. **Dados escopados por `request.user.id`**: o id do usuário vem sempre do token, nunca do body/params. Todo método de repositório de dado de usuário recebe `userId` e filtra por ele; recurso de outro usuário = 404, indistinguível de inexistente. ID malformado no adaptador retorna `null`/`false`, nunca erro de banco.
4. **Formato de erro único** `{ error, message, statusCode, issues? }`: service retorna `fail({ code, message })` e a rota faz `throw toHttpError(result.error)`. Documente respostas com `routeSchema({ protected, notFound, ... })`.
5. **Sem `console.*`** no código da aplicação (use `app.log` / `request.log`). Exceções existentes: validação de env em `src/env.ts` e o `catch` final de `src/index.ts`.
6. **Toda mudança que adicionar/remover arquivo, dependência, variável de ambiente ou script ligado a banco atualiza a checklist** de "Escolhendo o banco" (README) e, se for o caso, a de "Remover o Redis". A lista de referência está em `docs/decisoes.md`, seção "Checklists para o README".
7. **Sempre instale a última versão estável**: `pnpm add <pacote>@latest` (e `-D` para dev). Não copie versão de memória. pnpm 12 bloqueia scripts de build; só libere em `pnpm-workspace.yaml` (`allowBuilds`) o que for realmente necessário.
8. Não crie rota que emita token sem prova de identidade; não coloque segredo em código ou em `.env.example`.
9. Teste comportamento de repositório e de rotas nas **suítes de contrato**, rodadas contra banco real nos dois bancos. Não há adaptador em memória.

## Criar um módulo

```bash
pnpm new:module invoice            # nome em kebab-case, singular
pnpm new:module person --plural people   # plural irregular
```

Gera `src/modules/<nome>/` (CRUD protegido e por usuário, baseado em `todo`) só com os bancos presentes (`src/infra/db/postgres`, `src/infra/db/mongo`), registra em `repositories.ts`, `app.ts`, `connect.ts`, agregadores e `no-repositories.ts`, e imprime o que falta. Depois: ajuste os campos, `pnpm db:generate` (Postgres), `pnpm check`. Passo a passo e como adaptar: `docs/adicionar-modulo.md`.

## Como verificar antes de dar por pronto

1. `pnpm check:fast` (rápido, sem banco) a cada mudança.
2. Antes de declarar concluído: suba os bancos (`pnpm db:up:postgres && pnpm db:up:mongo && pnpm db:up:redis`) e rode **`pnpm check`**. Mudança que só toca docs pode ficar no `check:fast`.
3. Mudou schema Postgres? `pnpm db:generate` e revise o SQL em `src/infra/db/postgres/migrations/` (commite junto).
4. Mudou rota? Confira `/docs` e rode os testes de rotas dos dois bancos.

Se o Docker não criar redes bridge na sua máquina, use um override do compose fora do repositório com `network_mode: host` (`docker compose -f docker-compose.yml -f /caminho/override.yml ...`); não o commite.

## Estilo

- **Biome** formata e lint (`pnpm lint:fix`): aspas simples, sem ponto e vírgula, 2 espaços, 80 colunas. Imports organizados pelo Biome. Alias `~/` = `src/`.
- TypeScript estrito; sem `any` solto. Validação de entrada com Zod, tipos derivados dele.
- Código e comentários em inglês; documentação em `docs/` em português.
- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`...), validados por commitlint. Husky roda `lint-staged` (Biome nos arquivos staged) no pre-commit e commitlint no commit-msg. Nunca pule os hooks (`--no-verify`).

## Mais docs

- `docs/adicionar-modulo.md`: receita do gerador e das partes manuais.
- `docs/auth.md`: fluxo, variáveis, trocar/adicionar provedor, proteger rotas.
- `docs/decisoes.md`: por que o projeto é assim, por tema, e checklists para o README.
- `docs/ROADMAP.md`: plano da reforma do template.
