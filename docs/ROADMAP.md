# Roadmap de atualização do boilerplate Fastify

Data: 2026-11-07. Origem: conversa de design da migração da granja (Nuxt → Flutter + API). Este repositório vira um **template genérico** de API para projetos futuros; a API da granja será criada a partir dele depois.

## Objetivo

Um template de API em Fastify, atual e testado, que traz **Postgres (Drizzle) e MongoDB prontos e documentados**. Ao criar um projeto a partir dele, o dev (ou o agente) escolhe o banco **uma vez** e **apaga manualmente tudo do outro banco**, seguindo a seção "Escolhendo o banco" do README. O template também é preparado para ser trabalhado por agentes (Claude Code, Codex): instruções claras, receitas e um comando único de verificação.

**Sucesso:** no template, `pnpm check` passa com lint, tipos e testes nos dois bancos. Num projeto novo: clonar, remover o banco descartado seguindo a checklist do README, subir com `docker compose`, rodar `pnpm check` e ver tudo passando sem nenhum arquivo, dependência ou variável do banco descartado. Um agente consegue criar um módulo novo seguindo só o `AGENTS.md` e as receitas.

**Não é objetivo:** regra de negócio de nenhum projeto (nada de granja aqui), deploy específico (Railway), billing, filas, multi-tenant, trocar de banco em tempo de execução.

## Estado atual (diagnóstico, nov/2024 → hoje)

As versões da coluna "Atual" foram conferidas no npm em 2026-11-07 e servem só de referência. **Regra:** cada fase instala a última versão estável no momento da execução (`pnpm add <pkg>@latest`), nunca copia números deste documento.

| Item | Hoje | Atual (npm, 2026-11-07) |
|---|---|---|
| pnpm | 9.12 | 12.18 |
| Node (.tool-versions / Docker) | 22.9 / 20 | 24 LTS |
| fastify | 5.0.0 | 5.12.8 |
| zod / fastify-type-provider-zod | 3.23 / 4.0 | 4.6.7 / 7.0.0 (API mudou) |
| drizzle-orm / drizzle-kit | 0.33 / 0.24 | 0.45.4 / 0.31.11 |
| postgres (driver) | — | 4.1.0 |
| mongodb (driver oficial) | — | 7.8.0 |
| @fastify/swagger / @scalar/fastify-api-reference | 9.1 / 1.25 | 9.9.3 / 1.77.0 |
| typescript | 5.6 | 7.0.2 |
| vitest | 2.1 (sem nenhum teste) | 5.1.0 |
| @biomejs/biome | 1.9 | 2.6.6 (config mudou) |
| bundler | tsup 8.3 | **tsdown 0.23.7** (substitui o tsup) |
| tsx | — | 4.23.15 |
| jose | — | 6.2.15 |
| Postgres (compose) | 13 | 18 |

Problemas encontrados no código (corrigir, não só atualizar):

1. **Falha de segurança em `POST /users`:** marcado `isPublic`, protegido só por uma chave estática (`x-api-key`) e **emite sessão para qualquer `externalId` enviado**. Quem tem a chave entra como qualquer usuário.
2. **Auth pela metade:** `modules/auth/login.ts` e `renew-session.ts` são stubs (`userId = 123`, função que não retorna). Mistura `@fastify/session` (cookie, estado no servidor) com JWT no header `x-user-session`, e Redis só para isso.
3. **Código morto/duplicado:** `isRouteAllowed`/`verifyVerb` copiados em `verify-auth.ts` e `verify-token.ts`, nunca usados.
4. **Acoplamento ao banco:** `modules/users/functions/*` importam `db` e `tables` do Drizzle direto. Não há onde plugar outro banco.
5. **Sobras de projeto anterior:** nome `milk-man-backend`, compose `farm-manager-backend`, tags Swagger `Animal`/`Production`, arquivo `Farm.session.sql`, workflows de deploy Railway com nome de serviço fixo, rede docker externa `observability`.
6. **Inconsistências:** `require('@scalar/...')` num projeto TS, aliases misturados (`@env` e `~/env`), `console.log`/`console.error` em vez do logger do Fastify, sem desligamento gracioso, `printRoutes` sempre no boot, Dockerfile que roda `tail -f /dev/null`.
7. **Sem testes, sem CI de verificação, sem instruções para agentes.**

## Decisões já tomadas (pelo dono do projeto)

