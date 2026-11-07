// Architecture boundaries (`pnpm lint:deps`, part of `check` and `check:fast`).
// Why these rules exist: docs/decisoes.md ("Fronteiras") and AGENTS.md.
// The point is that removing the unused database stays a mechanical, manual
// job: all database code must live in files the naming convention can find.

// Files that belong to a database (the naming convention).
const POSTGRES = String.raw`\.postgres(\.test)?\.ts$|^src/infra/db/postgres/|^src/test/(db|global-setup)\.postgres\.ts$`
const MONGO = String.raw`\.mongo(\.test)?\.ts$|^src/infra/db/mongo/|^src/test/db\.mongo\.ts$`

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'No import cycles (type imports included).',
      from: {},
      to: { circular: true },
    },

    // --- adapters stay behind the database folder -------------------------
    {
      name: 'postgres-adapters-only-from-postgres-files',
      severity: 'error',
      comment:
        'routes/service/app/etc. must not import *.postgres.ts files: they depend on the repository interface only.',
      from: { pathNot: POSTGRES },
      to: { path: String.raw`\.postgres\.ts$` },
    },
    {
      name: 'mongo-adapters-only-from-mongo-files',
      severity: 'error',
      comment:
        'routes/service/app/etc. must not import *.mongo.ts files: they depend on the repository interface only.',
      from: { pathNot: MONGO },
      to: { path: String.raw`\.mongo\.ts$` },
    },
    {
      name: 'postgres-folder-is-private',
      severity: 'error',
      comment:
        'Only src/infra/db/index.ts (the single selection point) and Postgres-specific files may import src/infra/db/postgres/**.',
      from: { pathNot: `${POSTGRES}|^src/infra/db/index\\.ts$` },
      to: { path: '^src/infra/db/postgres/' },
    },
    {
      name: 'mongo-folder-is-private',
      severity: 'error',
      comment:
        'Only src/infra/db/index.ts (the single selection point) and Mongo-specific files may import src/infra/db/mongo/**.',
      from: { pathNot: `${MONGO}|^src/infra/db/index\\.ts$` },
      to: { path: '^src/infra/db/mongo/' },
    },
    {
      name: 'postgres-not-mongo',
      severity: 'error',
      comment: 'Postgres files must not import Mongo files.',
      from: { path: POSTGRES },
      to: { path: MONGO },
    },
    {
      name: 'mongo-not-postgres',
      severity: 'error',
      comment: 'Mongo files must not import Postgres files.',
      from: { path: MONGO },
      to: { path: POSTGRES },
    },

    // --- database libraries stay in adapters ------------------------------
    {
      name: 'postgres-libs-only-in-postgres-files',
      severity: 'error',
      comment:
        'drizzle-orm / postgres may only be imported by Postgres-specific files.',
      from: { pathNot: POSTGRES },
      to: {
        path: String.raw`(^|/)node_modules/(drizzle-orm|postgres)(/|$)`,
      },
    },
    {
      name: 'mongo-libs-only-in-mongo-files',
      severity: 'error',
      comment: 'mongoose may only be imported by Mongo-specific files.',
      from: { pathNot: MONGO },
      to: { path: String.raw`(^|/)node_modules/mongoose(/|$)` },
    },

    // --- modules are isolated ---------------------------------------------
    {
      name: 'no-cross-module-internals',
      severity: 'error',
      comment:
        "A module may import another module's repository.ts (types) or, for foreign keys, its schema.<db>.ts. Nothing else (service, routes, tokens...).",
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/',
        pathNot: [
          '^src/modules/$1/',
          '^src/modules/[^/]+/repository\\.ts$',
          '^src/modules/[^/]+/schema\\.(postgres|mongo)\\.ts$',
        ],
      },
    },
    {
      name: 'utils-are-leaves',
      severity: 'error',
      comment: 'src/utils is generic: it must not know modules, infra or http.',
      from: { path: '^src/utils/' },
      to: { path: '^src/(modules|infra|http)/' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.d\\.ts$' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
}
