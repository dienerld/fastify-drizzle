import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { buildApp } from '~/app'
import type { Database } from '~/infra/repositories'
import {
  bearer,
  createFakeGoogle,
  type FakeGoogle,
  login,
  type TestSession,
} from '~/test/auth'

/**
 * {{Name}} CRUD through HTTP (`app.inject`) over a real database, authenticated
 * as two different users. `makeDb` returns a connected database with EMPTY stores.
 */
export function describe{{Name}}Routes(makeDb: () => Promise<Database>) {
  describe('{{camel}} routes', () => {
    let db: Database
    let app: FastifyInstance
    let google: FakeGoogle
    let a: TestSession
    let b: TestSession

    beforeAll(async () => {
      google = await createFakeGoogle()
      db = await makeDb()
      app = await buildApp({
        repositories: db.repositories,
        auth: { googleKeys: google.googleKeys },
      })
    })

    // fresh users per test: their {{pluralWords}} never overlap with other tests
    beforeEach(async () => {
      a = await login(app, google, {
        sub: randomUUID(),
        email: 'a@example.com',
      })
      b = await login(app, google, {
        sub: randomUUID(),
        email: 'b@example.com',
      })
    })

    afterAll(async () => {
      await app.close()
      await db.close()
    })

    const create = (session: TestSession, payload: object) =>
      app.inject({
        method: 'POST',
        url: '/{{pluralKebab}}',
        payload,
        headers: bearer(session.accessToken),
      })

    const call = (
      session: TestSession,
      method: 'GET' | 'PATCH' | 'DELETE',
      url: string,
      payload?: object
    ) =>
      app.inject({
        method,
        url,
        payload,
        headers: bearer(session.accessToken),
      })

    it('creates (201) and gets', async () => {
      const res = await create(a, { name: 'milk' })
      expect(res.statusCode).toBe(201)
      const {{camel}} = res.json()
      expect({{camel}}).toMatchObject({
        name: 'milk',
        description: null,
      })
      const got = await call(a, 'GET', `/{{pluralKebab}}/${{{camel}}.id}`)
      expect(got.statusCode).toBe(200)
      expect(got.json()).toEqual({{camel}})
    })

    it('lists only the caller {{pluralWords}}', async () => {
      await create(a, { name: 'a1' })
      await create(a, { name: 'a2' })
      await create(b, { name: 'b1' })
      const res = await call(a, 'GET', '/{{pluralKebab}}')
      expect(res.statusCode).toBe(200)
      expect(
        res
          .json()
          .map((t: { name: string }) => t.name)
          .sort()
      ).toEqual(['a1', 'a2'])
    })

    it('patches', async () => {
      const { id } = (await create(a, { name: 'a' })).json()
      const res = await call(a, 'PATCH', `/{{pluralKebab}}/${id}`, { name: 'b' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ id, name: 'b' })
    })

    it('deletes (204) then 404s', async () => {
      const { id } = (await create(a, { name: 'a' })).json()
      expect((await call(a, 'DELETE', `/{{pluralKebab}}/${id}`)).statusCode).toBe(204)
      expect((await call(a, 'DELETE', `/{{pluralKebab}}/${id}`)).statusCode).toBe(404)
    })

    it("another user's {{camel}} is a 404 for get, patch and delete (and untouched)", async () => {
      const { id } = (await create(b, { name: 'secret' })).json()
      const notFound = {
        error: 'Not Found',
        message: '{{Name}} not found',
        statusCode: 404,
      }

      const get = await call(a, 'GET', `/{{pluralKebab}}/${id}`)
      expect(get.statusCode).toBe(404)
      expect(get.json()).toEqual(notFound)

      const patch = await call(a, 'PATCH', `/{{pluralKebab}}/${id}`, { name: 'hacked' })
      expect(patch.statusCode).toBe(404)
      expect(patch.json()).toEqual(notFound)

      const del = await call(a, 'DELETE', `/{{pluralKebab}}/${id}`)
      expect(del.statusCode).toBe(404)
      expect(del.json()).toEqual(notFound)

      const still = await call(b, 'GET', `/{{pluralKebab}}/${id}`)
      expect(still.statusCode).toBe(200)
      expect(still.json()).toMatchObject({ name: 'secret' })
    })

    it('404s with the standard error for unknown and malformed ids', async () => {
      for (const id of ['507f1f77bcf86cd799439011', 'nope']) {
        const res = await call(a, 'GET', `/{{pluralKebab}}/${id}`)
        expect(res.statusCode).toBe(404)
        expect(res.json()).toEqual({
          error: 'Not Found',
          message: '{{Name}} not found',
          statusCode: 404,
        })
      }
      expect(
        (await call(a, 'PATCH', '/{{pluralKebab}}/nope', { name: 'x' })).statusCode
      ).toBe(404)
    })

    it('validates the body (400)', async () => {
      const res = await create(a, { name: '' })
      expect(res.statusCode).toBe(400)
      expect(res.json().issues[0].path).toBe('body.name')
    })

    it('ignores a userId sent in the body', async () => {
      const res = await create(a, { name: 'x', userId: b.user.id })
      expect(res.statusCode).toBe(201)
      expect((await call(b, 'GET', '/{{pluralKebab}}')).json()).toEqual([])
      expect((await call(a, 'GET', '/{{pluralKebab}}')).json()).toHaveLength(1)
    })
  })
}