- Fastify continua sendo o framework.
- Template **genérico**, com **Postgres (Drizzle) e MongoDB** prontos e **bem documentados**.
- **O banco não é escolhido por variável de ambiente.** O template mantém a configuração dos dois; ao criar um projeto, o dev ou o agente escolhe o banco e **apaga manualmente o módulo do outro** (código, dependências, compose, scripts, env, testes, CI, docs). **Não há comando de seleção**: o README tem uma seção explicando o passo a passo.
- **Cada banco tem seus próprios models/schemas**: Drizzle (`pgTable`) no Postgres; tipos de documento, coleções, índices e validador `$jsonSchema` no Mongo. Não existe um schema "neutro" que gere os dois.
- **Node 24 LTS + pnpm** (sempre a última versão do pnpm, fixada em `packageManager`). Bun descartado.
- **tsdown** como bundler (no lugar do tsup).
- **Sempre a última versão estável** de cada dependência no momento da implementação.
- Preparado para uso com **Claude Code e Codex**.

## Decisões propostas (do design; o agente pode ajustar, registrando o porquê em `docs/decisoes.md`)

| # | Decisão | Motivo |
|---|---|---|
| P1 | Código de cada banco isolado por **convenção de nome**: pastas `src/infra/db/postgres/` e `src/infra/db/mongo/`, arquivos `*.postgres.ts` / `*.mongo.ts` (e testes `*.postgres.test.ts` / `*.mongo.test.ts`). O único ponto que escolhe o banco é `src/infra/db/index.ts` (um re-export). No template ele aponta para Postgres por padrão; os testes usam os dois adaptadores diretamente | Quem remove o banco descartado acha tudo por nome (`find`/`grep`), sem precisar entender o código; trocar de banco não toca rota nem serviço |
| P2 | Seção **"Escolhendo o banco"** no README, com checklist manual por banco: apagar pastas/arquivos do outro banco; ajustar `src/infra/db/index.ts`; remover dependências (`drizzle-orm`, `drizzle-kit`, `postgres` ↔ `mongodb`), serviço do compose, scripts `db:*`/`test:*`, variáveis do `.env.example`, entrada da matriz do CI e trechos das docs; conferir sobras com um `grep` indicado na seção; rodar `pnpm install` e `pnpm check`. Também entra no `AGENTS.md` | Sem script frágil para manter; o passo é raro (uma vez por projeto) e fica explícito para humanos e agentes |
| P3 | Models/schemas **nativos de cada banco** dentro do adaptador: `schema.postgres.ts` (Drizzle) e `schema.mongo.ts` (tipo do documento, nome da coleção, índices, `$jsonSchema`). O módulo define só os **tipos de domínio** (o que o serviço vê) e cada adaptador mapeia linha/documento ↔ domínio | Cada banco é usado do jeito dele (ex.: `_id`/ObjectId no Mongo, `uuid` no Postgres) sem abstração que esconda diferenças |
| P4 | MongoDB pelo **driver oficial `mongodb`**, sem Mongoose | Menos camadas; validação de entrada já fica no Zod |
| P5 | **Repositório por módulo**: interface com só os métodos que o módulo usa + um adaptador por banco. Uma **suíte de contrato** por repositório roda contra os dois adaptadores no template (e contra o que sobrar no projeto) | Garante que os dois bancos se comportam igual enquanto coexistem |
| P6 | Remover `@fastify/session` e Redis; auth **stateless**: access token JWT curto + refresh token guardado no banco (pelo repositório, funciona nos dois) | Um mecanismo só, sem dependência extra |
| P7 | Login por **Google ID token** como provedor de exemplo do módulo `auth` (o app envia o token do Google; o servidor confere com `jose`/JWKS do Google e emite os tokens próprios); lista opcional de e-mails permitidos | É o padrão dos próximos projetos (inclusive a granja) e corrige a falha do item 1 |
| P8 | Zod 4 + `fastify-type-provider-zod` 7 para validação e OpenAPI; Scalar em `/docs` | Mesmo stack, atualizado |
| P9 | Estrutura por módulo: `routes.ts` (HTTP fino) → `service.ts` (regra, retorna `Result`) → `repository.ts` (interface + tipos de domínio) + `repository.postgres.ts` / `repository.mongo.ts` + `schema.postgres.ts` / `schema.mongo.ts` | Camadas claras para humanos e agentes; nomes que deixam claro o que apagar ao escolher o banco |
| P10 | `docker compose` com **profiles** `postgres` e `mongo` no template (Mongo como replica set de 1 nó, para permitir transações); ao escolher o banco, o serviço descartado é removido junto | Subir só o banco desejado enquanto os dois coexistem |
| P11 | Testes de integração com bancos reais via compose (ou Testcontainers), não mocks | O valor do template é os dois adaptadores funcionarem de verdade |
| P12 | Versão do pnpm fixada no campo `packageManager` do `package.json` (`pnpm@<última>`), `engines.node` em `>=24`; atualizar com `pnpm self-update` | Todo mundo (e o CI) usa o mesmo pnpm |

