import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { SignJWT } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '~/app'
import { env } from '~/env'
import type { Database } from '~/infra/repositories'
import { bearer, createFakeGoogle, type FakeGoogle } from '~/test/auth'
import { hashToken } from './tokens'

/**
 * The whole auth flow through HTTP (`app.inject`) over a real database, with a
 * fake Google (local JWKS, no network). `makeDb` returns EMPTY stores.
 */
export function describeAuthRoutes(makeDb: () => Promise<Database>) {
  describe('auth routes', () => {
    let db: Database
    let app: FastifyInstance
    let google: FakeGoogle

    beforeAll(async () => {
      google = await createFakeGoogle()
      db = await makeDb()
      app = await buildApp({
        repositories: db.repositories,
        auth: { googleKeys: google.googleKeys },
      })
    })

    afterAll(async () => {
      await app.close()
      await db.close()
    })

    const loginWith = (idToken: string, a: FastifyInstance = app) =>
      a.inject({ method: 'POST', url: '/auth/google', payload: { idToken } })

    const refresh = (refreshToken: string, a: FastifyInstance = app) =>
      a.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken },
      })

    const logout = (refreshToken: string) =>
      app.inject({
        method: 'POST',
        url: '/auth/logout',
        payload: { refreshToken },
      })

    const me = (accessToken?: string, authorization?: string) =>
      app.inject({
        method: 'GET',
        url: '/users/me',
        headers: accessToken
          ? bearer(accessToken)
          : authorization
            ? { authorization }
            : {},
      })

    const freshLogin = async (claims = {}) => {
      const res = await loginWith(
        await google.idToken({ claims: { sub: randomUUID(), ...claims } })
      )
      expect(res.statusCode).toBe(200)
      return res.json()
    }

    describe('POST /auth/google', () => {
      it('creates the user and returns an access and a refresh token', async () => {
        const res = await loginWith(
          await google.idToken({
            claims: {
              sub: 'create-1',
              email: 'new@example.com',
              name: 'New One',
            },
          })
        )
        expect(res.statusCode).toBe(200)
        const body = res.json()
        expect(body).toMatchObject({
          tokenType: 'Bearer',
          expiresIn: env.auth.accessTokenTtlSeconds,
          user: {
            email: 'new@example.com',
            name: 'New One',
            picture: 'http://p/ada.png',
          },
        })
        expect(body.accessToken.split('.')).toHaveLength(3)
        expect(body.refreshToken.length).toBeGreaterThanOrEqual(40)
        expect(
          await db.repositories.users.findById(body.user.id)
        ).toMatchObject({
          googleSub: 'create-1',
          email: 'new@example.com',
        })
      })

      it('a second login updates the profile and keeps the user id', async () => {
        const first = (
          await loginWith(
            await google.idToken({ claims: { sub: 'upd-1', name: 'Old Name' } })
          )
        ).json()
        const second = (
          await loginWith(
            await google.idToken({
              claims: {
                sub: 'upd-1',
                name: 'New Name',
                email: 'moved@example.com',
              },
            })
          )
        ).json()
        expect(second.user.id).toBe(first.user.id)
        expect(second.user).toMatchObject({
          name: 'New Name',
          email: 'moved@example.com',
        })
        expect(second.refreshToken).not.toBe(first.refreshToken)
      })

      it('stores only a hash of the refresh token', async () => {
        const { refreshToken } = await freshLogin()
        expect(
          await db.repositories.refreshTokens.findByHash(refreshToken)
        ).toBeNull()
        expect(
          await db.repositories.refreshTokens.findByHash(
            hashToken(refreshToken)
          )
        ).not.toBeNull()
      })

      const rejected: [string, () => Promise<string>][] = [
        ['a garbage token', async () => 'not-a-jwt'],
        [
          'a token signed by an unknown key',
          () => google.idToken({ unknownKey: true }),
        ],
        ['an expired token', () => google.idToken({ expiresIn: -60 })],
        [
          'an HS256 token (algorithm confusion)',
          () =>
            new SignJWT({ sub: 'x', email: 'x@x.com', email_verified: true })
              .setProtectedHeader({ alg: 'HS256' })
              .sign(new TextEncoder().encode('x'.repeat(32))),
        ],
        [
          'an unverified email',
          () => google.idToken({ claims: { email_verified: false } }),
        ],
        [
          'a missing email_verified claim',
          () => google.idToken({ claims: { email_verified: undefined } }),
        ],
        ['no email', () => google.idToken({ claims: { email: undefined } })],
      ]
      for (const [name, makeToken] of rejected) {
        it(`401 for ${name}`, async () => {
          const res = await loginWith(await makeToken())
          expect(res.statusCode).toBe(401)
          expect(res.json()).toMatchObject({
            error: 'Unauthorized',
            message: 'Invalid Google token',
            statusCode: 401,
          })
        })
      }

      it('401 for a token with the wrong audience', async () => {
        const res = await loginWith(
          await google.idToken({ claims: { aud: 'someone-elses-client-id' } })
        )
        expect(res.statusCode).toBe(401)
      })

      it('401 for a token with the wrong issuer', async () => {
        const res = await loginWith(
          await google.idToken({ claims: { iss: 'https://evil.example.com' } })
        )
        expect(res.statusCode).toBe(401)
      })

      it('accepts the bare accounts.google.com issuer', async () => {
        const res = await loginWith(
          await google.idToken({
            claims: { iss: 'accounts.google.com', sub: randomUUID() },
          })
        )
        expect(res.statusCode).toBe(200)
      })

      it('400 without an idToken', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/auth/google',
          payload: {},
        })
        expect(res.statusCode).toBe(400)
      })

      it('403 for an email outside ALLOWED_EMAILS (case-insensitive match for allowed)', async () => {
        const restricted = await buildApp({
          repositories: db.repositories,
          auth: {
            googleKeys: google.googleKeys,
            allowedEmails: ['allowed@example.com'],
          },
        })
        try {
          const denied = await loginWith(
            await google.idToken({
              claims: { sub: randomUUID(), email: 'stranger@example.com' },
            }),
            restricted
          )
          expect(denied.statusCode).toBe(403)
          expect(denied.json()).toMatchObject({
            error: 'Forbidden',
            statusCode: 403,
          })

          const allowed = await loginWith(
            await google.idToken({
              claims: { sub: randomUUID(), email: 'Allowed@Example.com' },
            }),
            restricted
          )
          expect(allowed.statusCode).toBe(200)
        } finally {
          await restricted.close()
        }
      })
    })

    describe('access token on protected routes', () => {
      it('401 without a bearer token', async () => {
        const res = await me()
        expect(res.statusCode).toBe(401)
        expect(res.json()).toMatchObject({
          error: 'Unauthorized',
          message: 'Missing bearer token',
        })
      })

      it('401 for a non-bearer scheme', async () => {
        expect((await me(undefined, 'Basic abc')).statusCode).toBe(401)
      })

      it('401 for a garbage token', async () => {
        const res = await me('garbage')
        expect(res.statusCode).toBe(401)
        expect(res.json().message).toBe('Invalid or expired token')
      })

      it('401 for an expired access token', async () => {
        const { user } = await freshLogin()
        const now = Math.floor(Date.now() / 1000)
        const expired = await new SignJWT({ email: user.email })
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject(user.id)
          .setIssuedAt(now - 120)
          .setExpirationTime(now - 60)
          .sign(new TextEncoder().encode(env.auth.jwtSecret))
        expect((await me(expired)).statusCode).toBe(401)
      })

      it('401 for a token signed with another secret', async () => {
        const { user } = await freshLogin()
        const forged = await new SignJWT({ email: user.email })
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject(user.id)
          .setExpirationTime('5m')
          .sign(
            new TextEncoder().encode('another-secret-another-secret-123456')
          )
        expect((await me(forged)).statusCode).toBe(401)
      })

      it('401 for a Google ID token used as an access token', async () => {
        expect((await me(await google.idToken())).statusCode).toBe(401)
      })

      it('401 for a refresh token used as an access token', async () => {
        const { refreshToken } = await freshLogin()
        expect((await me(refreshToken)).statusCode).toBe(401)
      })

      it('200 with a good token', async () => {
        const { accessToken, user } = await freshLogin()
        const res = await me(accessToken)
        expect(res.statusCode).toBe(200)
        expect(res.json().id).toBe(user.id)
      })
    })

    describe('POST /auth/refresh', () => {
      it('issues a new pair and the old refresh token stops working', async () => {
        const first = await freshLogin()
        const res = await refresh(first.refreshToken)
        expect(res.statusCode).toBe(200)
        const second = res.json()
        expect(second.refreshToken).not.toBe(first.refreshToken)
        expect(second.user.id).toBe(first.user.id)
        expect((await me(second.accessToken)).statusCode).toBe(200)

        // the rotated token chain keeps working
        const third = await refresh(second.refreshToken)
        expect(third.statusCode).toBe(200)

        // the old one does not
        const old = await refresh(first.refreshToken)
        expect(old.statusCode).toBe(401)
      })

      it('reusing a rotated token revokes the whole family', async () => {
        const first = await freshLogin()
        const second = (await refresh(first.refreshToken)).json()
        const third = (await refresh(second.refreshToken)).json()

        // attacker (or buggy client) replays the first token
        const replay = await refresh(first.refreshToken)
        expect(replay.statusCode).toBe(401)
        expect(replay.json().message).toBe('Refresh token reused')

        // everything descended from that login is now dead, even the newest
        expect((await refresh(third.refreshToken)).statusCode).toBe(401)
        expect((await refresh(second.refreshToken)).statusCode).toBe(401)
      })

      it('a revoked family does not affect other sessions of the same user', async () => {
        const sub = randomUUID()
        const login = async () =>
          (await loginWith(await google.idToken({ claims: { sub } }))).json()
        const phone = await login()
        const laptop = await login()
        await refresh(phone.refreshToken)
        await refresh(phone.refreshToken) // reuse: phone family revoked
        expect((await refresh(laptop.refreshToken)).statusCode).toBe(200)
      })

      it('concurrent refreshes with the same token: one wins, family is revoked', async () => {
        const first = await freshLogin()
        const results = await Promise.all([
          refresh(first.refreshToken),
          refresh(first.refreshToken),
        ])
        const codes = results.map(r => r.statusCode).sort()
        expect(codes).toContain(401)
        expect(codes.filter(c => c === 200).length).toBeLessThanOrEqual(1)
        const winner = results.find(r => r.statusCode === 200)
        if (winner) {
          // the loser's reuse detection revoked the family
          expect((await refresh(winner.json().refreshToken)).statusCode).toBe(
            401
          )
        }
      })

      it('401 for an unknown token', async () => {
        const res = await refresh('does-not-exist')
        expect(res.statusCode).toBe(401)
        expect(res.json().message).toBe('Invalid refresh token')
      })

      it('401 for an expired refresh token', async () => {
        const { user } = await freshLogin()
        const token = 'expired-refresh-token-value'
        await db.repositories.refreshTokens.create({
          userId: user.id,
          familyId: randomUUID(),
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() - 1000),
        })
        const res = await refresh(token)
        expect(res.statusCode).toBe(401)
        expect(res.json().message).toBe('Refresh token expired')
      })

      it('403 when the user is no longer in ALLOWED_EMAILS', async () => {
        const { refreshToken } = await freshLogin({ email: 'gone@example.com' })
        const restricted = await buildApp({
          repositories: db.repositories,
          auth: {
            googleKeys: google.googleKeys,
            allowedEmails: ['someone-else@example.com'],
          },
        })
        try {
          expect((await refresh(refreshToken, restricted)).statusCode).toBe(403)
        } finally {
          await restricted.close()
        }
      })

      it('400 without a refreshToken', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/auth/refresh',
          payload: {},
        })
        expect(res.statusCode).toBe(400)
      })
    })

    describe('POST /auth/logout', () => {
      it('revokes the session: its refresh tokens stop working', async () => {
        const first = await freshLogin()
        const second = (await refresh(first.refreshToken)).json()
        const res = await logout(second.refreshToken)
        expect(res.statusCode).toBe(204)
        expect((await refresh(second.refreshToken)).statusCode).toBe(401)
      })

      it('is idempotent and reveals nothing about unknown tokens', async () => {
        const { refreshToken } = await freshLogin()
        expect((await logout(refreshToken)).statusCode).toBe(204)
        expect((await logout(refreshToken)).statusCode).toBe(204)
        expect((await logout('never-issued')).statusCode).toBe(204)
      })

      it('does not end the other sessions of the user', async () => {
        const sub = randomUUID()
        const a = (
          await loginWith(await google.idToken({ claims: { sub } }))
        ).json()
        const b = (
          await loginWith(await google.idToken({ claims: { sub } }))
        ).json()
        await logout(a.refreshToken)
        expect((await refresh(b.refreshToken)).statusCode).toBe(200)
      })
    })
  })
}
