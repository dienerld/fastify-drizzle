# Receita: adicionar um módulo

Do zero até rota + testes. Funciona com os dois bancos ou só com o que sobrou: o gerador detecta `src/infra/db/postgres` e `src/infra/db/mongo` e só cria o que existe.

## 1. Gerar

```bash
pnpm new:module invoice                     # nome em kebab-case, singular
pnpm new:module person --plural people      # plural irregular
pnpm new:module invoice --no-http-tests     # sem routes.contract.ts e routes.<banco>.test.ts
pnpm new:module invoice --no-wire           # só cria os arquivos (não edita os existentes)
```

Nome inválido (maiúscula, `/`, `..`, `_`, vazio) é recusado; módulo existente ou nome reservado (`auth`, `users`, `todo`...) também. Rota gerada: `/<plural>` (`invoices`, `blog-posts`).

O gerador cria `src/modules/<nome>/`, um CRUD **protegido e por usuário** baseado em `todo` (campos `name` e `description`):

| Arquivo | |
| --- | --- |
| `repository.ts`, `service.ts`, `routes.ts` | domínio e HTTP (sempre) |
| `repository.contract.ts`, `routes.contract.ts` | suítes compartilhadas |
| `schema.postgres.ts`, `repository.postgres.ts`, `*.postgres.test.ts` | só se `src/infra/db/postgres` existe |
| `schema.mongo.ts`, `repository.mongo.ts`, `*.mongo.test.ts` | só se `src/infra/db/mongo` existe |

E **liga o módulo sozinho** (edições por âncora; se alguma falhar, o gerador diz qual e o que fazer):

- `src/infra/repositories.ts`: campo no tipo `Repositories`;
- `src/app.ts`: `app.register(<nome>Routes, { prefix, <plural>: repositories.<plural> })`;
- `src/test/no-repositories.ts`: proxy que falha alto; `src/http/auth-required.test.ts`: rotas do módulo na lista `protectedRoutes` (401 sem token);
- Postgres: `src/infra/db/postgres/connect.ts`, `schema.ts` (export da tabela) e a lista do `truncate` em `src/test/db.postgres.ts`;
- Mongo: `src/infra/db/mongo/connect.ts` e `models.ts` (`allModels`).

## 2. Ajustar o módulo

1. **Campos**: troque `name`/`description` pelos seus. Mantenha em sincronia: `repository.ts` (tipos), `routes.ts` (schemas Zod de resposta/entrada), `schema.postgres.ts` + `repository.postgres.ts` (`toDomain`, `create`), `schema.mongo.ts` + `repository.mongo.ts` (`toDomain`, `create`) e os testes de contrato.
2. **Regras de negócio** em `service.ts`: retorne `ok(valor)` ou `fail({ code, message })` (`not_found`, `conflict`, `unauthorized`, `forbidden`). Nunca lance erro HTTP no service; a rota faz `throw toHttpError(result.error)`.
3. **Consultas** só nos adaptadores, **sempre filtradas por `userId`**; id malformado devolve `null`/`false`.
4. **Rotas**: continuam com `app.addHook('onRequest', app.authenticate)` no topo e `request.user.id` como dono. Documente com `routeSchema({ protected: true, notFound: true, ... })`.
5. Precisa de dados de **outro módulo**? Não importe o interior dele. Receba a interface (`import type { XRepository } from '~/modules/x/repository'`) como parâmetro do seu service e passe pela raiz de composição (`app.ts`).
6. Sem dono por usuário (dado global)? Remova o `userId` de ponta a ponta (interface, adaptadores, contratos) e decida conscientemente se a rota é pública; o `AGENTS.md` exige `authenticate` em módulo protegido.

## 3. Migração (só Postgres)

```bash
pnpm db:generate     # gera o SQL em src/infra/db/postgres/migrations/ (revise e commite)
pnpm db:migrate      # aplica no banco de dev
```

Os testes aplicam as migrações sozinhos. No Mongo não há migração: coleção e índices são criados no boot (`pnpm db:indexes` faz isso isolado).

## 4. Verificar

```bash
pnpm check:fast                                   # sem banco
pnpm db:up:postgres && pnpm db:up:mongo           # os que existirem
pnpm check                                        # tudo, com banco
```

`lint:deps` falha se o módulo importar adaptador, `drizzle-orm`/`mongoose`/`postgres` fora de arquivo de banco, ou o interior de outro módulo.

## Sem o gerador (manual)

Copie `src/modules/todo/` trocando nomes e faça as ligações da lista do passo 1. Use `--no-wire` para gerar só os arquivos e ligar na mão.

## Se o módulo precisar do Redis

Não acesse o cache de dentro do módulo. Receba `Cache` por parâmetro do plugin/service, passado pela raiz de composição (`buildApp({ cache })`), e trate `cache` ausente (ele é opcional).
