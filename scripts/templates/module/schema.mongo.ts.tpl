import { type Connection, type Model, Schema, type Types } from 'mongoose'

export type {{Name}}Doc = {
  userId: Types.ObjectId
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

export const {{camel}}Schema = new Schema<{{Name}}Doc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
  },
  { collection: '{{pluralSnake}}', timestamps: true, versionKey: false }
)
{{camel}}Schema.index({ userId: 1, createdAt: -1 })

/** Models live on a dedicated connection (see `infra/db/mongo/connect.ts`). */
export const {{camel}}Model = (conn: Connection) =>
  (conn.models.{{Name}} as Model<{{Name}}Doc> | undefined) ??
  conn.model<{{Name}}Doc>('{{Name}}', {{camel}}Schema)