**A confirmar com o dono antes da fase 1:**
- Renomear o repositório (o nome `fastify-drizzle` deixa de descrever o template), ex.: `fastify-api-template`.
- Manter o módulo de exemplo `todo` (sugestão: sim, como módulo de referência com CRUD nos dois bancos).

## Fases

Cada fase termina com o comando de verificação passando e um commit (Conventional Commits). Em toda fase que adiciona ou atualiza dependências: `pnpm add <pkg>@latest` (ou `pnpm up --latest`) e conferir changelogs de versões maiores.

### Fase 0: Limpeza e base
- Remover sobras (item 5 do diagnóstico), código morto (item 3), `Farm.session.sql`, workflows Railway.
- Atualizar pnpm para a última versão (`packageManager`), Node 24 (`.tool-versions`, Docker), TypeScript, Biome 2 (migrar config com `biome migrate`), `tsx`.
- Trocar tsup por **tsdown** (`tsdown.config.ts`, saída ESM, alvo `node24`); remover `tsup.config.*`.
- Aliases únicos (`~/` só), ESM consistente, logger do Fastify, desligamento gracioso (`SIGTERM`/`SIGINT` fecham servidor e conexões), `printRoutes` só em dev.
- `env.ts` com Zod 4, separado por grupos (http, auth, db), falha clara no boot. Sem `DB_DRIVER`: as variáveis de cada banco ficam no grupo do próprio banco (`src/infra/db/postgres/env.ts`, `src/infra/db/mongo/env.ts`), para serem apagadas junto.
- Separar `buildApp()` (cria a instância, usada pelos testes com `app.inject`) de `index.ts` (sobe o servidor).
- **Pronto quando:** `pnpm check` (lint + typecheck + test) roda, ainda sem testes de banco; `pnpm build` gera o bundle com tsdown; `GET /` e `GET /health` respondem.

### Fase 1: Atualizar Fastify e validação
- Fastify, plugins `@fastify/*`, Zod 4, type provider 7, Swagger + Scalar (sem `require`), todos na última versão estável.
- Reescrever `generate-schema-handler` e `parse-zod-error` para a API nova; padronizar o formato de erro (`{ error, message, statusCode, issues? }`).
- Primeiros testes: rota raiz, health, erro de validação 400, erro 500 sem vazar stack em produção.
- **Pronto quando:** testes de HTTP passam; `/docs` mostra o OpenAPI.

### Fase 2: Os dois bancos, lado a lado
- `src/infra/db/postgres/` (Drizzle, client, `drizzle.config.ts`, migrations, env) e `src/infra/db/mongo/` (client, criação de índices e validadores no boot, env). Cada um exporta a mesma forma: `connect(env)` → `{ repositories, close }`.
- `src/infra/db/index.ts`: único ponto de escolha (re-export do banco ativo; Postgres no template).
- Padrão de repositório por módulo (P5/P9), models nativos por banco (P3) e injeção pela raiz de composição (`buildApp({ repositories })`).
- Módulos `users` e `todo` com os dois adaptadores e a **suíte de contrato**.
- Compose com profiles (P10); Postgres na última versão estável; Mongo atual em replica set de 1 nó.
- Scripts: `db:up:postgres`, `db:up:mongo`, `db:migrate` (Postgres), `db:indexes` (Mongo), `test:postgres`, `test:mongo`, `test:all`.
- **Pronto quando:** a mesma suíte de contrato passa contra os dois adaptadores.

### Fase 3: Auth
- Remover session/Redis (P6). Plugin `auth` com `app.authenticate` (preHandler) e `request.user` tipado.
- Fluxo P7: `POST /auth/google` (ID token → usuário criado/atualizado → access + refresh), `POST /auth/refresh` (rotação do refresh, o antigo deixa de valer), `POST /auth/logout`.
- Refresh tokens com repositório próprio (interface + `*.postgres.ts` / `*.mongo.ts`), seguindo o mesmo padrão.
- Lista opcional de e-mails permitidos por env; recusa com 403.
- Testes: token inválido, expirado, e-mail fora da lista, rotação do refresh, refresh reutilizado. Verificação do Google com JWKS falso nos testes.
- **Pronto quando:** não existe mais nenhuma rota que emita sessão sem prova de identidade (corrige o item 1 do diagnóstico).

