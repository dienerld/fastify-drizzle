import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '~/env'

export {
  and,
  asc,
  between,
  desc,
  eq,
  not,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'

import * as tables from './schemas'

export { tables }
export const client = postgres(env.db.url)
export const db = drizzle(client, { schema: tables, logger: false })
