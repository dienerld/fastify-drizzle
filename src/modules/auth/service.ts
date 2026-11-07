import { randomUUID } from 'node:crypto'

import type { User, UserRepository } from '~/modules/users/repository'
import { fail, ok, type Result } from '~/utils/result'
import type { GoogleVerifier } from './google'
import type { RefreshToken, RefreshTokenRepository } from './repository'
import { type AccessTokens, hashToken, newRefreshToken } from './tokens'

export type AuthDeps = {
  users: UserRepository
  refreshTokens: RefreshTokenRepository
  accessTokens: AccessTokens
  verifyGoogle: GoogleVerifier
  accessTokenTtlSeconds: number
  refreshTokenTtlSeconds: number
  /** Lower-case emails. Empty means everyone is allowed. */
  allowedEmails: string[]
}

export type Session = {
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
  /** Access token lifetime in seconds. */
  expiresIn: number
  user: Pick<User, 'id' | 'email' | 'name' | 'picture'>
}

const unauthorized = (message: string) =>
  fail({ code: 'unauthorized' as const, message })

export function createAuthService(deps: AuthDeps) {
  const isAllowed = (email: string) =>
    deps.allowedEmails.length === 0 ||
    deps.allowedEmails.includes(email.toLowerCase())

  const forbidden = () =>
    fail({ code: 'forbidden' as const, message: 'Email not allowed' })

  /** Issues an access token and a new refresh token inside `familyId`. */
  async function issue(
    user: User,
    familyId: string
  ): Promise<{ session: Session; stored: RefreshToken }> {
    const refreshToken = newRefreshToken()
    const stored = await deps.refreshTokens.create({
      userId: user.id,
      familyId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + deps.refreshTokenTtlSeconds * 1000),
    })
    const accessToken = await deps.accessTokens.sign({
      id: user.id,
      email: user.email,
    })
    return {
      stored,
      session: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: deps.accessTokenTtlSeconds,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
        },
      },
    }
  }

  return {
    /** Proof of identity = a Google ID token that verifies. Nothing else issues tokens. */
    async loginWithGoogle(idToken: string): Promise<Result<Session>> {
      let identity: Awaited<ReturnType<GoogleVerifier>>
      try {
        identity = await deps.verifyGoogle(idToken)
      } catch {
        return unauthorized('Invalid Google token')
      }
      if (!isAllowed(identity.email)) return forbidden()

      const user = await deps.users.upsertByGoogleSub({
        googleSub: identity.sub,
        email: identity.email,
        name: identity.name,
        picture: identity.picture,
      })
      const { session } = await issue(user, randomUUID())
      return ok(session)
    },

    /**
     * Rotation: the presented token is revoked and replaced. Presenting a token
     * that was already rotated/revoked is reuse (likely theft): the whole
     * family is revoked so the legitimate holder must log in again.
     */
    async refresh(refreshToken: string): Promise<Result<Session>> {
      const current = await deps.refreshTokens.findByHash(
        hashToken(refreshToken)
      )
      if (!current) return unauthorized('Invalid refresh token')

      if (current.revokedAt) {
        await deps.refreshTokens.revokeFamily(current.familyId)
        return unauthorized('Refresh token reused')
      }
      if (current.expiresAt.getTime() <= Date.now()) {
        return unauthorized('Refresh token expired')
      }

      const user = await deps.users.findById(current.userId)
      if (!user) return unauthorized('Invalid refresh token')
      if (!isAllowed(user.email)) return forbidden()

      const { session, stored } = await issue(user, current.familyId)
      const won = await deps.refreshTokens.markRotated(current.id, stored.id)
      if (!won) {
        // lost a race with another request using the same token: treat as reuse
        await deps.refreshTokens.revokeFamily(current.familyId)
        return unauthorized('Refresh token reused')
      }
      return ok(session)
    },

    /** Ends the session: revokes the token's family. Idempotent, reveals nothing. */
    async logout(refreshToken: string): Promise<Result<null>> {
      const current = await deps.refreshTokens.findByHash(
        hashToken(refreshToken)
      )
      if (current) await deps.refreshTokens.revokeFamily(current.familyId)
      return ok(null)
    },
  }
}

export type AuthService = ReturnType<typeof createAuthService>
