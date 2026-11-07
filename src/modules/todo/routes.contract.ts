import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { buildApp } from '~/app'
import type { Database } from '~/infra/repositories'

/**
 * Todo CRUD through HTTP (`app.inject`) over a real database.
 * `makeDb` returns a connected database with EMPTY stores.
 */
export function describeTodoRoutes(makeDb: () => Promise<Database>) {
  describe('todo routes', () => {
    let db: Database
    let app: FastifyInstance

    beforeAll(async () => {
      db = await makeDb()
      app = await buildApp({ repositories: db.repositories })
    })

    beforeEach(async () => {
      for (const t of await db.repositories.todos.list()) {
        await db.repositories.todos.delete(t.id)
      }
    })

    afterAll(async () => {
      await app.close()
      await db.close()
    })

    const create = (payload: object) =>
      app.inject({ method: 'POST', url: '/todos', payload })

    it('creates (201) and gets', async () => {
      const res = await create({ title: 'milk' })
      expect(res.statusCode).toBe(201)
      const todo = res.json()
      expect(todo).toMatchObject({
        title: 'milk',
        description: null,
        completed: false,
      })
      const got = await app.inject({ method: 'GET', url: `/todos/${todo.id}` })
      expect(got.statusCode).toBe(200)
      expect(got.json()).toEqual(todo)
    })

    it('lists', async () => {
      await create({ title: 'a' })
      await create({ title: 'b' })
      const res = await app.inject({ method: 'GET', url: '/todos' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toHaveLength(2)
    })

    it('patches', async () => {
      const { id } = (await create({ title: 'a' })).json()
      const res = await app.inject({
        method: 'PATCH',
        url: `/todos/${id}`,
        payload: { completed: true },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ id, title: 'a', completed: true })
    })

    it('deletes (204) then 404s', async () => {
      const { id } = (await create({ title: 'a' })).json()
      const del = await app.inject({ method: 'DELETE', url: `/todos/${id}` })
      expect(del.statusCode).toBe(204)
      const again = await app.inject({ method: 'DELETE', url: `/todos/${id}` })
      expect(again.statusCode).toBe(404)
    })

    it('404s with the standard error for unknown and malformed ids', async () => {
      for (const id of ['507f1f77bcf86cd799439011', 'nope']) {
        const res = await app.inject({ method: 'GET', url: `/todos/${id}` })
        expect(res.statusCode).toBe(404)
        expect(res.json()).toEqual({
          error: 'Not Found',
          message: 'Todo not found',
          statusCode: 404,
        })
      }
      const patch = await app.inject({
        method: 'PATCH',
        url: '/todos/nope',
        payload: { title: 'x' },
      })
      expect(patch.statusCode).toBe(404)
    })

    it('validates the body (400)', async () => {
      const res = await create({ title: '' })
      expect(res.statusCode).toBe(400)
      expect(res.json().issues[0].path).toBe('body.title')
    })
  })
}
