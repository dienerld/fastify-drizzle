/**
 * Module generator: `pnpm new:module <name> [--plural <plural>] [--no-http-tests] [--no-wire]`
 *
 * Creates `src/modules/<name>/` from `scripts/templates/module/*.tpl` (a
 * user-scoped, protected CRUD modelled on `todo`), generating adapters, schemas
 * and tests only for the databases present in `src/infra/db/`. Then wires the
 * module into the composition root and prints what is left to do by hand.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const templates = join(import.meta.dirname, 'templates', 'module')

// --- input ------------------------------------------------------------------

const NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
const RESERVED = new Set(['auth', 'users', 'todo', 'infra', 'http', 'utils'])

export type Names = ReturnType<typeof namesFor>

export function validateName(name: string): string | null {
  if (!NAME_RE.test(name) || name.length > 40) {
    return `Invalid name "${name}": use kebab-case (letters, digits and hyphens, starting with a letter, max 40 chars), e.g. "invoice" or "blog-post".`
  }
  return null
}

export function pluralize(word: string): string {
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`
  return `${word}s`
}

const pascal = (kebab: string) =>
  kebab.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase())
const camel = (kebab: string) => {
  const p = pascal(kebab)
  return p.charAt(0).toLowerCase() + p.slice(1)
}

export function namesFor(kebab: string, pluralKebab = pluralize(kebab)) {
  return {
    kebab,
    Name: pascal(kebab),
    camel: camel(kebab),
    words: kebab.replaceAll('-', ' '),
    pluralKebab,
    PluralPascal: pascal(pluralKebab),
    pluralCamel: camel(pluralKebab),
    pluralSnake: pluralKebab.replaceAll('-', '_'),
    pluralWords: pluralKebab.replaceAll('-', ' '),
  }
}

function render(template: string, names: Names): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = (names as Record<string, string>)[key]
    if (value === undefined) throw new Error(`Unknown template token: ${key}`)
    return value
  })
}

// --- wiring helpers ---------------------------------------------------------

const manual: string[] = []
const wired: string[] = []
const notes: string[] = []
const touched = new Set<string>()

/** Applies `edit` to a file; records a manual step when the anchor is missing. */
function wire(
  file: string,
  what: string,
  edit: (src: string) => string | null,
  manualHint: string,
  optional = false
) {
  const path = join(root, file)
  if (!existsSync(path)) {
    if (!optional) manual.push(`${file}: file not found. ${manualHint}`)
    return
  }
  const src = readFileSync(path, 'utf8')
  const out = edit(src)
  if (out === null) {
    manual.push(`${file}: ${manualHint}`)
    return
  }
  if (out !== src) {
    writeFileSync(path, out)
    touched.add(file)
  }
  wired.push(`${file}: ${what}`)
}

/** Inserts `line` after the last line matching `re`. Returns null if none matches. */
function insertAfterLast(src: string, re: RegExp, line: string) {
  const lines = src.split('\n')
  let idx = -1
  lines.forEach((l, i) => {
    if (re.test(l)) idx = i
  })
  if (idx === -1) return null
  lines.splice(idx + 1, 0, line)
  return lines.join('\n')
}

/** Adds `line` before the closing token of a block that starts at `open`. */
function insertInBlock(src: string, open: RegExp, close: string, line: string) {
  const start = src.search(open)
  if (start === -1) return null
  const end = src.indexOf(close, start)
  if (end === -1) return null
  return `${src.slice(0, end)}\n${line}${src.slice(end)}`
}

// --- main -------------------------------------------------------------------

