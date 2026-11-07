import { type Connection, isValidObjectId, type Types } from 'mongoose'

import type { Todo, TodoRepository } from './repository'
import { type TodoDoc, todoModel } from './schema.mongo'

type Lean = TodoDoc & { _id: Types.ObjectId }

const toDomain = (doc: Lean): Todo => ({
  id: doc._id.toHexString(),
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
    async list() {
      const docs = await Todos.find()
        .sort({ createdAt: -1, _id: -1 })
        .lean<Lean[]>()
      return docs.map(toDomain)
    },

    async get(id) {
      if (!isId(id)) return null
      const doc = await Todos.findById(id).lean<Lean>()
      return doc ? toDomain(doc) : null
    },

    async create(input) {
      const doc = await Todos.create({
        title: input.title,
        description: input.description ?? null,
        completed: input.completed ?? false,
      })
      return toDomain(doc.toObject() as Lean)
    },

    async update(id, patch) {
      if (!isId(id)) return null
      const set = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined)
      )
      const doc = await Todos.findByIdAndUpdate(id, set, {
        returnDocument: 'after',
        runValidators: true,
      }).lean<Lean>()
      return doc ? toDomain(doc) : null
    },

    async delete(id) {
      if (!isId(id)) return false
      const res = await Todos.deleteOne({ _id: id })
      return res.deletedCount > 0
    },
  }
}
