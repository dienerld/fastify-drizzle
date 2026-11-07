import { fail, ok, type Result } from '~/utils/result'
import type { New{{Name}}, {{Name}}, {{Name}}Patch, {{Name}}Repository } from './repository'

const notFound = () =>
  fail({ code: 'not_found' as const, message: '{{Name}} not found' })

export function create{{Name}}Service({{pluralCamel}}: {{Name}}Repository) {
  return {
    async list(userId: string): Promise<Result<{{Name}}[]>> {
      return ok(await {{pluralCamel}}.list(userId))
    },

    async get(userId: string, id: string): Promise<Result<{{Name}}>> {
      const {{camel}} = await {{pluralCamel}}.get(userId, id)
      return {{camel}} ? ok({{camel}}) : notFound()
    },

    async create(userId: string, input: New{{Name}}): Promise<Result<{{Name}}>> {
      return ok(await {{pluralCamel}}.create(userId, input))
    },

    async update(
      userId: string,
      id: string,
      patch: {{Name}}Patch
    ): Promise<Result<{{Name}}>> {
      const {{camel}} = await {{pluralCamel}}.update(userId, id, patch)
      return {{camel}} ? ok({{camel}}) : notFound()
    },

    async remove(userId: string, id: string): Promise<Result<null>> {
      return (await {{pluralCamel}}.delete(userId, id)) ? ok(null) : notFound()
    },
  }
}

export type {{Name}}Service = ReturnType<typeof create{{Name}}Service>