function main(argv: string[]) {
  const args = argv.slice(2)
  const flag = (name: string) => args.includes(`--${name}`)
  const plIdx = args.indexOf('--plural')
  const pluralArg = plIdx >= 0 ? args[plIdx + 1] : undefined
  const positional = args.filter(
    (a, i) => !a.startsWith('--') && args[i - 1] !== '--plural'
  )

  if (positional.length !== 1 || flag('help')) {
    console.error(
      'Usage: pnpm new:module <name> [--plural <plural>] [--no-http-tests] [--no-wire]\n' +
        '  <name>             kebab-case singular, e.g. invoice or blog-post\n' +
        '  --plural <plural>  kebab-case plural when it is irregular (default: simple English rules)\n' +
        '  --no-http-tests    skip routes.contract.ts and the routes.<db>.test.ts files\n' +
        '  --no-wire          only create files; do not edit existing ones'
    )
    process.exit(flag('help') ? 0 : 1)
  }

  const name = positional[0] as string
  const invalid = validateName(name)
  if (invalid) fatal(invalid)
  if (pluralArg !== undefined) {
    const bad = validateName(pluralArg)
    if (bad) fatal(`--plural: ${bad}`)
  }
  if (RESERVED.has(name)) fatal(`"${name}" is reserved or already exists.`)

  const names = namesFor(name, pluralArg)
  if (RESERVED.has(names.pluralKebab) || names.pluralKebab === name) {
    fatal(
      `Plural "${names.pluralKebab}" collides with the singular or a reserved name. Pass --plural <plural>.`
    )
  }
  const dir = join(root, 'src', 'modules', name)
  if (existsSync(dir)) fatal(`src/modules/${name} already exists.`)

  const hasPostgres = existsSync(join(root, 'src/infra/db/postgres'))
  const hasMongo = existsSync(join(root, 'src/infra/db/mongo'))
  if (!hasPostgres && !hasMongo) {
    fatal('Neither src/infra/db/postgres nor src/infra/db/mongo exists.')
  }
  const httpTests = !flag('no-http-tests')

  // 1. files
  const files = [
    'repository.ts',
    'service.ts',
    'routes.ts',
    'repository.contract.ts',
    ...(httpTests ? ['routes.contract.ts'] : []),
  ]
  const dbs = [
    ...(hasPostgres ? (['postgres'] as const) : []),
    ...(hasMongo ? (['mongo'] as const) : []),
  ]
  for (const db of dbs) {
    files.push(
      `schema.${db}.ts`,
      `repository.${db}.ts`,
      `repository.${db}.test.ts`,
      ...(httpTests ? [`routes.${db}.test.ts`] : [])
    )
  }

  mkdirSync(dir, { recursive: true })
  const created: string[] = []
  for (const file of files) {
    const tpl = readFileSync(join(templates, `${file}.tpl`), 'utf8')
    const rel = `src/modules/${name}/${file}`
    writeFileSync(join(root, rel), render(tpl, names))
    touched.add(rel)
    created.push(rel)
  }

  // 2. wiring
  if (!flag('no-wire')) wireAll(names, { hasPostgres, hasMongo, httpTests })

  // 3. format everything we touched
  const biome = join(root, 'node_modules/.bin/biome')
  if (existsSync(biome)) {
    spawnSync(biome, ['check', '--write', ...touched], {
      cwd: root,
      stdio: 'ignore',
    })
  }

  report(names, created, { hasPostgres, hasMongo, httpTests }, flag('no-wire'))
}

