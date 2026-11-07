# Autenticação

Stateless: o cliente prova identidade com um **ID token do Google**, troca por um **access token** (JWT curto) e um **refresh token** (opaco, rotativo, guardado no banco). Não há cookie nem sessão no servidor.

## Fluxo

```
cliente --POST /auth/google { idToken }--------> verifica o ID token no Google (JWKS)
        <-- { accessToken, refreshToken, tokenType: 'Bearer', expiresIn, user }
cliente --GET /todos  Authorization: Bearer <accessToken>--> 200
        (access expirou)
cliente --POST /auth/refresh { refreshToken }--> rotaciona: devolve novo par
cliente --POST /auth/logout  { refreshToken }--> revoga a sessão (sempre 204)
```

- **Login** (`POST /auth/google`): valida assinatura (RS256), `iss`, `aud` (= `GOOGLE_CLIENT_ID`), expiração e `email_verified === true`. Qualquer falha = 401 genérico. Se `ALLOWED_EMAILS` existe e o e-mail não está nela = 403. Depois cria/atualiza o usuário (por `googleSub`) e emite os tokens.
- **Access token**: JWT HS256 (`JWT_SECRET`), claims `sub` (id do usuário) e `email`, vida curta. Verificar **não consulta o banco**, então ele vale até expirar mesmo após logout (por isso é curto). O algoritmo é fixado: ID token do Google ou `alg: none` nunca passam como access token.
- **Refresh token**: 32 bytes aleatórios; só o SHA-256 fica no banco. Cada uso **rotaciona** (o antigo é revogado, nasce um novo na mesma `familyId`). Apresentar um token já usado/revogado é **reuso**: a família inteira é revogada e a resposta é 401 (o dono precisa logar de novo). Duas requisições simultâneas com o mesmo token: uma vence, a outra cai como reuso. Token desconhecido ou expirado = 401; e-mail que saiu da allowlist = 403.
- **Logout** revoga só a família daquele refresh token (outros dispositivos continuam).

## Variáveis de ambiente

| Variável | Padrão | Uso |
| --- | --- | --- |
| `JWT_SECRET` | obrigatória | assina o access token; 32+ caracteres (`openssl rand -base64 48`) |
| `GOOGLE_CLIENT_ID` | obrigatória | client id OAuth do app; é a `aud` esperada |
| `ACCESS_TOKEN_TTL` | `15m` | `<número><s\|m\|h\|d>` |
| `REFRESH_TOKEN_TTL` | `30d` | idem |
| `ALLOWED_EMAILS` | vazia (todos) | lista separada por vírgula, sem diferenciar maiúsculas |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW` | `300` / `1m` | limite global por IP |
| `RATE_LIMIT_AUTH_MAX` / `RATE_LIMIT_AUTH_WINDOW` | `20` / `1m` | limite de `/auth/*` (por IP; refresh/logout também por token) |
| `TRUST_PROXY` | `false` | IP real atrás de proxy: `true`, saltos (`1`) ou IPs/CIDRs |
| `TOKEN_CLEANUP_INTERVAL` | `1h` | período da limpeza de tokens expirados no processo; `0s` desliga |

Limite de requisições e limpeza de tokens têm as suas próprias variáveis (abaixo e em `.env.example`).

Crie o client id em Google Cloud Console (APIs e serviços → Credenciais → ID do cliente OAuth). O cliente (app mobile/SPA) obtém o ID token com o Google Sign-In e o envia a `/auth/google`.

## Rate limit

`@fastify/rate-limit`, registrado em `src/http/rate-limit.ts` (a config vem de `src/env.ts`):

- **Global**: `RATE_LIMIT_MAX` (padrão 300) requisições por `RATE_LIMIT_WINDOW` (`1m`), por IP, em todas as rotas. `/health` fica de fora (sondas de orquestrador chamam com frequência).
- **`/auth/*`**: orçamento próprio e mais estrito, `RATE_LIMIT_AUTH_MAX` (20) por `RATE_LIMIT_AUTH_WINDOW` (`1m`), por IP (contador separado do global). Em `/auth/refresh` e `/auth/logout` há ainda um limite **por token** (mesmo máximo e janela) para que um token vazado não seja martelado de vários IPs. A chave é o **SHA-256 do token**, nunca o token cru.
- **Resposta**: `429` no formato padrão `{ error: 'Too Many Requests', message, statusCode: 429 }`, com `retry-after` e os cabeçalhos `x-ratelimit-*`.
- **Armazenamento**: em memória (por processo) por padrão. Com `REDIS_URL` o mesmo cliente do `src/infra/cache/` guarda os contadores (prefixo `rl:`), compartilhados por todas as instâncias; se o Redis falhar o limite deixa passar (`skipOnError`) em vez de derrubar a API.
- **Atrás de proxy/load balancer**: `TRUST_PROXY` (`false`, `true`, número de saltos como `1`, ou IPs/CIDRs). Sem isso todos os clientes aparecem com o IP do proxy e dividem o mesmo limite. Ligue só quando houver um proxy confiável na frente (senão o cliente forja `X-Forwarded-For`).
- Testes: `src/http/rate-limit.contract.ts` (memória em `rate-limit.test.ts`, Redis em `rate-limit.redis.test.ts`). O `vitest.config.ts` sobe os limites de teste; os testes de limite passam valores pequenos por `buildApp({ rateLimit })`.

## Limpeza de refresh tokens

Sem limpeza, `refresh_tokens` só cresce. `RefreshTokenRepository.deleteExpired(before)` apaga **só os tokens com `expiresAt < before`** (a limpeza passa "agora"). Um token expirado já recebe 401 antes de qualquer outra checagem, então guardá-lo não serve para nada.

**Tokens revogados (rotacionados, logout, família revogada) não são apagados antes de expirar**, de propósito. Enquanto o token revogado existe, reapresentá-lo é detectado como **reuso** e revoga a família inteira. Se ele fosse apagado cedo, viraria "desconhecido" (401 simples) e a família de um atacante que já tivesse usado o token roubado continuaria viva. Consequência: o armazenamento fica limitado por `REFRESH_TOKEN_TTL` (30d por padrão): no máximo as linhas dos últimos 30 dias de logins e rotações. Para guardar menos, diminua o `REFRESH_TOKEN_TTL`. Token ativo nunca é apagado.

Quem executa:

| Onde | Como |
| --- | --- |
| Dentro do processo (Postgres e Mongo) | `setInterval(...).unref()` a cada `TOKEN_CLEANUP_INTERVAL` (padrão `1h`; `0s` desliga), sem passadas sobrepostas, erro só logado, parado no desligamento gracioso. Com várias instâncias todas rodam; o `DELETE` é idempotente. |
| Cron externo | `pnpm tokens:cleanup` (lê o `.env`, uma passada, imprime quantos apagou). Use com `TOKEN_CLEANUP_INTERVAL=0s` para desligar o timer interno. |
| Mongo, além disso | índice TTL em `expiresAt` (`expireAfterSeconds: 0`): o próprio MongoDB apaga os expirados (checa a cada ~1 min); com Mongo o timer interno é opcional. |

Testes: `repository.contract.ts` (`deleteExpired`, inclusive "revogado e não expirado não é apagado") nos dois bancos e `routes.contract.ts` ("reuso continua detectado depois da limpeza").

## Proteger rotas

No topo do plugin de rotas do módulo, **uma vez**:

```ts
export const meuModuloRoutes: FastifyPluginAsyncZod<{ itens: ItemRepository }> =
  async (app, { itens }) => {
    app.addHook('onRequest', app.authenticate)   // toda rota abaixo exige Bearer válido
    // ...
    app.get('', { schema: routeSchema({ protected: true, /* ... */ }) },
      async request => service.list(request.user.id))   // dono = token, nunca body/params
  }
