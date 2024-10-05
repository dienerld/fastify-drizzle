import {
  type JwtHeader,
  type SigningKeyCallback,
  verify,
  type VerifyErrors,
} from 'jsonwebtoken'

import { env } from '@env'
import { getKey } from '@utils/jwks'

export async function verifyGoogleToken(token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // @ts-expect-error - overload mismatch
    verify(
      token,
      getKey,
      {
        audience: env.GOOGLE_CLIENT_ID,
        issuer: 'https://accounts.google.com',
        algorithms: ['RS256'],
      },
      (err: VerifyErrors | null, decoded: object | undefined) => {
        if (err) {
          console.error('Error verifying token:', err)
          reject(err)
        } else if (decoded && typeof decoded === 'object' && 'sub' in decoded) {
          resolve(decoded.sub as string)
        } else {
          reject(new Error('Invalid token structure'))
        }
      }
    )
  })
}
