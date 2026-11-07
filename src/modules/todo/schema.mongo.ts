import { type Connection, type Model, Schema } from 'mongoose'

export type TodoDoc = {
  title: string
  description: string | null
  completed: boolean
  createdAt: Date
  updatedAt: Date
}

export const todoSchema = new Schema<TodoDoc>(
  {
    title: { type: String, required: true },
    description: { type: String, default: null },
    completed: { type: Boolean, required: true, default: false },
  },
  { collection: 'todos', timestamps: true, versionKey: false }
)
todoSchema.index({ createdAt: -1 })

/** Models live on a dedicated connection (see `infra/db/mongo/connect.ts`). */
export const todoModel = (conn: Connection) =>
  (conn.models.Todo as Model<TodoDoc> | undefined) ??
  conn.model<TodoDoc>('Todo', todoSchema)
