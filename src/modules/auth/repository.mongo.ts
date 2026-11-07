import { type Connection, isValidObjectId, type Types } from 'mongoose'

import type { RefreshToken, RefreshTokenRepository } from './repository'
import { type RefreshTokenDoc, refreshTokenModel } from './schema.mongo'

type Lean = RefreshTokenDoc & { _id: Types.ObjectId }

const toDomain = (doc: Lean): RefreshToken => ({
  id: doc._id.toHexString(),
  userId: doc.userId.toHexString(),
  familyId: doc.familyId,
  tokenHash: doc.tokenHash,
  expiresAt: doc.expiresAt,
  revokedAt: doc.revokedAt,
  replacedById: doc.replacedById?.toHexString() ?? null,
  createdAt: doc.createdAt,
})

// `isValidObjectId` also accepts 12-char strings; we only want 24 hex chars.
const isId = (id: string) => /^[0-9a-f]{24}$/i.test(id) && isValidObjectId(id)

export function createRefreshTokenRepositoryMongo(
  conn: Connection
): RefreshTokenRepository {
  const Tokens = refreshTokenModel(conn)

  return {
    async create(input) {
      const doc = await Tokens.create(input)
      return toDomain(doc.toObject() as Lean)
    },

    async findByHash(tokenHash) {
      const doc = await Tokens.findOne({ tokenHash }).lean<Lean>()
      return doc ? toDomain(doc) : null
    },

    async markRotated(id, replacedById) {
      if (!isId(id) || !isId(replacedById)) return false
      const res = await Tokens.updateOne(
        { _id: id, revokedAt: null },
        { $set: { revokedAt: new Date(), replacedById } }
      )
      return res.modifiedCount > 0
    },

    async revokeFamily(familyId) {
      const res = await Tokens.updateMany(
        { familyId, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      )
      return res.modifiedCount
    },
  }
}
