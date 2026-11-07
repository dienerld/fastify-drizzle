import { type Connection, isValidObjectId, type Types } from 'mongoose'

import type { Todo, TodoRepository } from './repository'
import { type TodoDoc, todoModel } from './schema.mongo'

type Lean = TodoDoc & { _id: Types.ObjectId }

const toDomain = (doc: Lean): Todo => ({
  id: doc._id.toHexString(),
  userId: doc.userId.toHexString(),
  title: doc.title,
  description: doc.description,
  completed: doc.completed,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
})

// `isValidObjectId` also accepts 12-char strings; we only want 24 hex chars.
const isId = (id: string) => /^[0-9a-f]{24}$/i.test(id) && isValidObjectId(id)

export function createTodoRepositoryMongo(conn: Connection): TodoRepository {
  const Todos = todoModel(conn)

  return {
    async list(userId) {
      if (!isId(userId)) return []
      const docs = await Todos.find({ userId })
        .sort({ createdAt: -1, _id: -1 })
        .lean<Lean[]>()
      return docs.map(toDomain)
    },

    async get(userId, id) {
      if (!isId(userId) || !isId(id)) return null
      const doc = await Todos.findOne({ _id: id, userId }).lean<Lean>()
      return doc ? toDomain(doc) : null
    },

    async create(userId, input) {
      const doc = await Todos.create({
        userId,
        title: input.title,
        description: input.description ?? null,
        completed: input.completed ?? false,
      })
      return toDomain(doc.toObject() as Lean)
    },

    async update(userId, id, patch) {
      if (!isId(userId) || !isId(id)) return null
      const set = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined)
      )
      const doc = await Todos.findOneAndUpdate({ _id: id, userId }, set, {
        returnDocument: 'after',
        runValidators: true,
      }).lean<Lean>()
      return doc ? toDomain(doc) : null
    },

    async delete(userId, id) {
      if (!isId(userId) || !isId(id)) return false
      const res = await Todos.deleteOne({ _id: id, userId })
      return res.deletedCount > 0
    },
  }
}
