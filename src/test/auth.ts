import type { FastifyInstance } from 'fastify'
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTPayload,
  SignJWT,
} from 'jose'

import { env } from '~/env'

export type FakeGoogle = {
  /** Pass as `buildApp({ auth: { googleKeys } })`: a local JWKS, no network. */
  googleKeys: ReturnType<typeof createLocalJWKSet>
  /** Signs a Google-like ID token. Override any claim, or the key/expiry. */
  idToken: (opts?: IdTokenOptions) => Promise<string>
}

export type IdTokenOptions = {
  claims?: JWTPayload
  /** Seconds from now; negative = already expired. Default 300. */
  expiresIn?: number
  /** Sign with a key the JWKS does not know. */
  unknownKey?: boolean
}

/** A fake Google: our own RSA key pair, exposed as a JWKS. */
export async function createFakeGoogle(): Promise<FakeGoogle> {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const stranger = await generateKeyPair('RS256')
  const jwk = { ...(await exportJWK(publicKey)), alg: 'RS256', kid: 'test-key' }
  const googleKeys = createLocalJWKSet({ keys: [jwk] })

  return {
    googleKeys,
    async idToken({ claims = {}, expiresIn = 300, unknownKey } = {}) {
      const now = Math.floor(Date.now() / 1000)
      return new SignJWT({
        sub: 'google-sub-1',
        email: 'ada@example.com',
        email_verified: true,
        name: 'Ada Lovelace',
        picture: 'http://p/ada.png',
        iss: 'https://accounts.google.com',
        aud: env.auth.googleClientId,
        ...claims,
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuedAt(now - 10)
        .setExpirationTime(now + expiresIn)
        .sign(unknownKey ? stranger.privateKey : privateKey)
    },
  }
}

export type TestSession = {
  accessToken: string
  refreshToken: string
  user: { id: string; email: string }
}

/** Logs in through `POST /auth/google` with a fake Google token. */
export async function login(
  app: FastifyInstance,
  google: FakeGoogle,
  claims: JWTPayload = {}
): Promise<TestSession> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/google',
    payload: { idToken: await google.idToken({ claims }) },
  })
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.body}`)
  return res.json()
}

export const bearer = (accessToken: string) => ({
  authorization: `Bearer ${accessToken}`,
})
