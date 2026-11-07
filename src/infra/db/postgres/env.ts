import { z } from 'zod'

import { parseEnv } from '~/utils/parse-env'

const schema = z.object({
  DATABASE_URL: z.url(),
})

export type PostgresEnv = { url: string }

export function loadEnv(source: NodeJS.ProcessEnv = process.env): PostgresEnv {
  return { url: parseEnv(schema, source).DATABASE_URL }
}
