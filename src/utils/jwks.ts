import type { JwtHeader, SigningKeyCallback } from 'jsonwebtoken'
import jwksClient, { type SigningKey } from 'jwks-rsa'

const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs'

const client = jwksClient({
  jwksUri: GOOGLE_JWKS_URI,
  cache: true,
  cacheMaxAge: 3600000, // Cache for 1 hour
  rateLimit: true,
  jwksRequestsPerMinute: 5,
})

export function getKey(header: JwtHeader, callback: SigningKeyCallback): void {
  client.getSigningKey(header.kid, (err: Error | null, key?: SigningKey) => {
    if (err) {
      console.error('Error getting signing key:', err)
      return callback(err)
    }
    const signingKey = key?.getPublicKey()
    callback(null, signingKey)
  })
}
