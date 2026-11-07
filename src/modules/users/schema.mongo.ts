import { type Connection, type Model, Schema } from 'mongoose'

export type UserDoc = {
  email: string
  name: string
  googleSub: string
  picture: string | null
  createdAt: Date
  updatedAt: Date
}

export const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true },
    name: { type: String, required: true },
    googleSub: { type: String, required: true, unique: true },
    picture: { type: String, default: null },
  },
  { collection: 'users', timestamps: true, versionKey: false }
)

/** Models live on a dedicated connection (see `infra/db/mongo/connect.ts`). */
export const userModel = (conn: Connection) =>
  (conn.models.User as Model<UserDoc> | undefined) ??
  conn.model<UserDoc>('User', userSchema)
