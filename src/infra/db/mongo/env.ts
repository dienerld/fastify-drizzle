import { z } from 'zod'

import { parseEnv } from '~/utils/parse-env'

const schema = z.object({
  MONGODB_URI: z.string().startsWith('mongodb'),
  MONGODB_DB: z.string().min(1).default('app'),
})

export type MongoEnv = { uri: string; dbName: string }

export function loadEnv(source: NodeJS.ProcessEnv = process.env): MongoEnv {
  const e = parseEnv(schema, source)
  return { uri: e.MONGODB_URI, dbName: e.MONGODB_DB }
}
