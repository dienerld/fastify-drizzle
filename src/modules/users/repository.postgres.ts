import { eq } from 'drizzle-orm'

import type { PostgresDb } from '~/infra/db/postgres/client'
import { isUuid } from '~/infra/db/postgres/uuid'
import type { UserRepository } from './repository'
import { type UserRow, users } from './schema.postgres'

const toDomain = (row: UserRow) => ({
  id: row.id,
  email: row.email,
  name: row.name,
  googleSub: row.googleSub,
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

    async upsertByGoogleSub(profile) {
      const values = {
        email: profile.email,
        name: profile.name,
        picture: profile.picture ?? null,
      }
      const [row] = await db
        .insert(users)
        .values({ googleSub: profile.googleSub, ...values })
        .onConflictDoUpdate({
          target: users.googleSub,
          set: { ...values, updatedAt: new Date() },
        })
        .returning()
      return toDomain(row as UserRow)
    },
  }
}
