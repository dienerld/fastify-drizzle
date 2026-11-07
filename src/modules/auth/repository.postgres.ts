import { and, eq, isNull } from 'drizzle-orm'

import type { PostgresDb } from '~/infra/db/postgres/client'
import { isUuid } from '~/infra/db/postgres/uuid'
import type { RefreshToken, RefreshTokenRepository } from './repository'
import { type RefreshTokenRow, refreshTokens } from './schema.postgres'

const toDomain = (row: RefreshTokenRow): RefreshToken => ({
  id: row.id,
  userId: row.userId,
  familyId: row.familyId,
  tokenHash: row.tokenHash,
  expiresAt: row.expiresAt,
  revokedAt: row.revokedAt,
  replacedById: row.replacedById,
  createdAt: row.createdAt,
})

export function createRefreshTokenRepositoryPostgres(
  db: PostgresDb
): RefreshTokenRepository {
  return {
    async create(input) {
      const [row] = await db.insert(refreshTokens).values(input).returning()
      return toDomain(row as RefreshTokenRow)
    },

    async findByHash(tokenHash) {
      const [row] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
      return row ? toDomain(row) : null
    },

    async markRotated(id, replacedById) {
      if (!isUuid(id) || !isUuid(replacedById)) return false
      const rows = await db
        .update(refreshTokens)
        .set({ revokedAt: new Date(), replacedById })
        .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)))
        .returning({ id: refreshTokens.id })
      return rows.length > 0
    },

    async revokeFamily(familyId) {
      if (!isUuid(familyId)) return 0
      const rows = await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.familyId, familyId),
            isNull(refreshTokens.revokedAt)
          )
        )
        .returning({ id: refreshTokens.id })
      return rows.length
    },
  }
}
