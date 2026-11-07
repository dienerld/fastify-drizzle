import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '~/app'
import type { Database } from '~/infra/repositories'
import { bearer, createFakeGoogle, type FakeGoogle, login } from '~/test/auth'

/** `GET /users/me` through HTTP over a real database. */
export function describeUserRoutes(makeDb: () => Promise<Database>) {
  describe('users routes', () => {
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

    it('GET /users/me returns only the authenticated user', async () => {
      const a = await login(app, google, {
        sub: 'sub-a',
        email: 'a@x.com',
        name: 'A',
      })
      const b = await login(app, google, {
        sub: 'sub-b',
        email: 'b@x.com',
        name: 'B',
      })

      const meA = await app.inject({
        method: 'GET',
        url: '/users/me',
        headers: bearer(a.accessToken),
      })
      expect(meA.statusCode).toBe(200)
      expect(meA.json()).toMatchObject({
        id: a.user.id,
        email: 'a@x.com',
        name: 'A',
      })
      expect(meA.json()).not.toHaveProperty('googleSub')

      const meB = await app.inject({
        method: 'GET',
        url: '/users/me',
        headers: bearer(b.accessToken),
      })
      expect(meB.json()).toMatchObject({ id: b.user.id, email: 'b@x.com' })
    })

    it('has no way to read another user by id', async () => {
      const a = await login(app, google, { sub: 'sub-a', email: 'a@x.com' })
      const b = await login(app, google, { sub: 'sub-b', email: 'b@x.com' })
      for (const key of [b.user.id, 'sub-b']) {
        const res = await app.inject({
          method: 'GET',
          url: `/users/${key}`,
          headers: bearer(a.accessToken),
        })
        expect(res.statusCode).toBe(404)
      }
    })

    it('there is no public POST /users', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/users',
        payload: { email: 'x@x.com' },
      })
      expect(res.statusCode).toBe(404)
    })
  })
}
