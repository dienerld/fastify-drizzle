import { type Connection, isValidObjectId, type Types } from 'mongoose'

import type { User, UserRepository } from './repository'
import { type UserDoc, userModel } from './schema.mongo'

type Lean = UserDoc & { _id: Types.ObjectId }

const toDomain = (doc: Lean): User => ({
  id: doc._id.toHexString(),
  email: doc.email,
  name: doc.name,
  googleSub: doc.googleSub,
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

    async upsertByGoogleSub(profile) {
      const run = () =>
        Users.findOneAndUpdate(
          { googleSub: profile.googleSub },
          {
            $set: {
              email: profile.email,
              name: profile.name,
              picture: profile.picture ?? null,
            },
          },
          { upsert: true, returnDocument: 'after', runValidators: true }
        ).lean<Lean>()
      let doc: Lean | null
      try {
        doc = await run()
      } catch (err) {
        // two concurrent upserts can race on the unique index: retry once
        if ((err as { code?: number }).code !== 11000) throw err
        doc = await run()
      }
      return toDomain(doc as Lean)
    },
  }
}
