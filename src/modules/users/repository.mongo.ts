import { type Connection, isValidObjectId, type Types } from 'mongoose'

import type { User, UserRepository } from './repository'
import { type UserDoc, userModel } from './schema.mongo'

type Lean = UserDoc & { _id: Types.ObjectId }

const toDomain = (doc: Lean): User => ({
  id: doc._id.toHexString(),
  fullName: doc.fullName,
  firstName: doc.firstName,
  lastName: doc.lastName,
  email: doc.email,
  externalId: doc.externalId,
  picture: doc.picture,
  createdAt: doc.createdAt,
})

// `isValidObjectId` also accepts 12-char strings; we only want 24 hex chars.
const isId = (id: string) => /^[0-9a-f]{24}$/i.test(id) && isValidObjectId(id)

export function createUserRepositoryMongo(conn: Connection): UserRepository {
  const Users = userModel(conn)

  return {
    async findById(id) {
      if (!isId(id)) return null
      const doc = await Users.findById(id).lean<Lean>()
      return doc ? toDomain(doc) : null
    },

    async findByExternalId(externalId) {
      const doc = await Users.findOne({ externalId }).lean<Lean>()
      return doc ? toDomain(doc) : null
    },

    async create(input) {
      const doc = await Users.create({
        ...input,
        picture: input.picture ?? null,
      })
      return toDomain(doc.toObject() as Lean)
    },
  }
}