### Fase 4: Preparo para agentes
- `AGENTS.md` (canônico, lido pelo Codex) e `CLAUDE.md` contendo só `@AGENTS.md`. Conteúdo: o que é o projeto, comandos, mapa de pastas, camadas e direção de imports, convenção de nomes por banco, regras que não podem ser quebradas, como verificar antes de dar por pronto, estilo, regra de sempre instalar a última versão estável.
- `docs/` com receitas curtas e testadas:
  - `adicionar-modulo.md` (do zero até rota + testes nos dois bancos, ou só no banco escolhido);
  - a escolha de banco fica no README (seção "Escolhendo o banco", ver Fase 5) e o `AGENTS.md` aponta para ela;
  - `auth.md` (fluxo e como trocar/adicionar provedor);
  - `decisoes.md` (o porquê das decisões acima).
- Gerador de módulo (`pnpm new:module <nome>`) que cria rotas, serviço, interface e testes, e **só os adaptadores/schemas dos bancos presentes** no projeto (detecta pelas pastas em `src/infra/db/`).
- Comando único `pnpm check`; hooks com Husky + lint-staged + commitlint (Conventional Commits).
- Regras de fronteira automatizadas (Biome ou `dependency-cruiser`): `routes`/`service` não importam adaptador nem schema de banco; arquivo `*.postgres.ts` não importa `*.mongo.ts` (e vice-versa); fora de `src/infra/db/index.ts`, ninguém importa `infra/db/postgres` ou `infra/db/mongo`; módulo não importa outro módulo por caminho interno.
- `.env.example` completo e comentado.
- **Pronto quando:** um agente novo, lendo só o `AGENTS.md`, cria um módulo de teste com o gerador e o `pnpm check` passa no template; e, seguindo só a seção "Escolhendo o banco" do README, remove um dos bancos numa cópia do repositório com o `pnpm check` passando e o `grep` de sobras vazio (fazer o teste uma vez para cada banco).

### Fase 5: Build, container, CI e README
- Dockerfile multi-stage de produção (pnpm via `packageManager`, build com tsdown → imagem enxuta, usuário não-root, `HEALTHCHECK`); dev pelo devcontainer.
- Devcontainer atualizado (sem rede externa obrigatória; Node 24; pnpm atual; extensão do Biome).
- GitHub Actions: `check` em todo PR com matriz `postgres`/`mongo`. Sem deploy (fica para cada projeto).
- README curto: o que é, como começar em 5 passos, link para `AGENTS.md` e `docs/`, e a seção **"Escolhendo o banco"**:
  - por que o template traz os dois e por que o projeto final deve ficar com um só;
  - checklist "Ficar com Postgres" e checklist "Ficar com Mongo": pastas e padrões de arquivo a apagar (`src/infra/db/<outro>/`, `**/*.<outro>.ts`, `**/*.<outro>.test.ts`), ajuste de `src/infra/db/index.ts`, `pnpm remove` das dependências, serviço do compose, scripts do `package.json`, variáveis do `.env.example`, matriz do CI, trechos do `AGENTS.md`/docs e a própria seção do README;
  - comando de conferência de sobras (ex.: `grep -rniE "mongo|drizzle|postgres" --exclude-dir=node_modules .`, ajustado ao banco removido) e `pnpm install && pnpm check` no fim.
- **Pronto quando:** CI verde nos dois bancos; a imagem sobe e responde `/health`; a seção "Escolhendo o banco" foi seguida à risca para cada banco numa cópia e funcionou.

## Riscos

- `fastify-type-provider-zod` 7 e Zod 4 mudaram a API: o gerador de schema e o tratamento de erro precisam ser reescritos, não só atualizados.
- TypeScript 7 (compilador nativo) pode ter diferenças com plugins/ferramentas (tsdown gera `.d.ts` via TS); se travar, ficar no 6.x e registrar em `decisoes.md`.
- tsdown ainda é 0.x: mudanças de config entre versões menores são possíveis. Manter a config mínima e conferir o changelog a cada atualização.
- pnpm 10+ bloqueia scripts de `postinstall` por padrão: liberar só o necessário em `onlyBuiltDependencies` (ou equivalente da versão atual).
- "Sempre a última versão" pode trazer quebra: atualizar uma dependência maior por commit, com `pnpm check` passando.
- A remoção manual do banco descartado depende de todo código de banco seguir a convenção de nomes e de a checklist do README estar atualizada. Por isso as regras de fronteira (Fase 4) são obrigatórias, e toda mudança que adicionar arquivo, dependência, variável ou script de banco precisa atualizar a checklist (regra no `AGENTS.md`).
- Abstrair demais o banco: a interface é **por módulo**, com os métodos que o módulo usa, e os models são nativos de cada banco. Não criar um "repositório genérico" nem um schema único que tente esconder as diferenças entre SQL e documentos.
- Transações no Mongo exigem replica set; documentar e já subir assim no compose.
