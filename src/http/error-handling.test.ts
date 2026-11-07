import fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { buildApp } from '~/app'
import { env } from '~/env'
import { noRepositories } from '~/test/no-repositories'
import { registerErrorHandlers } from '~/utils/error-handler'

function bareApp() {
  const app = fastify()
    .setValidatorCompiler(validatorCompiler)
    .setSerializerCompiler(serializerCompiler)
    .withTypeProvider<ZodTypeProvider>()
  registerErrorHandlers(app)
  return app
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('error format', () => {
  it('returns standard 404', async () => {
    const app = await buildApp({ repositories: noRepositories })
    const res = await app.inject({ method: 'GET', url: '/nope' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({
      error: 'Not Found',
      message: 'Route GET:/nope not found',
      statusCode: 404,
    })
    await app.close()
  })

  it('returns 400 with issues on validation error', async () => {
    const app = bareApp()
    app.post(
      '/things',
      { schema: { body: z.object({ email: z.email(), age: z.number() }) } },
      async () => ({ ok: true })
    )
    const res = await app.inject({
      method: 'POST',
      url: '/things',
      payload: { email: 'nope', age: 'x' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error).toBe('Bad Request')
    expect(body.statusCode).toBe(400)
    expect(body.issues.map((i: { path: string }) => i.path).sort()).toEqual([
      'body.age',
      'body.email',
    ])
    await app.close()
  })

  it('hides internal details of 500 in production', async () => {
    vi.spyOn(env, 'nodeEnv', 'get').mockReturnValue('production')
    const app = bareApp()
    app.get('/boom', async () => {
      throw new Error('secret db password leaked')
    })
    const res = await app.inject({ method: 'GET', url: '/boom' })
    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({
      error: 'Internal Server Error',
      message: 'Internal Server Error',
      statusCode: 500,
    })
    expect(res.body).not.toContain('secret')
    expect(res.body).not.toContain('stack')
    await app.close()
  })

  it('keeps 4xx errors thrown by handlers', async () => {
    const app = bareApp()
    app.get('/bad', async () => {
      const err = new Error('custom') as Error & { statusCode: number }
      err.statusCode = 409
      throw err
    })
    const res = await app.inject({ method: 'GET', url: '/bad' })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toEqual({
      error: 'Conflict',
      message: 'custom',
      statusCode: 409,
    })
    await app.close()
  })
})

describe('docs', () => {
  it('serves OpenAPI with documented routes and /docs UI', async () => {
    const app = await buildApp({ repositories: noRepositories })
    const spec = await app.inject({ method: 'GET', url: '/docs/openapi.json' })
    expect(spec.statusCode).toBe(200)
    const doc = spec.json()
    expect(doc.info.title).toBe('fastify-api-template')
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        '/',
        '/health',
        '/auth/google',
        '/users/me',
        '/todos',
      ])
    )
    const ui = await app.inject({ method: 'GET', url: '/docs/' })
    expect(ui.statusCode).toBe(200)
    expect(ui.headers['content-type']).toContain('text/html')
    await app.close()
  })
})
