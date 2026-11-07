import { afterEach, describe, expect, it } from 'vitest'

import { buildApp } from '~/app'
import { createFakeGoogle } from '~/test/auth'
import { unknownTokens } from '~/test/no-repositories'
import { describeRateLimit } from './rate-limit.contract'

const googleKeys = (await createFakeGoogle()).googleKeys

// In-memory store here; the Redis store runs in `rate-limit.redis.test.ts`.
describeRateLimit(rateLimit =>
  buildApp({ repositories: unknownTokens, auth: { googleKeys }, rateLimit })
)

describe('rate limit with default settings', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = []
  afterEach(async () => {
    await Promise.all(apps.splice(0).map(app => app.close()))
  })

  it('does not touch normal traffic', async () => {
    const app = await buildApp({
      repositories: unknownTokens,
      auth: { googleKeys },
    })
    apps.push(app)
    for (let i = 0; i < 30; i++) {
      expect((await app.inject({ method: 'GET', url: '/' })).statusCode).toBe(
        200
      )
      expect(
        (await app.inject({ method: 'GET', url: '/users/me' })).statusCode
      ).toBe(401) // auth error, never 429
    }
  })
})