```

- `app.authenticate` (hook de `src/modules/auth/plugin.ts`) valida o Bearer e preenche `request.user = { id, email }` (tipado em `src/@types/fastify.d.ts`). Sem token ou inválido = 401 no formato padrão, antes de qualquer handler.
- `routeSchema({ protected: true })` documenta o 401 e o `security: bearerAuth` no OpenAPI.
- Rota pública só em plugin separado (como `/auth/*` e `/health`), sem o hook.
- O hook no topo do plugin (e não rota a rota) garante que uma rota nova no mesmo plugin não esqueça a auth. `src/http/auth-required.test.ts` testa 401 sem token em toda rota protegida; o gerador já inclui as rotas do módulo novo na lista (`protectedRoutes`); ao criar rota na mão, adicione-a lá.

## Testar rotas autenticadas

`src/test/auth.ts`: `createFakeGoogle()` gera um par RSA e um JWKS local (sem rede), `login(app, google, { sub, email })` faz o login completo e devolve `{ accessToken, refreshToken, user }`, `bearer(token)` monta o header. `buildApp({ repositories, auth: { googleKeys: google.googleKeys, allowedEmails } })` injeta as chaves falsas. Veja `src/modules/todo/routes.contract.ts`.

## Adicionar ou trocar de provedor

O provedor aparece em três pontos: o **verificador** (`src/modules/auth/google.ts`, devolve `{ sub, email, name, picture }` ou lança), o **service** (`loginWithGoogle`) e a **identidade do usuário** (`googleSub` em `users`). Tokens, refresh e `authenticate` não dependem do provedor.

**Outro provedor OIDC com ID token (ex.: Apple, Microsoft)**, junto com o Google:

1. Crie `src/modules/auth/<provedor>.ts` com um verificador no mesmo formato (`jose.jwtVerify` + JWKS do provedor, `issuer`, `audience`, algoritmo fixo; exija e-mail verificado).
2. Identidade do usuário: hoje a chave única é `googleSub`. Para vários provedores, generalize para `provider` + `subject` (índice único no par) em `schema.postgres.ts` e `schema.mongo.ts` dos `users`, renomeie `upsertByGoogleSub` para `upsertByIdentity({ provider, subject, ... })` na interface, nos dois adaptadores e na suíte de contrato, e rode `pnpm db:generate`. Decida a política para o mesmo e-mail em provedores diferentes (vincular ou recusar); o padrão seguro é recusar.
3. Em `service.ts` adicione `loginWith<Provedor>` (mesma sequência: verificar → allowlist → upsert → `issue`) e em `routes.ts` uma rota `POST /auth/<provedor>`. Injete o verificador por `buildApp`/`AuthDeps`, como o Google, para testar sem rede.
4. Variáveis novas vão em `src/env.ts`, `.env.example` e na tabela acima. Testes: copie os casos do Google (assinatura, `aud`, `iss`, expirado, e-mail não verificado) em `auth/routes.contract.ts`.

**Trocar** o Google por outro: o mesmo caminho, removendo o verificador do Google (`google.ts`, `GOOGLE_CLIENT_ID`) depois de migrar a identidade.

**Login por senha ou outros fluxos** não existem no template; se adicionar, o resultado deve passar por `issue()` do service para manter a rotação de refresh.

## Em aberto (ver `docs/decisoes.md`)

Revogar todas as sessões de um usuário ainda não existe. O access token não é revogável antes de expirar (decisão do modelo stateless).
