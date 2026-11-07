import { z } from 'zod'

import { parseEnv } from '~/utils/parse-env'

const schema = z.object({
  REDIS_URL: z.url().optional(),
})

export type CacheEnv = { url: string }

/** `undefined` when `REDIS_URL` is not set: the cache is optional. */
export function loadEnv(
  source: NodeJS.ProcessEnv = process.env
): CacheEnv | undefined {
  const { REDIS_URL } = parseEnv(schema, source)
  return REDIS_URL ? { url: REDIS_URL } : undefined
}
