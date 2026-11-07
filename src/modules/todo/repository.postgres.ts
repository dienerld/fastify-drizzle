import { desc, eq } from 'drizzle-orm'

import type { PostgresDb } from '~/infra/db/postgres/client'
import { isUuid } from '~/infra/db/postgres/uuid'
import type { TodoRepository } from './repository'
import { type TodoRow, todos } from './schema.postgres'

const toDomain = (row: TodoRow) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  completed: row.completed,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

export function createTodoRepositoryPostgres(db: PostgresDb): TodoRepository {
  return {
    async list() {
      const rows = await db.select().from(todos).orderBy(desc(todos.createdAt))
      return rows.map(toDomain)
    },

    async get(id) {
      if (!isUuid(id)) return null
      const [row] = await db.select().from(todos).where(eq(todos.id, id))
      return row ? toDomain(row) : null
    },

    async create(input) {
      const [row] = await db
        .insert(todos)
        .values({
          title: input.title,
          description: input.description ?? null,
          completed: input.completed ?? false,
        })
        .returning()
      return toDomain(row as TodoRow)
    },

    async update(id, patch) {
      if (!isUuid(id)) return null
      const [row] = await db
        .update(todos)
        .set({ ...definedOnly(patch), updatedAt: new Date() })
        .where(eq(todos.id, id))
        .returning()
      return row ? toDomain(row) : null
    },

    async delete(id) {
      if (!isUuid(id)) return false
      const rows = await db
        .delete(todos)
        .where(eq(todos.id, id))
        .returning({ id: todos.id })
      return rows.length > 0
    },
  }
}

function definedOnly<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>
}
