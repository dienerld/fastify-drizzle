import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from 'jose'

export type GoogleIdentity = {
  /** Stable Google account id. */
  sub: string
  email: string
  name: string
  picture: string | null
}

/** Throws when the ID token is invalid for any reason. */
export type GoogleVerifier = (idToken: string) => Promise<GoogleIdentity>

const GOOGLE_JWKS_URL = new URL('https://www.googleapis.com/oauth2/v3/certs')
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

/** Google's public keys (cached and refreshed by `jose`). Tests pass a local set instead. */
export const googleRemoteKeys = () => createRemoteJWKSet(GOOGLE_JWKS_URL)

export function createGoogleVerifier(opts: {
  clientId: string
  keys: JWTVerifyGetKey
}): GoogleVerifier {
  return async idToken => {
    const { payload } = await jwtVerify(idToken, opts.keys, {
      issuer: GOOGLE_ISSUERS,
      audience: opts.clientId,
      algorithms: ['RS256'],
      requiredClaims: ['sub', 'email', 'exp'],
    })
    if (payload.email_verified !== true) {
      throw new Error('Google email is not verified')
    }
    const email = String(payload.email)
    return {
      sub: String(payload.sub),
      email,
      name: typeof payload.name === 'string' ? payload.name : email,
      picture: typeof payload.picture === 'string' ? payload.picture : null,
    }
  }
}