function wireAll(
  n: Names,
  { hasPostgres, hasMongo, httpTests }: Record<string, boolean>
) {
  const mod = `~/modules/${n.kebab}`

  wire(
    'src/infra/repositories.ts',
    `${n.pluralCamel}: ${n.Name}Repository`,
    src => {
      const withImport = insertAfterLast(
        src,
        /^import type .* from '~\/modules\//,
        `import type { ${n.Name}Repository } from '${mod}/repository'`
      )
      return (
        withImport &&
        insertInBlock(
          withImport,
          /export type Repositories = \{/,
          '\n}',
          `  ${n.pluralCamel}: ${n.Name}Repository`
        )
      )
    },
    `add \`${n.pluralCamel}: ${n.Name}Repository\` to the \`Repositories\` type.`
  )

  wire(
    'src/app.ts',
    `registers ${n.camel}Routes at /${n.pluralKebab}`,
    src => {
      const withImport = insertAfterLast(
        src,
        /^import \{ \w+Routes \} from '~\/modules\//,
        `import { ${n.camel}Routes } from '${mod}/routes'`
      )
      return (
        withImport?.replace(
          '\n  await app.ready()',
          `\n  await app.register(${n.camel}Routes, {\n    prefix: '/${n.pluralKebab}',\n    ${n.pluralCamel}: repositories.${n.pluralCamel},\n  })\n\n  await app.ready()`
        ) ?? null
      )
    },
    `import ${n.camel}Routes and \`app.register(${n.camel}Routes, { prefix: '/${n.pluralKebab}', ${n.pluralCamel}: repositories.${n.pluralCamel} })\` before \`app.ready()\`.`
  )

  wire(
    'src/test/no-repositories.ts',
    `${n.pluralCamel}: unusable(...)`,
    src =>
      src.includes('} as Repositories')
        ? src.replace(
            '} as Repositories',
            `  ${n.pluralCamel}: unusable('${n.pluralCamel}'),\n} as Repositories`
          )
        : null,
    `add \`${n.pluralCamel}: unusable('${n.pluralCamel}')\`.`
  )

  wire(
    'src/http/auth-required.test.ts',
    `expects 401 on /${n.pluralKebab} without a token`,
    src => {
      const open = 'const protectedRoutes: [string, string][] = ['
      const id = '00000000-0000-4000-8000-000000000000'
      return src.includes(open)
        ? src.replace(
            open,
            `${open}\n    ['GET', '/${n.pluralKebab}'],\n    ['POST', '/${n.pluralKebab}'],\n    ['GET', '/${n.pluralKebab}/${id}'],\n    ['PATCH', '/${n.pluralKebab}/${id}'],\n    ['DELETE', '/${n.pluralKebab}/${id}'],`
          )
        : null
    },
    `add the routes of /${n.pluralKebab} to \`protectedRoutes\` (a 401 without a token is expected for all).`
  )

  if (hasPostgres) {
    const create = `create${n.Name}RepositoryPostgres`
    wire(
      'src/infra/db/postgres/connect.ts',
      create,
      src => {
        const withImport = insertAfterLast(
          src,
          /^import \{ create\w+ \} from '~\/modules\//,
          `import { ${create} } from '${mod}/repository.postgres'`
        )
        return (
          withImport &&
          insertInBlock(
            withImport,
            /repositories: \{/,
            '\n    },',
            `      ${n.pluralCamel}: ${create}(db),`
          )
        )
      },
      `import ${create} and add \`${n.pluralCamel}: ${create}(db)\` to the returned repositories.`
    )
    wire(
      'src/infra/db/postgres/schema.ts',
      `exports table ${n.pluralCamel}`,
      src =>
        `${src.trimEnd()}\nexport { ${n.pluralCamel} } from '${mod}/schema.postgres'\n`,
      `add \`export { ${n.pluralCamel} } from '${mod}/schema.postgres'\`.`
    )
    wire(
      'src/test/db.postgres.ts',
      `truncates ${n.pluralSnake}`,
      src =>
        src.includes('truncate table ')
          ? src.replace('truncate table ', `truncate table ${n.pluralSnake}, `)
          : null,
      `add \`${n.pluralSnake}\` to the \`truncate table\` list.`
    )
  }

  if (hasMongo) {
    const create = `create${n.Name}RepositoryMongo`
    wire(
      'src/infra/db/mongo/connect.ts',
      create,
      src => {
        const withImport = insertAfterLast(
          src,
          /^import \{ create\w+ \} from '~\/modules\//,
          `import { ${create} } from '${mod}/repository.mongo'`
        )
        return (
          withImport &&
          insertInBlock(
            withImport,
            /repositories: \{/,
            '\n    },',
            `      ${n.pluralCamel}: ${create}(conn),`
          )
        )
      },
      `import ${create} and add \`${n.pluralCamel}: ${create}(conn)\` to the returned repositories.`
    )
    wire(
      'src/infra/db/mongo/models.ts',
      `${n.camel}Model in allModels`,
      src => {
        const withImport = insertAfterLast(
          src,
          /^import \{ \w+Model \} from '~\/modules\//,
          `import { ${n.camel}Model } from '${mod}/schema.mongo'`
        )
        return (
          withImport &&
          insertInBlock(
            withImport,
            /export const allModels/,
            '\n]',
            `  ${n.camel}Model(conn),`
          )
        )
      },
      `import ${n.camel}Model and add \`${n.camel}Model(conn)\` to \`allModels\`.`
    )
  }

  if (!httpTests) {
    notes.push(
      'HTTP tests were skipped (--no-http-tests): add routes.contract.ts and routes.<db>.test.ts later (copy them from src/modules/todo).'
    )
  }
}

function report(
  n: Names,
  created: string[],
  db: Record<string, boolean>,
  noWire: boolean
) {
  const out: string[] = []
  out.push(`Module "${n.kebab}" created (route /${n.pluralKebab}):`)
  for (const f of created) out.push(`  + ${f}`)
  if (!noWire) {
    out.push('\nWired automatically:')
    for (const w of wired) out.push(`  ~ ${w}`)
  }
  const needsAnchor = noWire
    ? [
        'Register everything by hand (see docs/adicionar-modulo.md, step "Ligar o modulo"): src/infra/repositories.ts, src/app.ts, src/test/no-repositories.ts, src/http/auth-required.test.ts' +
          (db.hasPostgres
            ? ', src/infra/db/postgres/{connect,schema}.ts, src/test/db.postgres.ts'
            : '') +
          (db.hasMongo ? ', src/infra/db/mongo/{connect,models}.ts' : '') +
          '.',
      ]
    : manual
  if (needsAnchor.length) {
    out.push('\nCould not wire (do by hand):')
    for (const m of needsAnchor) out.push(`  ! ${m}`)
  }
  for (const note of notes) out.push(`\nNote: ${note}`)
  out.push('\nNext steps:')
  let i = 1
  out.push(
    `  ${i++}. Edit the fields: they are \`name\` and \`description\` in repository.ts, routes.ts${db.hasPostgres ? ', schema.postgres.ts, repository.postgres.ts' : ''}${db.hasMongo ? ', schema.mongo.ts, repository.mongo.ts' : ''} and in the contract tests.`
  )
  if (db.hasPostgres) {
    out.push(
      `  ${i++}. Postgres migration: pnpm db:generate (review the SQL in src/infra/db/postgres/migrations/), then pnpm db:migrate on your dev database.`
    )
  }
  if (db.hasMongo) {
    out.push(
      `  ${i++}. Mongo: nothing to migrate. Indexes are synced on boot (or pnpm db:indexes).`
    )
  }
  out.push(
    `  ${i++}. Business rules go in service.ts (return Result, never throw HTTP errors); queries stay in the adapters, always filtered by userId.`
  )
  out.push(
    `  ${i++}. Verify: pnpm check:fast, then pnpm db:up:${db.hasPostgres ? 'postgres' : 'mongo'}${db.hasPostgres && db.hasMongo ? ' && pnpm db:up:mongo' : ''} && pnpm check.`
  )
  console.log(out.join('\n'))
}

function fatal(message: string): never {
  console.error(message)
  process.exit(1)
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv)
