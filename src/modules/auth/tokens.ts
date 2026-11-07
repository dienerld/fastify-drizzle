import { createHash, randomBytes } from 'node:crypto'
import { jwtVerify, SignJWT } from 'jose'

export type AccessTokenClaims = { id: string; email: string }

/** Short-lived, stateless access tokens: HS256 JWT signed with `JWT_SECRET`. */
export function createAccessTokens(opts: {
  secret: string
  ttlSeconds: number
}) {
  const key = new TextEncoder().encode(opts.secret)

  return {
    sign({ id, email }: AccessTokenClaims): Promise<string> {
      const now = Math.floor(Date.now() / 1000)
      return new SignJWT({ email })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(id)
        .setIssuedAt(now)
        .setExpirationTime(now + opts.ttlSeconds)
        .sign(key)
    },

    /** Throws when the token is malformed, tampered with or expired. */
    async verify(token: string): Promise<AccessTokenClaims> {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
        requiredClaims: ['sub', 'exp'],
      })
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string'
      ) {
        throw new Error('Malformed access token')
      }
      return { id: payload.sub, email: payload.email }
    },
  }
}

export type AccessTokens = ReturnType<typeof createAccessTokens>

/** Opaque random refresh token (256 bits). Only its hash is stored. */
export const newRefreshToken = () => randomBytes(32).toString('base64url')

/** SHA-256 hex. Fast hashing is fine: the input is already high-entropy. */
export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')
