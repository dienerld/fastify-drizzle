import { type Connection, type Model, Schema } from 'mongoose'

export type UserDoc = {
  fullName: string
  firstName: string
  lastName: string
  email: string
  externalId: string
  picture: string | null
  createdAt: Date
  updatedAt: Date
}

export const userSchema = new Schema<UserDoc>(
  {
    fullName: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    externalId: { type: String, required: true, unique: true },
    picture: { type: String, default: null },
  },
  { collection: 'users', timestamps: true, versionKey: false }
)

/** Models live on a dedicated connection (see `infra/db/mongo/connect.ts`). */
export const userModel = (conn: Connection) =>
  (conn.models.User as Model<UserDoc> | undefined) ??
  conn.model<UserDoc>('User', userSchema)
