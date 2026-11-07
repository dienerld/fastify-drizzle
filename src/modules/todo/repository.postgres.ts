import { and, desc, eq } from 'drizzle-orm'

import type { PostgresDb } from '~/infra/db/postgres/client'
import { isUuid } from '~/infra/db/postgres/uuid'
import type { TodoRepository } from './repository'
import { type TodoRow, todos } from './schema.postgres'

const toDomain = (row: TodoRow) => ({
  id: row.id,
  userId: row.userId,
  title: row.title,
  description: row.description,
  completed: row.completed,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

const owned = (userId: string, id: string) =>
  and(eq(todos.userId, userId), eq(todos.id, id))

export function createTodoRepositoryPostgres(db: PostgresDb): TodoRepository {
  return {
    async list(userId) {
      if (!isUuid(userId)) return []
      const rows = await db
        .select()
        .from(todos)
        .where(eq(todos.userId, userId))
        .orderBy(desc(todos.createdAt))
      return rows.map(toDomain)
    },

    async get(userId, id) {
      if (!isUuid(userId) || !isUuid(id)) return null
      const [row] = await db.select().from(todos).where(owned(userId, id))
      return row ? toDomain(row) : null
    },

    async create(userId, input) {
      const [row] = await db
        .insert(todos)
        .values({
          userId,
          title: input.title,
          description: input.description ?? null,
          completed: input.completed ?? false,
        })
        .returning()
      return toDomain(row as TodoRow)
    },

    async update(userId, id, patch) {
      if (!isUuid(userId) || !isUuid(id)) return null
      const [row] = await db
        .update(todos)
        .set({ ...definedOnly(patch), updatedAt: new Date() })
        .where(owned(userId, id))
        .returning()
      return row ? toDomain(row) : null
    },

    async delete(userId, id) {
      if (!isUuid(userId) || !isUuid(id)) return false
      const rows = await db
        .delete(todos)
        .where(owned(userId, id))
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
