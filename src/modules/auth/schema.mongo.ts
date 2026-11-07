import { type Connection, type Model, Schema, type Types } from 'mongoose'

export type RefreshTokenDoc = {
  userId: Types.ObjectId
  familyId: string
  tokenHash: string
  expiresAt: Date
  revokedAt: Date | null
  replacedById: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

export const refreshTokenSchema = new Schema<RefreshTokenDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedById: { type: Schema.Types.ObjectId, default: null },
  },
  { collection: 'refresh_tokens', timestamps: true, versionKey: false }
)

// Safety net: MongoDB itself removes a token once it has expired (TTL index,
// checked about once a minute). Revoked-but-not-yet-expired tokens are removed
// by the periodic cleanup (`deleteExpired`), after the retention period.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

/** Models live on a dedicated connection (see `infra/db/mongo/connect.ts`). */
export const refreshTokenModel = (conn: Connection) =>
  (conn.models.RefreshToken as Model<RefreshTokenDoc> | undefined) ??
  conn.model<RefreshTokenDoc>('RefreshToken', refreshTokenSchema)
