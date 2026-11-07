import { and, desc, eq } from 'drizzle-orm'

import type { PostgresDb } from '~/infra/db/postgres/client'
import { isUuid } from '~/infra/db/postgres/uuid'
import type { {{Name}}Repository } from './repository'
import { type {{Name}}Row, {{pluralCamel}} } from './schema.postgres'

const toDomain = (row: {{Name}}Row) => ({
  id: row.id,
  userId: row.userId,
  name: row.name,
  description: row.description,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

const owned = (userId: string, id: string) =>
  and(eq({{pluralCamel}}.userId, userId), eq({{pluralCamel}}.id, id))

export function create{{Name}}RepositoryPostgres(db: PostgresDb): {{Name}}Repository {
  return {
    async list(userId) {
      if (!isUuid(userId)) return []
      const rows = await db
        .select()
        .from({{pluralCamel}})
        .where(eq({{pluralCamel}}.userId, userId))
        .orderBy(desc({{pluralCamel}}.createdAt))
      return rows.map(toDomain)
    },

    async get(userId, id) {
      if (!isUuid(userId) || !isUuid(id)) return null
      const [row] = await db.select().from({{pluralCamel}}).where(owned(userId, id))
      return row ? toDomain(row) : null
    },

    async create(userId, input) {
      const [row] = await db
        .insert({{pluralCamel}})
        .values({
          userId,
          name: input.name,
          description: input.description ?? null,
        })
        .returning()
      return toDomain(row as {{Name}}Row)
    },

    async update(userId, id, patch) {
      if (!isUuid(userId) || !isUuid(id)) return null
      const [row] = await db
        .update({{pluralCamel}})
        .set({ ...definedOnly(patch), updatedAt: new Date() })
        .where(owned(userId, id))
        .returning()
      return row ? toDomain(row) : null
    },

    async delete(userId, id) {
      if (!isUuid(userId) || !isUuid(id)) return false
      const rows = await db
        .delete({{pluralCamel}})
        .where(owned(userId, id))
        .returning({ id: {{pluralCamel}}.id })
      return rows.length > 0
    },
  }
}

function definedOnly<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>
}
