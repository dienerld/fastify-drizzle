import { eq } from 'drizzle-orm'

import type { PostgresDb } from '~/infra/db/postgres/client'
import { isUuid } from '~/infra/db/postgres/uuid'
import type { UserRepository } from './repository'
import { type UserRow, users } from './schema.postgres'

const toDomain = (row: UserRow) => ({
  id: row.id,
  fullName: row.fullName,
  firstName: row.firstName,
  lastName: row.lastName,
  email: row.email,
  externalId: row.externalId,
  picture: row.picture,
  createdAt: row.createdAt,
})

export function createUserRepositoryPostgres(db: PostgresDb): UserRepository {
  return {
    async findById(id) {
      if (!isUuid(id)) return null
      const [row] = await db.select().from(users).where(eq(users.id, id))
      return row ? toDomain(row) : null
    },

    async findByExternalId(externalId) {
      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.externalId, externalId))
      return row ? toDomain(row) : null
    },

    async create(input) {
      const [row] = await db
        .insert(users)
        .values({ ...input, picture: input.picture ?? null })
        .returning()
      return toDomain(row as UserRow)
    },
  }
}
