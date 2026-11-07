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
