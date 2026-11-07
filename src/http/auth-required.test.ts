import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '~/app'
import { noRepositories } from '~/test/no-repositories'

/**
 * No database: unauthenticated requests must be rejected before any handler or
 * repository runs (`noRepositories` throws if one is touched).
 */
describe('protected routes require a bearer token', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp({ repositories: noRepositories })
  })

  afterAll(async () => {
    await app.close()
  })

  const protectedRoutes: [string, string][] = [
    ['GET', '/todos'],
    ['POST', '/todos'],
    ['GET', '/todos/00000000-0000-4000-8000-000000000000'],
    ['PATCH', '/todos/00000000-0000-4000-8000-000000000000'],
    ['DELETE', '/todos/00000000-0000-4000-8000-000000000000'],
    ['GET', '/users/me'],
  ]

  for (const [method, url] of protectedRoutes) {
    it(`${method} ${url} -> 401 without a token`, async () => {
      const res = await app.inject({
        method: method as 'GET',
        url,
        payload:
          method === 'POST' || method === 'PATCH' ? { title: 'x' } : undefined,
      })
      expect(res.statusCode).toBe(401)
      expect(res.json()).toMatchObject({
        error: 'Unauthorized',
        statusCode: 401,
      })
    })

    it(`${method} ${url} -> 401 with a bad token`, async () => {
      const res = await app.inject({
        method: method as 'GET',
        url,
        headers: { authorization: 'Bearer nope' },
        payload:
          method === 'POST' || method === 'PATCH' ? { title: 'x' } : undefined,
      })
      expect(res.statusCode).toBe(401)
    })
  }

  it('auth is checked before body validation', async () => {
    const res = await app.inject({ method: 'POST', url: '/todos', payload: {} })
    expect(res.statusCode).toBe(401)
  })

  it('the removed routes are gone', async () => {
    for (const [method, url] of [
      ['POST', '/users'],
      ['GET', '/users/some-external-id'],
    ] as const) {
      const res = await app.inject({ method, url })
      expect(res.statusCode).toBe(404)
    }
  })

  it('no route other than /auth/*, /, /health and /docs is public', () => {
    // every route registered under /todos or /users is covered by the list above
    const tree = app.printRoutes({ commonPrefix: false })
    expect(tree).toContain('todos')
    expect(tree).toContain('me (GET')
    expect(tree).not.toMatch(/users[\s\S]*:externalId/)
  })
})

describe('OpenAPI', () => {
  it('registers the bearer scheme and marks protected routes', async () => {
    const app = await buildApp({ repositories: noRepositories })
    try {
      const res = await app.inject({ method: 'GET', url: '/docs/openapi.json' })
      expect(res.statusCode).toBe(200)
      const spec = res.json()
      expect(spec.components.securitySchemes.bearerAuth).toMatchObject({
        type: 'http',
        scheme: 'bearer',
      })
      expect(spec.paths['/todos'].get.security).toEqual([{ bearerAuth: [] }])
      expect(spec.paths['/todos/{id}'].delete.security).toEqual([
        { bearerAuth: [] },
      ])
      expect(spec.paths['/users/me'].get.security).toEqual([{ bearerAuth: [] }])
      expect(spec.paths['/auth/google'].post.security).toBeUndefined()
      expect(spec.paths['/users']).toBeUndefined()
    } finally {
      await app.close()
    }
  })
})
