import { type Connection, isValidObjectId, type Types } from 'mongoose'

import type { {{Name}}, {{Name}}Repository } from './repository'
import { type {{Name}}Doc, {{camel}}Model } from './schema.mongo'

type Lean = {{Name}}Doc & { _id: Types.ObjectId }

const toDomain = (doc: Lean): {{Name}} => ({
  id: doc._id.toHexString(),
  userId: doc.userId.toHexString(),
  name: doc.name,
  description: doc.description,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
})

// `isValidObjectId` also accepts 12-char strings; we only want 24 hex chars.
const isId = (id: string) => /^[0-9a-f]{24}$/i.test(id) && isValidObjectId(id)

export function create{{Name}}RepositoryMongo(conn: Connection): {{Name}}Repository {
  const {{PluralPascal}} = {{camel}}Model(conn)

  return {
    async list(userId) {
      if (!isId(userId)) return []
      const docs = await {{PluralPascal}}.find({ userId })
        .sort({ createdAt: -1, _id: -1 })
        .lean<Lean[]>()
      return docs.map(toDomain)
    },

    async get(userId, id) {
      if (!isId(userId) || !isId(id)) return null
      const doc = await {{PluralPascal}}.findOne({ _id: id, userId }).lean<Lean>()
      return doc ? toDomain(doc) : null
    },

    async create(userId, input) {
      const doc = await {{PluralPascal}}.create({
        userId,
        name: input.name,
        description: input.description ?? null,
      })
      return toDomain(doc.toObject() as Lean)
    },

    async update(userId, id, patch) {
      if (!isId(userId) || !isId(id)) return null
      const set = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined)
      )
      const doc = await {{PluralPascal}}.findOneAndUpdate({ _id: id, userId }, set, {
        returnDocument: 'after',
        runValidators: true,
      }).lean<Lean>()
      return doc ? toDomain(doc) : null
    },

    async delete(userId, id) {
      if (!isId(userId) || !isId(id)) return false
      const res = await {{PluralPascal}}.deleteOne({ _id: id, userId })
      return res.deletedCount > 0
    },
  }
}
