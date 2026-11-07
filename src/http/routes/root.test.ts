import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '~/app'
import { noRepositories } from '~/test/no-repositories'

describe('root routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp({ repositories: noRepositories })
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET / returns welcome payload', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok', message: 'Welcome to the API' })
  })

  it('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })
})

describe('GET /health with a cache configured', () => {
  const fakeCache = (up: boolean) => ({
    get: async () => null,
    set: async () => {},
    del: async () => {},
    ping: async () => up,
  })

  it('200 and cache ok when the cache answers', async () => {
    const app = await buildApp({
      repositories: noRepositories,
      cache: fakeCache(true),
    })
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok', cache: 'ok' })
    await app.close()
  })

  it('503 and cache down when the cache does not answer', async () => {
    const app = await buildApp({
      repositories: noRepositories,
      cache: fakeCache(false),
    })
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({ status: 'error', cache: 'down' })
    await app.close()
  })
})
