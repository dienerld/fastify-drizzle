/** A refresh token as stored: only the SHA-256 of the opaque token, never the token. */
export type RefreshToken = {
  id: string
  userId: string
  /** All tokens descended from the same login share one family. */
  familyId: string
  tokenHash: string
  expiresAt: Date
  /** Set when rotated, logged out or revoked with its family. */
  revokedAt: Date | null
  /** The token issued in exchange when this one was rotated. */
  replacedById: string | null
  createdAt: Date
}

export type NewRefreshToken = {
  userId: string
  familyId: string
  tokenHash: string
  expiresAt: Date
}

export interface RefreshTokenRepository {
  create(input: NewRefreshToken): Promise<RefreshToken>
  /** `null` when no token has this hash. */
  findByHash(tokenHash: string): Promise<RefreshToken | null>
  /**
   * Atomically marks `id` as rotated (revoked + `replacedById`), only if it was
   * still active. Returns `false` when it already was revoked, which means
   * two requests raced with the same token: only one may win.
   */
  markRotated(id: string, replacedById: string): Promise<boolean>
  /** Revokes every still-active token of the family. Returns how many. */
  revokeFamily(familyId: string): Promise<number>
}
